<template>
  <div class="container-fluid py-4 px-md-5 bg-light min-vh-100">
    <div class="row justify-content-center">
      <div class="col-lg-8 col-md-10">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <h2 class="fw-bold mb-0">Your Digital Passport Entries</h2>
          <span v-if="credits !== null" class="badge rounded-pill credits-pill">🏅 {{ credits }} Pioneer credits</span>
        </div>

        <div class="d-flex flex-column gap-3">

          <!-- Loading state -->
          <div v-if="loading" class="text-center p-5 bg-white rounded-4 shadow-sm">
            <p class="mb-0 text-muted">Loading your passport entries...</p>
          </div>

          <!-- Load error (CHANGED: previously only logged to the console) -->
          <div v-else-if="loadError" class="alert alert-danger mb-0">
            Could not load your entries: {{ loadError }}
          </div>

          <!-- Empty state -->
          <div
            v-else-if="savedTrips.length === 0"
            class="text-center text-muted p-5 bg-white rounded-4 shadow-sm"
          >
            <p class="mb-0">No trips logged yet. Spin a side quest on Home to add one!</p>
          </div>

          <!-- Log cards -->
          <div
            v-for="trip in savedTrips"
            :key="trip.id"
            class="card shadow-sm border-0 rounded-4 overflow-hidden"
          >
            <div class="row g-0">
              <!-- Photo Display -->
              <div v-if="hasPhoto(trip)" class="col-sm-4 photo-col">
                <img
                  :src="trip.photo_url"
                  class="trip-photo"
                  alt="Trip Photo"
                  loading="lazy"
                  @error="failedPhotos[trip.id] = true"
                />
              </div>

              <!-- Content -->
              <div :class="hasPhoto(trip) ? 'col-sm-8' : 'col-12'">
                <div class="card-body p-4 d-flex flex-column h-100">

                  <!-- Top row: bus badge + date (CHANGED: uses isBus) -->
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge bg-teal rounded-pill px-3 py-2">
                      {{ isBus(trip) ? `Bus ${trip.bus_taken}` : 'Walk' }}
                    </span>
                    <span class="text-muted small">{{ formatDate(trip.entry_time) }}</span>
                  </div>

                  <!-- CHANGED: Journey timeline (replaces the paragraph) -->
                  <div class="journey mb-3">
                    <div class="journey-step">
                      <span class="journey-dot">📍</span>
                      <div>
                        <div class="journey-label">Started from</div>
                        <div class="journey-value">{{ trip.starting_location || 'Your starting point' }}</div>
                      </div>
                    </div>

                    <template v-if="isBus(trip)">
                      <div class="journey-step">
                        <span class="journey-dot">🚶</span>
                        <div>
                          <div class="journey-label">Walked to</div>
                          <div class="journey-value">{{ trip.starting_stop || 'the bus stop' }}</div>
                        </div>
                      </div>

                      <div class="journey-step">
                        <span class="journey-dot bus">🚌</span>
                        <div>
                          <div class="journey-label">Took bus</div>
                          <div class="journey-value"><span class="bus-pill">{{ trip.bus_taken }}</span></div>
                        </div>
                      </div>
                    </template>

                    <div class="journey-step">
                      <span class="journey-dot end">🏁</span>
                      <div>
                        <div class="journey-label">{{ isBus(trip) ? 'Arrived at' : 'Walked to' }}</div>
                        <div class="journey-value">{{ trip.end_stop || 'Your destination' }}</div>
                      </div>
                    </div>
                  </div>

                  <!-- CHANGED: start -> estimated arrival strip (replaces the clock chips) -->
                  <div v-if="trip.entry_time" class="time-strip mb-3">
                    <div>
                      <div class="journey-label">Started</div>
                      <div class="time-big">{{ formatTime(trip.entry_time) }}</div>
                    </div>

                    <div class="time-mid">
                      <span class="time-line"></span>
                      <span class="chip">{{ formatDuration(trip.time_taken) }}</span>
                      <span class="time-line"></span>
                    </div>

                    <div class="text-end">
                      <div class="journey-label">Est. arrival</div>
                      <div class="time-big">{{ arrivalTime(trip) }}</div>
                    </div>
                  </div>

                  <!-- Display User Notes/Memories -->
                  <div v-if="trip.entry_notes" class="mb-3">
                    <h6 class="fw-semibold text-secondary mb-1">Notes:</h6>
                    <p class="card-text text-secondary bg-white p-2 rounded border-sm">{{ trip.entry_notes }}</p>
                  </div>

                  <!-- Expandable Edit Form -->
                  <transition name="expand">
                    <form
                      v-if="editingId === trip.id"
                      class="border rounded-3 p-3 mb-3 bg-light"
                      @submit.prevent="saveEdit(trip.id)"
                      @paste="onPaste"
                    >
                      <div class="mb-3">
                        <label :for="`notes-${trip.id}`" class="form-label fw-semibold">Entry Notes / Thoughts</label>
                        <textarea
                          :id="`notes-${trip.id}`"
                          v-model="draft.entry_notes"
                          class="form-control"
                          rows="3"
                          placeholder="How was the trip?"
                        ></textarea>
                      </div>

                      <!-- Image Upload Picker -->
                      <div class="mb-3">
                        <label class="form-label fw-semibold">Trip Photo</label>

                        <input
                          type="file"
                          :id="`photo-${trip.id}`"
                          accept="image/*"
                          class="d-none"
                          @change="onFilePicked"
                        />
                        <label :for="`photo-${trip.id}`" class="btn btn-photo w-100" :class="{ disabled: photoBusy }">
                          <span v-if="photoBusy">⏳ Processing photo…</span>
                          <span v-else>📁 {{ draft.photo_url ? 'Change Selected Photo' : 'Choose Image from Device' }}</span>
                        </label>
                        <div class="form-text">You can also paste a copied image (Ctrl/Cmd + V).</div>

                        <div v-if="photoError" class="text-danger small mt-2">{{ photoError }}</div>

                        <!-- Preview of the selected photo -->
                        <div v-if="draft.photo_url" class="photo-preview mt-3">
                          <img :src="draft.photo_url" alt="Selected photo preview" />
                          <button
                            type="button"
                            class="photo-remove"
                            aria-label="Remove photo"
                            @click="clearPhoto"
                          >✕</button>
                        </div>
                      </div>

                      <div class="d-flex gap-2">
                        <button type="submit" class="btn btn-save text-white fw-bold" :disabled="saving">
                          {{ saving ? 'Saving...' : 'Save Changes' }}
                        </button>
                        <button type="button" class="btn btn-outline-secondary rounded-pill px-4" @click="cancelEdit">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </transition>

                  <!-- Card Action Buttons -->
                  <div class="mt-auto pt-2 d-flex justify-content-between align-items-center">
                    <button
                      type="button"
                      class="btn btn-edit"
                      @click="toggleEdit(trip)"
                    >
                      {{ editingId === trip.id ? 'Close' : '✏️ Edit' }}
                    </button>

                    <button
                      type="button"
                      class="btn btn-remove"
                      @click="removeTrip(trip.id)"
                    >
                      Remove Memory
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

definePageMeta({ middleware: 'auth' })

const { $supabase } = useNuxtApp()

const savedTrips = ref([])
const loading = ref(true)
const loadError = ref('')   // NEW: shown in the template if the read fails
const saving = ref(false)
const editingId = ref(null)

const draft = reactive({
  entry_notes: '',
  photo_url: ''
})

// READ: Fetch entries from Supabase `passport_entries`
const loadTrips = async () => {
  try {
    loading.value = true
    loadError.value = ''
    const { data, error } = await $supabase
      .from('passport_entries')
      .select('*')
      .order('entry_time', { ascending: false })

    if (error) throw error
    savedTrips.value = data || []
  } catch (err) {
    console.error('Error fetching passport entries:', err.message)
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}

// Pioneer credits (user_rewards only has a row once you've earned some)
const credits = ref(null)
const loadCredits = async () => {
  const { data, error } = await $supabase.from('user_rewards').select('credits').maybeSingle()
  if (error) {
    console.error('Error fetching credits:', error.message)
    return
  }
  credits.value = data?.credits ?? 0
}

onMounted(() => {
  loadTrips()
  loadCredits()
})

const toggleEdit = (trip) => {
  if (editingId.value === trip.id) {
    cancelEdit()
    return
  }
  editingId.value = trip.id
  photoError.value = ''
  draft.entry_notes = trip.entry_notes || ''
  draft.photo_url = trip.photo_url || ''
}

const cancelEdit = () => {
  editingId.value = null
}

// UPDATE: Save changes back to `passport_entries`
// CHANGED: .select() + empty-result check so a blocked update (RLS) is not silent
const saveEdit = async (id) => {
  if (photoBusy.value) return
  try {
    saving.value = true
    delete failedPhotos[id]

    const { data, error } = await $supabase
      .from('passport_entries')
      .update({
        entry_notes: draft.entry_notes,
        photo_url: draft.photo_url
      })
      .eq('id', id)
      .select()

    if (error) throw error
    if (!data?.length) throw new Error('No rows were updated (check the update policy / user_id)')

    await loadTrips()
    editingId.value = null
  } catch (err) {
    alert('Failed to save changes: ' + err.message)
  } finally {
    saving.value = false
  }
}

// DELETE: Remove record from `passport_entries`
// CHANGED: .select() + empty-result check so a blocked delete (RLS) is not silent
const removeTrip = async (id) => {
  if (!confirm('Are you sure you want to delete this passport entry?')) return

  try {
    const { data, error } = await $supabase
      .from('passport_entries')
      .delete()
      .eq('id', id)
      .select()

    if (error) throw error
    if (!data?.length) throw new Error('No rows were deleted (check the delete policy / user_id)')

    if (editingId.value === id) editingId.value = null
    await loadTrips()
  } catch (err) {
    alert('Failed to delete entry: ' + err.message)
  }
}

// ---------- Display helpers ----------
const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// NEW
const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) : ''

// NEW: start time + time_taken (minutes) = estimated arrival
const arrivalTime = (t) => {
  if (!t.entry_time || t.time_taken == null) return '-'
  const end = new Date(new Date(t.entry_time).getTime() + t.time_taken * 60000)
  return formatTime(end.toISOString())
}

// NEW: time_taken is stored in minutes
const formatDuration = (mins) => {
  if (mins == null) return '-'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

// NEW: true only when a real bus service was taken (empty / null / 'Walk' = walked)
const isBus = (t) => !!t.bus_taken && t.bus_taken !== 'Walk'

// ---------- Photo Upload & Compression ----------
const MAX_SIDE = 1280
const JPEG_QUALITY = 0.8
const MAX_FILE_MB = 20

const photoError = ref('')
const photoBusy = ref(false)
const failedPhotos = reactive({})

const hasPhoto = (trip) => !!trip.photo_url && !failedPhotos[trip.id]

const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('decode'))
    }
    img.src = objectUrl
  })

const handleFile = async (file) => {
  photoError.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    photoError.value = 'Please choose an image file (JPG, PNG, WEBP...).'
    return
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    photoError.value = `That image is too large (max ${MAX_FILE_MB} MB).`
    return
  }
  photoBusy.value = true
  try {
    draft.photo_url = await compressImage(file)
  } catch {
    photoError.value = "Couldn't read that image. HEIC photos may need converting to JPG first."
  } finally {
    photoBusy.value = false
  }
}

const onFilePicked = async (e) => {
  await handleFile(e.target.files?.[0])
  e.target.value = ''
}

const onPaste = async (e) => {
  const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'))
  if (!item) return
  e.preventDefault()
  await handleFile(item.getAsFile())
}

const clearPhoto = () => {
  draft.photo_url = ''
  photoError.value = ''
}
</script>

<style scoped>
.bg-teal {
  background-color: #1b7a86 !important;
}

.photo-col {
  position: relative;
  min-height: 220px;
  background: #e9ecef;
}
.trip-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

/* NEW: journey timeline */
.journey-step {
  position: relative;
  display: flex;
  gap: 14px;
  padding-bottom: 18px;
}
.journey-step:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 17px;
  top: 38px;
  bottom: 2px;
  border-left: 2px dashed #b9d9dd;
}
.journey-step:last-child {
  padding-bottom: 0;
}
.journey-dot {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e8f4f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}
.journey-dot.bus {
  background: #1b7a86;
}
.journey-dot.end {
  background: #e3f5ec;
}
.journey-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6c757d;
}
.journey-value {
  font-weight: 700;
  color: #141a33;
}
.bus-pill {
  display: inline-block;
  background: #1b7a86;
  color: #fff;
  border-radius: 50px;
  padding: 2px 14px;
  font-weight: 700;
}
.chip {
  background: #f1f3f5;
  border-radius: 50px;
  padding: 4px 12px;
  font-size: 0.85rem;
  color: #495057;
}

/* NEW: start -> arrival strip */
.time-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #f1f8f9;
  border-radius: 12px;
  padding: 12px 16px;
}
.time-big {
  font-size: 1.25rem;
  font-weight: 800;
  color: #141a33;
  line-height: 1.2;
}
.time-mid {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-line {
  flex: 1;
  border-top: 2px dashed #b9d9dd;
}

.btn-photo {
  background: #fff;
  border: 1px dashed #1b7a86;
  color: #1b7a86;
  border-radius: 12px;
  padding: 12px;
  font-weight: 600;
}
.btn-photo:hover {
  background: #1b7a86;
  color: #fff;
}

.photo-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 12px;
  overflow: hidden;
  background: #e9ecef;
}
.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.photo-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(220, 53, 69, 0.92);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.btn-save {
  background: #0b7a4b;
  border: none;
  border-radius: 50px;
  padding: 10px 22px;
  font-weight: 600;
  color: #fff;
}
.btn-save:hover {
  background: #095f3b;
  color: #fff;
}

.btn-edit {
  background: #fff;
  border: 1px solid #1b7a86;
  color: #1b7a86;
  border-radius: 50px;
  padding: 8px 20px;
  font-weight: 600;
}
.btn-edit:hover {
  background: #1b7a86;
  color: #fff;
}

.btn-remove {
  background: #dc3545;
  border: none;
  color: #fff;
  border-radius: 50px;
  padding: 8px 20px;
  font-weight: 600;
}
.btn-remove:hover {
  background: #b02a37;
  color: #fff;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  max-height: 1200px;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.credits-pill {
  background: #fdf3d7;
  color: #7a5200;
  font-size: 0.95rem;
  padding: 8px 14px;
}
</style>