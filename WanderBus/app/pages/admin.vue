
<script setup>
import { ref, onMounted } from 'vue'

const { $supabase } = useNuxtApp()

const isAdmin = ref(false)
const loading = ref(true)

// PHOTO APPROVALS
const pendingPhotos = ref([])
const photosLoading = ref(false)
const reviewingId = ref(null)

// ANALYTICS
const analyticsLoading = ref(false)
const analyticsError = ref('')
const selectedMonth = ref(new Date().toISOString().slice(0, 7))

const analytics = ref({
  spins: 0,
  entries: 0,
  soloSpins: 0,
  groupSpins: 0,
  soloEntries: 0,
  groupEntries: 0
})

onMounted(async () => {
  try {
    const { data: { user }, error: userError } =
      await $supabase.auth.getUser()

    if (userError || !user) return

    const { data, error } = await $supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error

    isAdmin.value = !!data

    if (isAdmin.value) {
      await Promise.all([
        fetchPendingPhotos(),
        fetchAnalytics()
      ])
    }
  } catch (error) {
    console.error('Admin loading error:', error)
  } finally {
    loading.value = false
  }
})

// LOAD PENDING PHOTOS
async function fetchPendingPhotos() {
  photosLoading.value = true

  try {
    const { data, error } = await $supabase
      .from('place_photos')
      .select('id, place_name, path, user_id, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error

    pendingPhotos.value = await Promise.all(
      (data ?? []).map(async (photo) => {
        const { data: signed, error: urlError } =
          await $supabase.storage
            .from('place-photos')
            .createSignedUrl(photo.path, 600)

        return {
          ...photo,
          url: urlError ? null : signed.signedUrl
        }
      })
    )
  } catch (error) {
    console.error('Photo loading error:', error)
    alert('Failed to load pending photos.')
  } finally {
    photosLoading.value = false
  }
}

// APPROVE PHOTO
async function approvePhoto(photo) {
  reviewingId.value = photo.id

  try {
    const { data, error } = await $supabase
      .from('place_photos')
      .update({ status: 'approved' })
      .eq('id', photo.id)
      .eq('status', 'pending')
      .select('id, is_pioneer')

    if (error) throw error
    if (!data?.length) throw new Error('Photo is no longer pending')

    await fetchPendingPhotos()

    alert(data[0].is_pioneer
      ? 'Photo approved! Pioneer awarded 100 credits.'
      : 'Photo approved!')
  } catch (error) {
    console.error('Approval error:', error)
    alert('Failed to approve photo: ' + error.message)
  } finally {
    reviewingId.value = null
  }
}

// REJECT PHOTO
async function rejectPhoto(photo) {
  if (!confirm(`Reject photo for ${photo.place_name}?`)) return

  reviewingId.value = photo.id

  try {
    // Mark rejected first so it cannot appear publicly
    const { data, error: updateError } = await $supabase
      .from('place_photos')
      .update({ status: 'rejected' })
      .eq('id', photo.id)
      .eq('status', 'pending')
      .select('id')

    if (updateError) throw updateError
    if (!data?.length) throw new Error('Photo is no longer pending')

    // Remove image from storage
    const { error: storageError } = await $supabase.storage
      .from('place-photos')
      .remove([photo.path])

    if (storageError) throw storageError

    // Remove database record
    const { error: deleteError } = await $supabase
      .from('place_photos')
      .delete()
      .eq('id', photo.id)

    if (deleteError) throw deleteError

    await fetchPendingPhotos()
    alert('Photo rejected and deleted!')
  } catch (error) {
    console.error('Rejection error:', error)
    alert('Rejection incomplete: ' + error.message)
    await fetchPendingPhotos()
  } finally {
    reviewingId.value = null
  }
}

// LOAD MONTHLY ANALYTICS
async function fetchAnalytics() {
  analyticsLoading.value = true
  analyticsError.value = ''

  try {
    const [year, month] = selectedMonth.value.split('-').map(Number)
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString()
    const end = new Date(Date.UTC(year, month, 1)).toISOString()

    const { data, error } = await $supabase
      .from('analytics_events')
      .select('event_type, trip_type')
      .gte('created_at', start)
      .lt('created_at', end)

    if (error) throw error

    const events = data ?? []

    analytics.value = {
      spins: events.filter(e => e.event_type === 'spin').length,
      entries: events.filter(e => e.event_type === 'passport_entry').length,
      soloSpins: events.filter(e => e.event_type === 'spin' && e.trip_type === 'solo').length,
      groupSpins: events.filter(e => e.event_type === 'spin' && e.trip_type === 'group').length,
      soloEntries: events.filter(e => e.event_type === 'passport_entry' && e.trip_type === 'solo').length,
      groupEntries: events.filter(e => e.event_type === 'passport_entry' && e.trip_type === 'group').length
    }
  } catch (error) {
    console.error('Analytics error:', error)
    analyticsError.value = error.message || 'Failed to load analytics'
  } finally {
    analyticsLoading.value = false
  }
}
</script>



<template>
  <div class="container py-5">

    <div v-if="loading" class="text-center">
      <p>Checking admin access...</p>
    </div>

    <div v-else-if="!isAdmin" class="text-center">
      <h2>Access Denied</h2>
      <p>You do not have permission to view this page.</p>
      <NuxtLink to="/home" class="btn btn-primary">
        Back to Home
      </NuxtLink>
    </div>

    <div v-else>
      <h1 class="mb-4">🚌 WanderBus Admin Dashboard</h1>

      <div class="alert alert-success">
        Welcome, Admin! You have successfully logged in.
      </div>

      <div class="row g-4">

        <!-- PHOTO APPROVALS -->
        <div class="col-md-6">
          <div class="card p-4 h-100">
            <h4>📸 Photo Approvals</h4>
            <p>Review user-submitted amenity photos.</p>

            <p v-if="photosLoading">Loading submissions...</p>

            <p v-else-if="pendingPhotos.length === 0">
              No pending photos.
            </p>

            <div
              v-for="photo in pendingPhotos"
              :key="photo.id"
              class="border rounded p-3 mb-3"
            >
              <h5>{{ photo.place_name }}</h5>

              <img
                v-if="photo.url"
                :src="photo.url"
                alt="Submitted amenity photo"
                class="img-fluid rounded mb-3"
                style="max-height: 200px;"
              />

              <p v-else class="text-muted">
                Preview unavailable
              </p>

              <div class="d-flex gap-2">
                <button
                  class="btn btn-success"
                  :disabled="reviewingId !== null"
                  @click="approvePhoto(photo)"
                >
                  Approve
                </button>

                <button
                  class="btn btn-danger"
                  :disabled="reviewingId !== null"
                  @click="rejectPhoto(photo)"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- APP ANALYTICS -->
        <div class="col-md-6">
          <div class="card p-4 h-100">
            <h4>📊 App Analytics</h4>
            <p>Monthly activity overview</p>

            <div class="d-flex gap-2 mb-3">
              <input
                v-model="selectedMonth"
                type="month"
                class="form-control"
                @change="fetchAnalytics"
              />

              <button
                class="btn btn-outline-primary"
                :disabled="analyticsLoading"
                @click="fetchAnalytics"
              >
                Refresh
              </button>
            </div>

            <p v-if="analyticsLoading">
              Loading analytics...
            </p>

            <p v-else-if="analyticsError" class="text-danger">
              {{ analyticsError }}
            </p>

            <div v-else class="row g-3">

              <div class="col-6">
                <div class="border rounded p-3">
                  <small>Monthly Spins</small>
                  <h2>{{ analytics.spins }}</h2>
                </div>
              </div>

              <div class="col-6">
                <div class="border rounded p-3">
                  <small>Passport Entries</small>
                  <h2>{{ analytics.entries }}</h2>
                </div>
              </div>

              <div class="col-6">
                <div class="border rounded p-3">
                  <small>Solo Spins</small>
                  <h2>{{ analytics.soloSpins }}</h2>
                </div>
              </div>

              <div class="col-6">
                <div class="border rounded p-3">
                  <small>Group Spins</small>
                  <h2>{{ analytics.groupSpins }}</h2>
                </div>
              </div>

              <div class="col-6">
                <div class="border rounded p-3">
                  <small>Solo Entries</small>
                  <h2>{{ analytics.soloEntries }}</h2>
                </div>
              </div>

              <div class="col-6">
                <div class="border rounded p-3">
                  <small>Group Entries</small>
                  <h2>{{ analytics.groupEntries }}</h2>
                </div>
              </div>

            </div>

            <small class="text-muted mt-3">
              Counts tracked events only. Historical and untracked activity is excluded.
            </small>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
