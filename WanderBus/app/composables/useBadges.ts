export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  sort_order: number
  earned_at?: string
}

let catalogRequest: Promise<void> | null = null
let mineRequest: Promise<void> | null = null
let claiming: Promise<string[]> | null = null
const userRequests = new Map<string, Promise<void>>()
const queued = new Set<string>()
let flush: Promise<void> | null = null

export const useBadges = () => {
  const { $supabase } = useNuxtApp()
  const toast = useToast()

  const catalog = useState<Badge[]>('wb-badges-catalog', () => [])
  const mine = useState<Badge[]>('wb-badges-mine', () => [])
  const byUser = useState<Record<string, string[]>>('wb-badges-by-user', () => ({}))   // user id -> badge ids, best first

  const byId = computed(() => Object.fromEntries(catalog.value.map((b) => [b.id, b])) as Record<string, Badge>)
  const rank = (id: string) => byId.value[id]?.sort_order ?? Number.MAX_SAFE_INTEGER

  function loadCatalog(force = false): Promise<void> {
    if (!import.meta.client) return Promise.resolve()
    if (catalog.value.length && !force) return Promise.resolve()
    if (!catalogRequest) {
      catalogRequest = (async () => {
        const { data, error } = await $supabase.from('badges').select('id, name, description, icon, sort_order').order('sort_order', { ascending: true })
        if (error) console.error('[badges] catalog failed:', error.message)
        else catalog.value = data ?? []
      })().finally(() => { catalogRequest = null })
    }
    return catalogRequest
  }

  function loadMine(): Promise<void> {
    if (!import.meta.client) return Promise.resolve()
    if (!mineRequest) {
      mineRequest = (async () => {
        await loadCatalog()
        const { data: auth } = await $supabase.auth.getUser()
        if (!auth.user) { mine.value = []; return }
        const { data, error } = await $supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', auth.user.id)
        if (error) { console.error('[badges] mine failed:', error.message); return }
        const rows = (data ?? []).filter((row: any) => byId.value[row.badge_id])
        rows.sort((a: any, b: any) => rank(a.badge_id) - rank(b.badge_id))
        mine.value = rows.map((row: any) => ({ ...byId.value[row.badge_id]!, earned_at: row.earned_at }))
        byUser.value = { ...byUser.value, [auth.user.id]: rows.map((row: any) => row.badge_id) }
      })().finally(() => { mineRequest = null })
    }
    return mineRequest
  }

  const load = async () => { await loadCatalog(true); await loadMine() }

  // ids asked for in the same tick (every signpost card on a stop, every seat) go out as one query
  function fetchUsers(ids: string[]): Promise<void> {
    return (async () => {
      await loadCatalog()
      const next = { ...byUser.value }
      for (const id of ids) next[id] = []
      const { data, error } = await $supabase.from('user_badges').select('user_id, badge_id').in('user_id', ids)
      if (error) console.error('[badges] users failed:', error.message)
      for (const row of (data ?? []) as any[]) if (byId.value[row.badge_id]) next[row.user_id]?.push(row.badge_id)
      for (const id of ids) next[id]!.sort((a, b) => rank(a) - rank(b))
      byUser.value = next
    })()
  }

  async function forUsers(userIds: string[]) {
    const wanted = [...new Set(userIds.filter(Boolean))]
    const missing = wanted.filter((id) => !(id in byUser.value) && !userRequests.has(id))
    if (missing.length && import.meta.client) {
      for (const id of missing) queued.add(id)
      if (!flush) {
        flush = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => {
          const ids = [...queued]
          queued.clear()
          flush = null
          return fetchUsers(ids).finally(() => { for (const id of ids) userRequests.delete(id) })
        })
      }
      for (const id of missing) userRequests.set(id, flush)
    }
    await Promise.all(wanted.map((id) => userRequests.get(id)).filter(Boolean))
    return Object.fromEntries(wanted.map((id) => [id, (byUser.value[id] ?? []).map((b) => byId.value[b]!).filter(Boolean)])) as Record<string, Badge[]>
  }

  function bestOf(userId: string): Badge | null {
    const first = byUser.value[userId]?.[0]
    return (first && byId.value[first]) || null
  }

  function claim(): Promise<string[]> {
    if (!import.meta.client) return Promise.resolve([])
    if (!claiming) {
      claiming = (async () => {
        const { data, error } = await $supabase.rpc('claim_badges')
        if (error) {
          console.error('[badges] claim failed:', error.message)
          await loadMine()   // still show what was earned before
          return []
        }
        // setof text comes back as a list of strings (or { claim_badges } rows on some clients)
        const ids: string[] = (data ?? []).map((row: any) => (typeof row == 'string' ? row : row?.claim_badges)).filter(Boolean)
        await loadCatalog(ids.some((id) => !byId.value[id]))
        for (const id of ids) toast.success(`New badge: ${byId.value[id]?.name || id}`)
        await loadMine()
        return ids
      })().finally(() => { claiming = null })
    }
    return claiming
  }

  return { catalog, mine, load, forUsers, bestOf, claim }
}
