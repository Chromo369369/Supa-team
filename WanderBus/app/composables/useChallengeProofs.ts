// Proof photos people posted when they completed a challenge (table is set up in supabase/stop_activities.sql)
// Call `useChallengeProofs()` in <script setup>, then `await load(challenge.id)` when someone asks to see them.
// Loaded lazily, one challenge at a time, and cached so opening the same gallery again is instant.

const BUCKET = 'place-photos'

export const useChallengeProofs = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()

  // challenge id -> proof photos (newest first), each with a public url
  const proofsByChallenge = ref<Record<string, any[]>>({})

  function withUrl(row: any) {
    const { data } = $supabase.storage.from(BUCKET).getPublicUrl(row.photo_path)
    return { ...row, url: data.publicUrl }
  }

  // throws with the database message, so the caller can show it in a toast with a Retry
  async function load(challengeId: string | number) {
    const key = String(challengeId)
    if (key in proofsByChallenge.value) return proofsByChallenge.value[key]!

    const { data, error } = await $supabase
      .from('challenge_completions')
      .select('photo_path, created_at, user_id')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[challenge proofs] load failed:', error.message)
      throw new Error(error.message)
    }

    const photos = data.filter(row => row.photo_path).map(withUrl)
    proofsByChallenge.value = { ...proofsByChallenge.value, [key]: photos }
    return photos
  }

  // after completing a challenge, so the next open fetches the new proof too
  function forget(challengeId: string | number) {
    const next = { ...proofsByChallenge.value }
    delete next[String(challengeId)]
    proofsByChallenge.value = next
  }

  return { proofsByChallenge, load, forget }
}
