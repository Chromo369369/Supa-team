// Feature 3: signposts and challenges pinned around a stop (tables are set up in supabase/stop_activities.sql)
// Call `useStopActivities()` in <script setup>, then use the returned functions anywhere.

const BUCKET = 'place-photos'

export const useStopActivities = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()

  // signposts and challenges at this stop, newest first. Each has kind + key ('signpost:12') so they can share the map with places
  const activities = ref<any[]>([])
  let stop: any = null
  let userId = ''

  function photoUrl(path: string) {
    return $supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  async function uploadFile(file: File, folder: string) {
    const ext = file.name.split('.').pop()!.toLowerCase()
    const path = `${userId}/${folder}/${Date.now()}.${ext}`
    const upload = await $supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
    if (upload.error) throw new Error(upload.error.message)
    return path
  }

  function withDetails(kind: string, row: any) {
    return {
      ...row,
      kind,
      key: `${kind}:${row.id}`,
      isMine: row.user_id == userId,
      distanceM: Math.round(distanceInMetres(stop.lat, stop.lon, row.lat, row.lon)),
      photoUrl: row.photo_path ? photoUrl(row.photo_path) : ''
    }
  }

  async function loadActivities(stopInfo: any) {
    stop = stopInfo
    const { data: auth } = await $supabase.auth.getUser()
    userId = auth.user!.id

    const [signposts, challenges] = await Promise.all([
      $supabase.from('signposts').select('*').eq('stop_code', stop.code),
      $supabase.from('challenges').select('*').eq('stop_code', stop.code)
    ])
    if (signposts.error || challenges.error) {
      console.error('[stop activities] load failed:', (signposts.error || challenges.error)!.message)
      return
    }

    // votes and completions for just these signposts/challenges, counted here
    const [votes, completions] = await Promise.all([
      $supabase.from('signpost_votes').select('signpost_id, user_id').in('signpost_id', signposts.data.map(row => row.id)),
      $supabase.from('challenge_completions').select('challenge_id, user_id').in('challenge_id', challenges.data.map(row => row.id))
    ])

    activities.value = [
      ...signposts.data.map(row => withDetails('signpost', {
        ...row,
        helpfulCount: votes.data!.filter(vote => vote.signpost_id == row.id).length,
        votedByMe: votes.data!.some(vote => vote.signpost_id == row.id && vote.user_id == userId)
      })),
      ...challenges.data.map(row => withDetails('challenge', {
        ...row,
        completedCount: completions.data!.filter(done => done.challenge_id == row.id).length,
        completedByMe: completions.data!.some(done => done.challenge_id == row.id && done.user_id == userId)
      }))
    ].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  // kind = 'signpost' | 'challenge', fields = the form values + lat/lon of the dropped pin
  async function saveActivity(kind: string, fields: any, file: File | null, existing: any) {
    const table = kind == 'signpost' ? 'signposts' : 'challenges'
    let row: any = { lat: fields.lat, lon: fields.lon }

    if (kind == 'signpost') {
      row = { ...row, note: fields.note, rating: fields.rating, spent: fields.spent === '' ? null : fields.spent }
      if (file) row.photo_path = await uploadFile(file, 'signposts')
    } else {
      row = { ...row, title: fields.title, description: fields.description, hint: fields.hint || null }
    }

    const { data, error } = existing
      ? await $supabase.from(table).update(row).eq('id', existing.id).select().single()
      : await $supabase.from(table).insert({ ...row, stop_code: stop.code }).select().single()

    if (error) {
      // don't leave an orphan photo behind if the row was rejected
      if (row.photo_path) await $supabase.storage.from(BUCKET).remove([row.photo_path])
      throw new Error(error.message)
    }

    // swapping the photo on edit, so remove the old file
    if (existing && row.photo_path && existing.photo_path) await $supabase.storage.from(BUCKET).remove([existing.photo_path])

    const saved = withDetails(kind, {
      ...data,
      helpfulCount: existing ? existing.helpfulCount : 0, votedByMe: false,
      completedCount: existing ? existing.completedCount : 0, completedByMe: false
    })
    activities.value = existing
      ? activities.value.map(item => item.key == saved.key ? saved : item)
      : [saved, ...activities.value]
    return saved
  }

  async function deleteActivity(activity: any) {
    const table = activity.kind == 'signpost' ? 'signposts' : 'challenges'
    const { error } = await $supabase.from(table).delete().eq('id', activity.id)
    if (error) throw new Error(error.message)
    if (activity.photo_path) await $supabase.storage.from(BUCKET).remove([activity.photo_path])
    activities.value = activities.value.filter(item => item.key != activity.key)
  }

  // second press takes the vote back
  async function toggleHelpful(signpost: any) {
    const { error } = signpost.votedByMe
      ? await $supabase.from('signpost_votes').delete().eq('signpost_id', signpost.id).eq('user_id', userId)
      : await $supabase.from('signpost_votes').insert({ signpost_id: signpost.id })
    if (error) throw new Error(error.message)
    signpost.helpfulCount += signpost.votedByMe ? -1 : 1
    signpost.votedByMe = !signpost.votedByMe
  }

  // upload the proof photo, then add the completion row
  async function completeChallenge(challenge: any, file: File) {
    const path = await uploadFile(file, `challenges/${challenge.id}`)
    const { error } = await $supabase.from('challenge_completions').insert({ challenge_id: challenge.id, photo_path: path })
    if (error) {
      await $supabase.storage.from(BUCKET).remove([path])
      throw new Error(error.message)
    }
    challenge.completedCount += 1
    challenge.completedByMe = true
  }

  return { activities, loadActivities, saveActivity, deleteActivity, toggleHelpful, completeChallenge }
}
