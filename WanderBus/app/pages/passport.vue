<template>
  <div class="container-fluid py-4 px-md-5 bg-light min-vh-100">
    <div class="row justify-content-center">
      <div class="col-lg-8 col-md-10">
        <h2 class="fw-bold mb-4">Your Digital Passport Entries</h2>

        <div class="d-flex flex-column gap-3">

          <!-- Empty state -->
          <div
            v-if="savedTrips.length === 0"
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
              <!-- Photo (only if there is a photo and it loads) -->
              <div v-if="hasPhoto(trip)" class="col-sm-4 photo-col">
                <img
                  :src="trip.photoLink"
                  class="trip-photo"
                  alt="Trip Photo"
                  loading="lazy"
                  @error="failedPhotos[trip.id] = true"
                />
              </div>

              <!-- Content -->
              <div :class="hasPhoto(trip) ? 'col-sm-8' : 'col-12'">
                <div class="card-body p-4 d-flex flex-column h-100">

                  <!-- Top row: bus badge + date -->
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-teal rounded-pill px-3 py-2">{{ trip.busService ? `Bus ${trip.busService}` : 'Walk' }}</span>
                    <span class="text-muted small">{{ trip.date }}</span>
                  </div>

                  <!-- Main info (bus stop / bus service are not editable) -->
                  <h4 class="card-title fw-bold mb-2">{{ trip.busStop?.name }}</h4>
                  <p class="card-text text-secondary">{{ trip.memories }}</p>

                  <!-- Privacy status -->
                  <div class="mb-3">
                    <span
                      class="badge px-3 py-2 rounded-pill"
                      :class="trip.isPublic ? 'bg-success' : 'bg-secondary'"
                    >
                      {{ trip.isPublic ? 'Public Shared' : 'Private Keepsake' }}
                    </span>
                  </div>

                  <!-- Expandable edit form -->
                  <transition name="expand">
                    <form
                      v-if="editingId === trip.id"
                      class="border rounded-3 p-3 mb-3 bg-light"
                      @submit.prevent="saveEdit(trip.id)"
                      @paste="onPaste"
                    >
                      <div class="mb-3">
                        <label :for="`date-${trip.id}`" class="form-label fw-semibold">Date</label>
                        <input
                          type="date"
                          :id="`date-${trip.id}`"
                          v-model="draft.date"
                          class="form-control"
                          required
                        />
                      </div>

                      <div class="mb-3">
                        <label :for="`memories-${trip.id}`" class="form-label fw-semibold">Memories / Thoughts</label>
                        <textarea
                          :id="`memories-${trip.id}`"
                          v-model="draft.memories"
                          class="form-control"
                          rows="3"
                          placeholder="How was the ride?"
                        ></textarea>
                      </div>

                      <div class="mb-3">
                        <label class="form-label fw-semibold">Trip Photo</label>

                        <!-- Hidden file input; the label below acts as the button -->
                        <input
                          type="file"
                          :id="`photo-${trip.id}`"
                          accept="image/*"
                          class="d-none"
                          @change="onFilePicked"
                        />
                        <label :for="`photo-${trip.id}`" class="btn btn-photo w-100" :class="{ disabled: photoBusy }">
                          <span v-if="photoBusy">⏳ Processing photo…</span>
                          <span v-else>📁 {{ draft.photoLink ? 'Change Selected Photo' : 'Choose Image from Device' }}</span>
                        </label>
                        <div class="form-text">You can also paste a copied image (Ctrl/Cmd + V).</div>

                        <div v-if="photoError" class="text-danger small mt-2">{{ photoError }}</div>

                        <!-- Preview of the selected photo -->
                        <div v-if="draft.photoLink" class="photo-preview mt-3">
                          <img :src="draft.photoLink" alt="Selected photo preview" />
                          <button
                            type="button"
                            class="photo-remove"
                            aria-label="Remove photo"
                            @click="clearPhoto"
                          >✕</button>
                        </div>
                      </div>

                      <div class="mb-3 form-check">
                        <input
                          type="checkbox"
                          :id="`public-${trip.id}`"
                          v-model="draft.isPublic"
                          class="form-check-input"
                        />
                        <label class="form-check-label text-muted small" :for="`public-${trip.id}`">
                          Share publicly to app feed to earn collectible
                        </label>
                      </div>

                      <div class="d-flex gap-2">
                        <button type="submit" class="btn btn-save text-white fw-bold">Save Changes</button>
                        <button type="button" class="btn btn-outline-secondary rounded-pill px-4" @click="cancelEdit">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </transition>

                  <!-- Footer actions: Edit (left) / Remove Card (bottom right) -->
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
                      Remove Card
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

// check session validity
definePageMeta({ middleware: 'auth' })

// Saved log cards: shared state from useTrips(), filled from Home and Supabase.
const { trips: savedTrips, loadTrips, updateTrip, removeTrip: deleteTrip } = useTrips()

// fetch this user's saved trips from Supabase when the page opens
onMounted(() => loadTrips())

// Edit state
const editingId = ref(null)
const draft = reactive({
  date: '',
  memories: '',
  photoLink: '',
  isPublic: false
})

const toggleEdit = (trip) => {
  // Clicking Edit on the open card closes it
  if (editingId.value === trip.id) {
    cancelEdit()
    return
  }
  // Only one card is edited at a time; copy values into the draft
  editingId.value = trip.id
  photoError.value = ''
  draft.date = trip.date
  draft.memories = trip.memories
  draft.photoLink = trip.photoLink
  draft.isPublic = trip.isPublic
}

const cancelEdit = () => {
  editingId.value = null
}

const saveEdit = async (id) => {
  if (photoBusy.value) return
  delete failedPhotos[id]
  await updateTrip(id, {
    date: draft.date,
    memories: draft.memories,
    photoLink: draft.photoLink,
    isPublic: draft.isPublic
  })
  editingId.value = null
}

const removeTrip = async (id) => {
  if (editingId.value === id) editingId.value = null
  await deleteTrip(id)
}

// ---------- Photo upload ----------
const MAX_SIDE = 1280      // longest side in px after resizing
const JPEG_QUALITY = 0.8   // 0-1, balance of size vs sharpness
const MAX_FILE_MB = 20     // reject absurdly large originals

const photoError = ref('')
const photoBusy = ref(false)
const failedPhotos = reactive({})  // trip ids whose saved photo failed to load

const hasPhoto = (trip) => !!trip.photoLink && !failedPhotos[trip.id]

// Resize + compress so every photo is a tidy, consistent, small JPEG
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
      ctx.fillStyle = '#ffffff'            // so transparent PNGs don't turn black
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
    draft.photoLink = await compressImage(file)
  } catch {
    photoError.value = "Couldn't read that image. HEIC photos may need converting to JPG first."
  } finally {
    photoBusy.value = false
  }
}

const onFilePicked = async (e) => {
  await handleFile(e.target.files?.[0])
  e.target.value = ''   // lets the user pick the same file again
}

// Ctrl/Cmd+V with an image on the clipboard
const onPaste = async (e) => {
  const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'))
  if (!item) return
  e.preventDefault()
  await handleFile(item.getAsFile())
}

const clearPhoto = () => {
  draft.photoLink = ''
  photoError.value = ''
}
</script>

<style scoped>
.bg-teal {
  background-color: #1b7a86 !important;
}

/* Photo column on the card: fills the card height, cropped (never stretched) */
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

/* "Choose Image from Device" button */
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

/* Preview inside the edit form */
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

/* Green save button (same style as before) */
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

/* Edit button */
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

/* Red remove button, bottom right of card */
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

/* Smooth expand/collapse of the edit form */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  max-height: 900px;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>