// Shop rewards: what you own, which look is on in each slot, and your vouchers
// (supabase/shop.sql + supabase/rewards.sql). Cached app-wide with useState, so the header, the bus
// pass, the shop, the stamps and the tickets share one copy.
//
//   const rewards = useRewards()
//   owned          slugs you've bought (not cards), e.g. ['perk-ticket-sunset', 'voucher-yakun']
//   equipped       slot -> slug of the look that's on, e.g. { ticket_theme: 'perk-ticket-sunset' }
//   isOn(slug)     true when that look is equipped (templates call this for themes and the hat)
//   equip(item)    put a look on (it replaces whatever was in its slot); item = a shop_items row
//   unequip(slot)  take the look in that slot off
//   vouchers       your voucher redemptions, newest first:
//                  { id, item_id, slug, name, brand, description, code, expiresAt, usedAt, createdAt }
//   markUsed(id)   mark a voucher redemption as used (the database stamps the time)
//   load()         fetch again, e.g. right after a redeem
//   lookFor(ids)   batch-fetch other people's equipped looks (cached); resolves to
//                  { [userId]: { mascot_hat?: slug, ... } }. hatOf(id) reads the cache for a mascot.
//   status         'idle' | 'loading' | 'ready' | 'error'
//
// The first call on the client loads by itself, and it reloads when you sign in or out.
// Every failure degrades quietly: until supabase/rewards.sql has run there is no user_equipped
// table, so isOn() falls back to false (default look) until equipping can be read.

export type LookSlot = 'ticket_theme' | 'stamp_theme' | 'mascot_hat' | 'pass_skin'

export interface Voucher {
  id: number
  item_id: number
  slug: string
  name: string
  brand: string
  description: string
  code: string
  expiresAt: string | null
  usedAt: string | null
  createdAt: string
}

// the mascot's hat prop for each hat perk
const HATS: Record<string, 'captain'> = { 'perk-mascot-captain': 'captain' }

let inFlight: Promise<void> | null = null
let listening = false
const lookRequests = new Map<string, Promise<void>>()

const one = (row: any) => (Array.isArray(row) ? row[0] : row)

export const useRewards = () => {
  const { $supabase } = useNuxtApp()

  const owned = useState<string[]>('wb-rewards-owned', () => [])
  const ownedIds = useState<Record<number, string>>('wb-rewards-owned-ids', () => ({}))   // item id -> slug
  const equipped = useState<Partial<Record<LookSlot, string>>>('wb-rewards-equipped', () => ({}))
  const equipReady = useState('wb-rewards-equip-ready', () => false)   // user_equipped could be read
  const vouchers = useState<Voucher[]>('wb-rewards-vouchers', () => [])
  const status = useState<'idle' | 'loading' | 'ready' | 'error'>('wb-rewards-status', () => 'idle')
  const looks = useState<Record<string, Partial<Record<LookSlot, string>>>>('wb-rewards-looks', () => ({}))

  function clear() {
    owned.value = []
    ownedIds.value = {}
    equipped.value = {}
    equipReady.value = false
    vouchers.value = []
  }

  async function readRedemptions(userId: string) {
    const full = await $supabase
      .from('redemptions')
      .select('id, item_id, created_at, voucher_code, expires_at, used_at, shop_items(id, slug, kind, name, brand, description)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (!full.error) return full.data ?? []
    // the voucher columns arrive with rewards.sql; before that, read what shop.sql has
    const basic = await $supabase
      .from('redemptions')
      .select('id, item_id, created_at, shop_items(id, slug, kind, name, description)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (basic.error) throw new Error(basic.error.message)
    return basic.data ?? []
  }

  async function fetchAll() {
    status.value = 'loading'
    try {
      const { data: auth } = await $supabase.auth.getUser()
      if (!auth.user) {
        clear()
        status.value = 'ready'
        return
      }
      const [rows, slots] = await Promise.all([
        readRedemptions(auth.user.id),
        $supabase.from('user_equipped').select('slot, item_id').eq('user_id', auth.user.id)
      ])

      const slugs = new Set<string>()
      const ids: Record<number, string> = {}
      const mine: Voucher[] = []
      for (const row of rows as any[]) {
        const item = one(row.shop_items)
        if (!item?.slug || item.kind == 'card') continue
        slugs.add(item.slug)
        ids[row.item_id] = item.slug
        if (item.kind == 'voucher') {
          mine.push({
            id: row.id,
            item_id: row.item_id,
            slug: item.slug,
            name: item.name || '',
            brand: item.brand || '',
            description: item.description || '',
            code: row.voucher_code || '',
            expiresAt: row.expires_at || null,
            usedAt: row.used_at || null,
            createdAt: row.created_at
          })
        }
      }
      owned.value = [...slugs]
      ownedIds.value = ids
      vouchers.value = mine

      if (slots.error) {
        equipReady.value = false
        equipped.value = {}
      } else {
        const on: Partial<Record<LookSlot, string>> = {}
        for (const row of (slots.data ?? []) as any[]) if (ids[row.item_id]) on[row.slot as LookSlot] = ids[row.item_id]
        equipped.value = on
        equipReady.value = true
      }
      status.value = 'ready'
    } catch (e: any) {
      // looks are extras: on a failure the app just looks the default way
      console.error('[rewards] load failed:', e?.message)
      status.value = 'error'
    }
  }

  function load(): Promise<void> {
    if (!import.meta.client) return Promise.resolve()
    if (!inFlight) inFlight = fetchAll().finally(() => { inFlight = null })
    return inFlight
  }

  function isOn(slug: string) {
    if (!equipReady.value) return false   // no user_equipped table yet: default look, so a bought theme can't get stuck on
    return Object.values(equipped.value).includes(slug)
  }

  // throws the database's message so the caller can toast it
  async function equip(item: { id: number, slug: string, slot?: LookSlot | null }) {
    const { data, error } = await $supabase.rpc('equip_item', { p_item_id: item.id })
    if (error) throw new Error(error.message)
    const slot = (one(data)?.slot || item.slot) as LookSlot
    if (slot) equipped.value = { ...equipped.value, [slot]: item.slug }
    equipReady.value = true
  }

  async function unequip(slot: LookSlot) {
    const { error } = await $supabase.rpc('unequip_item', { p_slot: slot })
    if (error) throw new Error(error.message)
    const next = { ...equipped.value }
    delete next[slot]
    equipped.value = next
  }

  async function markUsed(id: number) {
    const { data, error } = await $supabase.rpc('mark_voucher_used', { p_redemption_id: id })
    if (error) {
      // 'This voucher has expired': grey it out here too, even if this device's clock disagrees
      if (/expired/i.test(error.message)) {
        const now = new Date().toISOString()
        vouchers.value = vouchers.value.map((v) => (v.id == id && (!v.expiresAt || v.expiresAt > now) ? { ...v, expiresAt: now } : v))
      }
      throw new Error(error.message)
    }
    const usedAt = (typeof data == 'string' ? data : one(data)) || new Date().toISOString()
    vouchers.value = vouchers.value.map((v) => (v.id == id ? { ...v, usedAt } : v))
  }

  // other people's looks, for their mascots (crew seats, signposts). Fetches only the ids not cached yet.
  async function lookFor(userIds: string[]) {
    const wanted = [...new Set(userIds.filter(Boolean))]
    const missing = wanted.filter((id) => !(id in looks.value) && !lookRequests.has(id))
    if (missing.length && import.meta.client) {
      const request = (async () => {
        try {
          const { data, error } = await $supabase.from('user_equipped').select('user_id, slot, item_id').in('user_id', missing)
          if (error) throw new Error(error.message)
          const itemIds = [...new Set((data ?? []).map((row: any) => row.item_id))]
          const slugOf: Record<number, string> = {}
          if (itemIds.length) {
            const items = await $supabase.from('shop_items').select('id, slug').in('id', itemIds)
            if (items.error) throw new Error(items.error.message)
            for (const item of items.data ?? []) slugOf[item.id] = item.slug
          }
          const next = { ...looks.value }
          for (const id of missing) next[id] = {}
          for (const row of (data ?? []) as any[]) if (slugOf[row.item_id]) next[row.user_id]![row.slot as LookSlot] = slugOf[row.item_id]
          looks.value = next
        } catch (e: any) {
          console.error('[rewards] looks failed:', e?.message)
          const next = { ...looks.value }
          for (const id of missing) next[id] = {}   // no retry storm; a reload asks again
          looks.value = next
        }
      })()
      for (const id of missing) lookRequests.set(id, request)
      request.finally(() => { for (const id of missing) lookRequests.delete(id) })
    }
    await Promise.all(wanted.map((id) => lookRequests.get(id)).filter(Boolean))
    return Object.fromEntries(wanted.map((id) => [id, looks.value[id] ?? {}]))
  }

  function hatOf(userId: string) {
    const slug = looks.value[userId]?.mascot_hat
    return (slug && HATS[slug]) || null
  }

  if (import.meta.client) {
    if (status.value == 'idle') load()
    if (!listening) {
      listening = true
      $supabase.auth.onAuthStateChange((event: string) => {
        if (event == 'SIGNED_OUT') clear()
        else if (event == 'SIGNED_IN' || event == 'USER_UPDATED') load()
      })
    }
  }

  return { owned, equipped, vouchers, status, looks, isOn, equip, unequip, markUsed, load, lookFor, hatOf }
}
