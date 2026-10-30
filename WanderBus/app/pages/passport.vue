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
              <!-- Photo (only if a link exists) -->
              <div v-if="trip.photoLink" class="col-sm-4 bg-dark">
                <img
                  :src="trip.photoLink"
                  class="img-fluid w-100 h-100 object-fit-cover"
                  alt="Trip Photo"
                  style="min-height: 200px;"
                  @error="handleImageError"
                />
              </div>

              <!-- Content -->
              <div :class="trip.photoLink ? 'col-sm-8' : 'col-12'">
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

                      <!-- REPLACE MANUAL PHOTO URL INPUT WITH FILE EXPLORER PICKER -->
                      <div class="mb-3">
                        <label class="form-label fw-semibold d-block">Trip Photo</label>
                        
                        <!-- Hidden file input triggered via ref -->
                        <input
                          type="file"
                          :ref="el => fileInputs[trip.id] = el"
                          accept="image/*"
                          class="d-none"
                          @change="(e) => handleFileSelection(e)"
                        />

                        <!-- Trigger Button -->
                        <button
                          type="button"
                          class="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2 py-2"
                          @click="fileInputs[trip.id]?.click()"
                        >
                          <span>📁</span> {{ draft.photoLink ? 'Change Selected Photo' : 'Choose Image from Device' }}
                        </button>

                        <!-- Preview selected photo inside draft -->
                        <div v-if="draft.photoLink" class="mt-2 text-center position-relative">
                          <img
                            :src="draft.photoLink"
                            alt="Selected preview"
                            class="img-thumbnail rounded"
                            style="max-height: 140px; object-fit: cover;"
                          />
                          <button
                            type="button"
                            class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 rounded-circle p-1 lh-1"
                            title="Remove image"
                            @click="draft.photoLink = ''"
                          >
                            ✕
                          </button>
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

// check session validity
definePageMeta({ middleware: 'auth' })

// Saved log cards: shared state from useTrips(), filled from Home and Supabase.
const { trips: savedTrips, loadTrips, updateTrip, removeTrip: deleteTrip } = useTrips()

// fetch this user's saved trips from Supabase when the page opens
onMounted(() => loadTrips())

// Edit state
const editingId = ref(null)
const fileInputs = ref({})

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
  draft.date = trip.date
  draft.memories = trip.memories
  draft.photoLink = trip.photoLink || ''
  draft.isPublic = trip.isPublic
}

const cancelEdit = () => {
  editingId.value = null
}

// Convert chosen file from file explorer into base64 image data URL
// Automatically resizes and compresses device photos so they fit in Supabase seamlessly
const handleFileSelection = (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.src = e.target.result

    img.onload = () => {
      // 1. Create a hidden canvas to resize the image
      const canvas = document.createElement('canvas')
      const MAX_WIDTH = 600
      const scaleSize = MAX_WIDTH / img.width
      
      canvas.width = MAX_WIDTH
      canvas.height = img.height * scaleSize

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // 2. Export as lightweight JPEG (quality 0.7)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7)
      
      // 3. Assign compressed image string to draft
      draft.photoLink = compressedBase64
    }
  }
  reader.readAsDataURL(file)
}

const saveEdit = async (id) => {
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

const handleImageError = (e) => {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.bg-teal {
  background-color: #1b7a86 !important;
}

.object-fit-cover {
  object-fit: cover;
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
  max-height: 600px;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>