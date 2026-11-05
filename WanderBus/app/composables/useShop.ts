// Reward shop: items for sale, your credits and what you've bought (tables + redeem_item are set up in supabase/shop.sql)
// Call `useShop()` in <script setup>, run `load()`, then use the returned functions anywhere.

export const useShop = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()

  const items = ref<any[]>([])     // active shop items, in sort_order
  const credits = ref(0)           // your balance from user_rewards (no row yet = 0)
  const history = ref<any[]>([])   // your redemptions with the item name, newest first
  const loading = ref(false)
  const loadError = ref('')        // set when the shop couldn't be loaded, so the page can show it with a Retry
  const busyId = ref<number | null>(null)   // id of the item being redeemed right now, to disable its button

  function withItem(row: any) {
    return { ...row, name: row.shop_items?.name || 'Removed item', kind: row.shop_items?.kind || '' }
  }

  async function load() {
    loading.value = true
    loadError.value = ''
    const { data: auth } = await $supabase.auth.getUser()

    const [shop, rewards, redemptions] = await Promise.all([
      $supabase.from('shop_items').select('*').order('sort_order', { ascending: true }),
      $supabase.from('user_rewards').select('credits').eq('user_id', auth.user!.id).maybeSingle(),
      $supabase.from('redemptions').select('id, item_id, cost, created_at, shop_items(name, kind)').order('created_at', { ascending: false })
    ])
    loading.value = false

    const error = shop.error || rewards.error || redemptions.error
    if (error) {
      console.error('[shop] load failed:', error.message)
      loadError.value = error.message
      return
    }
    items.value = shop.data
    credits.value = rewards.data?.credits ?? 0
    history.value = redemptions.data.map(withItem)
  }

  // the database checks the price and takes the credits. Throws the database's message
  // (e.g. 'Not enough credits (need 500, you have 120)') so the page can toast it
  async function redeem(item: any) {
    if (busyId.value != null) return
    busyId.value = item.id
    try {
      const { data, error } = await $supabase.rpc('redeem_item', { p_item_id: item.id })
      if (error) throw new Error(error.message)

      const result = data[0]
      credits.value = result.credits
      history.value = [
        withItem({ id: result.redemption_id, item_id: item.id, cost: item.cost, created_at: new Date().toISOString(), shop_items: item }),
        ...history.value
      ]
      return result
    } finally {
      busyId.value = null
    }
  }

  return { items, credits, history, loading, loadError, busyId, load, redeem }
}
