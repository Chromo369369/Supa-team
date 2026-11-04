<template>
  <div class="passport-page">
    <div class="row justify-content-center g-0">
      <div class="col-lg-8 col-md-10">
        <header class="passport-head">
          <h1 class="passport-title">Your passport</h1>
          <div class="passport-meta">
            <span v-if="!loading && !loadError" class="trip-count">
              <span class="num">{{ savedTrips.length }}</span> {{ savedTrips.length === 1 ? 'trip' : 'trips' }}
            </span>
            <span v-if="credits !== null" class="credits-pill">
              <i class="bi bi-trophy" aria-hidden="true"></i>
              <span><span class="num">{{ credits }}</span> Pioneer credits</span>
            </span>
          </div>
        </header>

        <div class="d-flex flex-column gap-4">

          <!-- Loading state -->
          <div v-if="loading" class="state-block" role="status">
            <p class="mb-0">Loading your passport…</p>
          </div>

          <!-- Load error (CHANGED: previously only logged to the console) -->
          <div v-else-if="loadError" class="state-block state-error" role="alert">
            <p class="mb-0">Couldn’t load your trips: {{ loadError }}</p>
            <button type="button" class="btn-wb-secondary btn-sm" @click="loadTrips">
              <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
              Try again
            </button>
          </div>

          <!-- Empty state (Tier 1 adds the mascot) -->
          <div v-else-if="savedTrips.length === 0" class="state-block state-empty">
            <i class="bi bi-journal-bookmark empty-icon" aria-hidden="true"></i>
            <p class="mb-0">Your first stamp is one spin away.</p>
            <NuxtLink to="/home" class="btn-wb-primary">Spin a trip</NuxtLink>
          </div>

          <!-- Log cards -->
          <article
            v-for="trip in savedTrips"
            :key="trip.id"
            class="trip-card"
          >
            <div class="row g-0">
              <!-- Photo Display -->
              <div v-if="hasPhoto(trip)" class="col-sm-4 photo-col">
                <img
                  :src="trip.photo_url"
                  class="trip-photo"
                  :alt="`Your photo from ${trip.end_stop || 'this trip'}`"
                  width="400"
                  height="300"
                  loading="lazy"
                  decoding="async"
                  @error="failedPhotos[trip.id] = true"
                />
              </div>

              <!-- Content -->
              <div :class="hasPhoto(trip) ? 'col-sm-8' : 'col-12'">
                <div class="trip-body">

                  <!-- Top row: bus badge + date (CHANGED: uses isBus) -->
                  <div class="trip-top">
                    <span class="mode-chip">
                      <i :class="['bi', isBus(trip) ? 'bi-bus-front' : 'bi-person-walking']" aria-hidden="true"></i>
                      <span v-if="isBus(trip)">Bus <span class="num">{{ trip.bus_taken }}</span></span>
                      <span v-else>Walk</span>
                    </span>
                    <time class="trip-date num" :datetime="trip.entry_time">{{ formatDate(trip.entry_time) }}</time>
                  </div>

                  <!-- CHANGED: Journey timeline (replaces the paragraph) -->
                  <ol class="journey">
                    <li class="journey-step">
                      <span class="journey-dot"><i class="bi bi-geo-alt-fill" aria-hidden="true"></i></span>
                      <div>
                        <div class="journey-label">Started from</div>
                        <div class="journey-value">{{ trip.starting_location || 'Your starting point' }}</div>
                      </div>
                    </li>

                    <template v-if="isBus(trip)">
                      <li class="journey-step">
                        <span class="journey-dot"><i class="bi bi-person-walking" aria-hidden="true"></i></span>
                        <div>
                          <div class="journey-label">Walked to</div>
                          <div class="journey-value">{{ trip.starting_stop || 'the bus stop' }}</div>
                        </div>
                      </li>

                      <li class="journey-step">
                        <span class="journey-dot bus"><i class="bi bi-bus-front" aria-hidden="true"></i></span>
                        <div>
                          <div class="journey-label">Took bus</div>
                          <div class="journey-value"><span class="bus-pill num">{{ trip.bus_taken }}</span></div>
                        </div>
                      </li>
                    </template>

                    <li class="journey-step">
                      <span class="journey-dot end"><i class="bi bi-flag-fill" aria-hidden="true"></i></span>
                      <div>
                        <div class="journey-label">{{ isBus(trip) ? 'Arrived at' : 'Walked to' }}</div>
                        <div class="journey-value">{{ trip.end_stop || 'Your destination' }}</div>
                      </div>
                    </li>
                  </ol>

                  <!-- CHANGED: start -> estimated arrival strip (replaces the clock chips) -->
                  <div v-if="trip.entry_time" class="time-strip">
                    <div>
                      <div class="journey-label">Started</div>
                      <div class="time-big num">{{ formatTime(trip.entry_time) }}</div>
                    </div>

                    <div class="time-mid">
                      <span class="time-line" aria-hidden="true"></span>
                      <span class="chip num">
                        <i class="bi bi-stopwatch" aria-hidden="true"></i>
                        <span class="visually-hidden">Took</span>
                        {{ formatDuration(trip.time_taken) }}
                      </span>
                      <span class="time-line" aria-hidden="true"></span>
                    </div>

                    <div class="text-end">
                      <div class="journey-label">Est. arrival</div>
                      <div class="time-big num">{{ arrivalTime(trip) }}</div>
                    </div>
                  </div>

                  <!-- Display User Notes/Memories -->
                  <div v-if="trip.entry_notes" class="trip-notes">
                    <p class="journey-label mb-1">Your notes</p>
                    <p class="note hand mb-0">{{ trip.entry_notes }}</p>
                  </div>

                  <!-- Expandable Edit Form (grid-rows expand, §2.7) -->
                  <transition name="expand">
                    <div v-if="editingId === trip.id" class="expand">
                      <div class="expand-inner">
                        <form
                          :id="`edit-${trip.id}`"
                          class="edit-well"
                          @submit.prevent="saveEdit(trip.id)"
                          @paste="onPaste"
                        >
                          <div class="mb-3">
                            <label :for="`notes-${trip.id}`" class="form-label field-label">Your notes</label>
                            <textarea
                              :id="`notes-${trip.id}`"
                              v-model="draft.entry_notes"
                              class="form-control notes-input"
                              rows="3"
                              placeholder="How was the trip?"
                            ></textarea>
                          </div>

                          <!-- Image Upload Picker: a real button opens the hidden file input -->
                          <div class="mb-3">
                            <p class="field-label mb-2">Trip photo</p>

                            <input
                              :ref="setFileInput"
                              type="file"
                              :id="`photo-${trip.id}`"
                              accept="image/*"
                              class="visually-hidden"
                              tabindex="-1"
                              aria-hidden="true"
                              @change="onFilePicked"
                            />
                            <button
                              type="button"
                              class="btn-wb-secondary photo-btn"
                              :disabled="photoBusy"
                              :aria-busy="photoBusy ? 'true' : 'false'"
                              :aria-describedby="photoError ? `photo-help-${trip.id} photo-error-${trip.id}` : `photo-help-${trip.id}`"
                              @click="pickPhoto"
                            >
                              <template v-if="photoBusy">Processing photo…</template>
                              <template v-else>
                                <i class="bi bi-camera" aria-hidden="true"></i>
                                {{ draft.photo_url ? 'Replace photo' : 'Add photo' }}
                              </template>
                            </button>
                            <div :id="`photo-help-${trip.id}`" class="form-text field-help">You can also paste a copied image (Ctrl/Cmd + V).</div>

                            <div v-if="photoError" :id="`photo-error-${trip.id}`" class="wb-field-error" role="alert">{{ photoError }}</div>

                            <!-- Preview of the selected photo -->
                            <div v-if="draft.photo_url" class="photo-preview mt-3">
                              <img :src="draft.photo_url" :alt="`New photo for ${trip.end_stop || 'this trip'}`" width="640" height="400" />
                              <button
                                type="button"
                                class="photo-remove"
                                aria-label="Remove photo"
                                @click="clearPhoto"
                              ><i class="bi bi-x-lg" aria-hidden="true"></i></button>
                            </div>
                          </div>

                          <div class="d-flex flex-wrap gap-2">
                            <button
                              type="submit"
                              class="btn-wb-primary"
                              :disabled="saving || photoBusy"
                              :aria-busy="saving ? 'true' : 'false'"
                            >
                              {{ saving ? 'Saving…' : 'Save changes' }}
                            </button>
                            <button type="button" class="btn-wb-secondary" @click="cancelEdit">
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </transition>

                  <!-- Card Action Buttons -->
                  <div class="trip-actions">
                    <button
                      type="button"
                      class="btn-wb-ghost btn-sm"
                      :aria-expanded="editingId === trip.id ? 'true' : 'false'"
                      :aria-controls="`edit-${trip.id}`"
                      @click="toggleEdit(trip)"
                    >
                      <i :class="['bi', editingId === trip.id ? 'bi-x-lg' : 'bi-pencil']" aria-hidden="true"></i>
                      {{ editingId === trip.id ? 'Close editor' : 'Edit' }}
                    </button>

                    <button
                      type="button"
                      class="btn-wb-ghost btn-sm trip-delete"
                      @click="removeTrip(trip.id)"
                    >
                      <i class="bi bi-trash3" aria-hidden="true"></i>
                      Delete trip
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </article>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

definePageMeta({ middleware: 'auth' })

const { $supabase } = useNuxtApp()
const toast = useToast()            // REDESIGN: replaces alert()
const { confirm } = useConfirm()    // REDESIGN: replaces native confirm()

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

const toggleEdit = async (trip) => {
  if (editingId.value === trip.id) {
    cancelEdit()
    return
  }
  // opening another card closes the current editor, so guard its changes too
  if (!(await confirmDiscard())) return
  editingId.value = trip.id
  photoError.value = ''
  draft.entry_notes = trip.entry_notes || ''
  draft.photo_url = trip.photo_url || ''
}

// Unsaved-edit guard: only asks when the draft differs from the saved entry
const hasUnsavedEdits = () => {
  const trip = savedTrips.value.find(t => t.id === editingId.value)
  if (!trip) return false
  return draft.entry_notes !== (trip.entry_notes || '') || draft.photo_url !== (trip.photo_url || '')
}

const confirmDiscard = async () => {
  if (!hasUnsavedEdits()) return true
  return confirm({
    title: 'Discard your changes?',
    body: 'Your edits to this trip haven’t been saved.',
    confirmLabel: 'Discard changes',
    cancelLabel: 'Keep editing'
  })
}

const cancelEdit = async () => {
  if (!(await confirmDiscard())) return
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
    toast.success('Changes saved to your passport.')
  } catch (err) {
    toast.error('Couldn’t save your changes: ' + err.message, {
      action: { label: 'Retry', run: () => saveEdit(id) }
    })
  } finally {
    saving.value = false
  }
}

// DELETE: Remove record from `passport_entries`
// CHANGED: .select() + empty-result check so a blocked delete (RLS) is not silent
const removeTrip = async (id) => {
  const stop = savedTrips.value.find(t => t.id === id)?.end_stop
  if (!(await confirm({
    title: stop ? `Delete your trip to ${stop}?` : 'Delete this trip?',
    body: 'Your notes and photo for this trip will be gone for good.',
    confirmLabel: 'Delete trip'
  }))) return

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
    toast.success(stop ? `Trip to ${stop} deleted.` : 'Trip deleted.')
  } catch (err) {
    toast.error('Couldn’t delete that trip: ' + err.message)
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

// REDESIGN: the visible "Add photo" button opens the hidden file input
const fileInput = ref(null)
const setFileInput = (el) => { fileInput.value = el }
const pickPhoto = () => fileInput.value?.click()

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
    photoError.value = 'Choose an image file, like a JPG, PNG or WEBP.'
    return
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    photoError.value = `That image is over ${MAX_FILE_MB} MB. Pick a smaller one.`
    return
  }
  photoBusy.value = true
  try {
    draft.photo_url = await compressImage(file)
  } catch {
    photoError.value = 'Couldn’t read that image. If it’s a HEIC photo, convert it to JPG first.'
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
/* All colour, type and space come from tokens in main.css (§2). */
.passport-page {
  min-height: 100%;
  padding: var(--sp-6) var(--gutter) var(--sp-8);
  background: var(--wb-ground);
}

/* ── Header ── */
.passport-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-5);
}
.passport-title {
  margin: 0;
  font-size: var(--fs-title);
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.passport-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
}
.trip-count {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}
.credits-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 36px;
  padding: var(--sp-1) var(--sp-4);
  border-radius: var(--r-pill);
  background: var(--wb-amber-tint);
  color: var(--wb-amber-ink);
  font-size: var(--fs-small);
  font-weight: 500;
}

/* ── Loading / error / empty ── */
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-7) var(--sp-5);
  border-radius: var(--r-card);
  background: var(--wb-surface);
  color: var(--wb-text-2);
  text-align: center;
}
.state-error {
  background: var(--wb-danger-bg);
  color: var(--wb-danger);
}
.state-empty {
  color: var(--wb-ink);
  font-size: var(--fs-lead);
}
.empty-icon {
  font-size: 24px;
  color: var(--wb-text-2);
}

/* ── Trip card: surface on ground, separated by tone alone ── */
.trip-card {
  overflow: hidden;
  border-radius: var(--r-card);
  background: var(--wb-surface);
}
.trip-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  height: 100%;
  padding: var(--sp-5);
}
.trip-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.mode-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-1) var(--sp-3);
  border-radius: var(--r-pill);
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  font-size: var(--fs-small);
  font-weight: 500;
}
.trip-date {
  color: var(--wb-muted);
  font-size: var(--fs-small);
}

/* Photo: fixed ratio on phones, fills the column height from sm up */
.photo-col {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--wb-surface-2);
}
@media (min-width: 576px) {
  .photo-col {
    aspect-ratio: auto;
    min-height: 220px;
  }
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

/* ── Journey timeline ── */
.journey {
  list-style: none;
  margin: 0;
  padding: 0;
}
.journey-step {
  position: relative;
  display: flex;
  gap: var(--sp-3);
  padding-bottom: var(--sp-4);
}
.journey-step:not(:last-child)::before {
  /* the route line between stops */
  content: '';
  position: absolute;
  left: 17px;
  top: 40px;
  bottom: var(--sp-1);
  border-left: 2px dashed var(--wb-control);
}
.journey-step:last-child {
  padding-bottom: 0;
}
.journey-step > div {
  min-width: 0;
}
.journey-dot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--wb-surface-2);
  color: var(--wb-text-2);
  font-size: 16px;
}
.journey-dot.bus {
  background: var(--wb-ink);
  color: var(--wb-on-ink);
}
.journey-dot.end {
  background: var(--wb-amber);
  color: var(--wb-ink);
}
.journey-label {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}
.journey-value {
  color: var(--wb-ink);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.bus-pill {
  display: inline-block;
  padding: 2px var(--sp-3);
  border-radius: var(--r-pill);
  background: var(--wb-ink);
  color: var(--wb-on-ink);
  font-weight: 600;
}

/* ── Start → arrival strip: one tone step down ── */
.time-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}
.time-big {
  color: var(--wb-ink);
  font-size: var(--fs-lead);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}
.time-mid {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  min-width: 0;
}
.time-line {
  flex: 1;
  border-top: 2px dashed var(--wb-control);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-3);
  border-radius: var(--r-pill);
  background: var(--wb-surface);
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  white-space: nowrap;
}
@media (max-width: 400px) {
  .time-line { display: none; }
  .time-strip { padding: var(--sp-3); gap: var(--sp-2); }
  .time-big { font-size: var(--fs-body); }
}

/* ── Notes: the user's own handwriting ── */
.note {
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

/* ── Expandable editor: grid-rows 0fr → 1fr + opacity (§2.7) ── */
.expand {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
}
.expand-inner {
  min-height: 0;
  overflow: hidden;
}
.expand-enter-active,
.expand-leave-active {
  transition: grid-template-rows var(--t-ui) var(--ease), opacity var(--t-ui) var(--ease);
}
.expand-enter-from,
.expand-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.edit-well {
  padding: var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}
.field-label {
  color: var(--wb-ink);
  font-weight: 500;
}
.field-help {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}
.form-control {
  border-color: var(--wb-control);
  border-radius: var(--r-control);
  background: var(--wb-surface);
  color: var(--wb-ink);
}
.form-control:focus {
  border-color: var(--wb-green);
  box-shadow: none; /* taste-skill-ignore: removes Bootstrap focus glow, no shadow added */
  outline: 3px solid var(--wb-green-tint);
  outline-offset: 0;
}
.notes-input {
  font-family: var(--font-hand);
  font-size: 1.375rem;
  line-height: 1.25;
}

.photo-btn {
  width: 100%;
}

.photo-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: var(--r-control);
  overflow: hidden;
  background: var(--wb-surface);
}
.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.photo-remove {
  position: absolute;
  top: var(--sp-2);
  right: var(--sp-2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: var(--wb-ink);
  color: var(--wb-on-ink);
  font-size: 16px;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform var(--t-micro) var(--ease);
}
.photo-remove:hover {
  transform: scale(1.05);
}
.photo-remove:focus-visible {
  outline: 3px solid var(--wb-amber);
  outline-offset: 2px;
}

/* ── Card actions ── */
.trip-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-top: auto;
  /* pull ghost buttons to the text edge */
  margin-inline: calc(var(--sp-3) * -1);
}
.trip-delete {
  color: var(--wb-danger);
}
.trip-delete:hover {
  background: var(--wb-danger-bg);
  color: var(--wb-danger);
}
</style>
