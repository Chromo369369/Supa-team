// Collectible cards (tables, bucket and unlock rules are set up in supabase/cards.sql)
// Call `useCards()` in <script setup>, then use the returned functions anywhere.

const BUCKET = 'card-art'

export const useCards = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()

  // every card in the catalogue (in sort_order), each with unlocked + unlockedAt for the logged in user
  const cards = ref<any[]>([])
  const loading = ref(false)
  const loadError = ref('')   // set when the cards couldn't be loaded, so the page can show it with a Retry

  // public url of a card's art, or null if it has none yet
  function artUrl(path: string | null) {
    if (!path) return null
    return $supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  async function load() {
    loading.value = true
    loadError.value = ''

    // user_cards only ever returns your own rows (row level security)
    const [catalogue, owned] = await Promise.all([
      $supabase.from('cards').select('*').order('sort_order', { ascending: true }),
      $supabase.from('user_cards').select('card_id, unlocked_at')
    ])
    loading.value = false
    if (catalogue.error || owned.error) {
      console.error('[cards] load failed:', (catalogue.error || owned.error)!.message)
      loadError.value = (catalogue.error || owned.error)!.message
      return
    }

    cards.value = catalogue.data.map(card => {
      const mine = owned.data.find(row => row.card_id == card.id)
      return { ...card, unlocked: !!mine, unlockedAt: mine ? mine.unlocked_at : null }
    })
  }

  // ask the database to hand out any cards you've earned but don't have yet. Returns the new card ids
  async function claimUnlocks() {
    const { data, error } = await $supabase.rpc('claim_card_unlocks')
    if (error) throw new Error(error.message)

    const newIds: string[] = data || []
    const now = new Date().toISOString()
    cards.value = cards.value.map(card => newIds.includes(card.id) ? { ...card, unlocked: true, unlockedAt: now } : card)
    return newIds
  }

  return { cards, loading, loadError, load, claimUnlocks, artUrl }
}
