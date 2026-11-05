// The logged in user's own signposts and challenges, for the "My posts" profile tab (tables are in supabase/stop_activities.sql)
// Call `useMyPosts()` in <script setup>, then use the returned functions anywhere.

const BUCKET = 'place-photos'

export const useMyPosts = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()

  // signposts and challenges you posted, newest first. Each has kind + key ('signpost:12'), photoUrl, and completedCount for challenges
  const posts = ref<any[]>([])
  const loading = ref(false)
  const loadError = ref('')   // set when your posts couldn't be loaded, so the page can show it with a Retry

  // public url of a photo in the place-photos bucket (same as useStopActivities)
  function photoUrl(path: string | null) {
    if (!path) return ''
    return $supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  async function load() {
    loading.value = true
    loadError.value = ''

    try {
      const { data: auth, error: authError } = await $supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Log in to see your posts.')
      const userId = auth.user.id

      // everyone can read every row (row level security), so filter to your own here
      const [signposts, challenges] = await Promise.all([
        $supabase.from('signposts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        $supabase.from('challenges').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      ])
      if (signposts.error || challenges.error) throw signposts.error || challenges.error

      // completions for just your challenges, counted here
      const challengeIds = challenges.data.map(row => row.id)
      let completions: any[] = []
      if (challengeIds.length) {
        const done = await $supabase.from('challenge_completions').select('challenge_id').in('challenge_id', challengeIds)
        if (done.error) throw done.error
        completions = done.data
      }

      posts.value = [
        ...signposts.data.map(row => ({
          ...row,
          kind: 'signpost',
          key: `signpost:${row.id}`,
          photoUrl: photoUrl(row.photo_path)
        })),
        ...challenges.data.map(row => ({
          ...row,
          kind: 'challenge',
          key: `challenge:${row.id}`,
          photoUrl: '',
          completedCount: completions.filter(done => done.challenge_id == row.id).length
        }))
      ].sort((a, b) => b.created_at.localeCompare(a.created_at))
    } catch (error: any) {
      console.error('[my posts] load failed:', error?.message || error)
      loadError.value = error?.message || 'Something went wrong.'
    } finally {
      loading.value = false
    }
  }

  return { posts, loading, loadError, load, photoUrl }
}
