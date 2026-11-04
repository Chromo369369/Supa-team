// Profile page: the logged in user's name + totals (the function is set up in supabase/profile.sql)
// Call `useProfile()` in <script setup>, then call `load()` (e.g. in onMounted).

export const useProfile = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()

  // { trips, signposts, challenges_done, pioneer_photos, credits }, null until loaded
  const stats = ref<any>(null)
  const loading = ref(false)
  const loadError = ref('')   // set when the profile couldn't be loaded, so the page can show it with a Retry
  const displayName = ref('')
  const userId = ref('')

  async function load() {
    loading.value = true
    loadError.value = ''

    const { data: auth, error: authError } = await $supabase.auth.getUser()
    if (authError || !auth.user) {
      console.error('[profile] load failed:', authError?.message)
      loadError.value = authError?.message || 'You need to be logged in'
      loading.value = false
      return
    }
    userId.value = auth.user.id
    // same fallback as the trigger in stop_activities.sql: the name from register, else the email before '@'
    displayName.value = auth.user.user_metadata?.display_name || (auth.user.email || '').split('@')[0]

    const { data, error } = await $supabase.rpc('profile_stats')
    if (error) {
      console.error('[profile] load failed:', error.message)
      loadError.value = error.message
      loading.value = false
      return
    }
    // a function that returns a table comes back as an array with one row
    stats.value = Array.isArray(data) ? data[0] ?? null : data
    loading.value = false
  }

  return { stats, loading, loadError, displayName, userId, load }
}
