<template>
  <div class="container py-4 px-md-5 bg-light min-vh-100">
    <div class="row justify-content-center">
      
      <!-- Center Column: Generated Log Cards -->
      <div class="col-lg-10 col-xl-8">
        <h2 class="fw-bold mb-4 text-center">Your Digital Passport Entries</h2>
        
        <div class="d-flex flex-column gap-3">
          
          <!-- Empty State -->
          <div v-if="savedTrips.length === 0" class="text-center text-muted p-5 bg-white rounded-4 shadow-sm">
            <p class="mb-0 fs-5">No trips logged yet. Spin a side quest on Home to add one!</p>
          </div>

          <!-- Dynamic Render of Saved Trips -->
          <div 
            v-for="(trip, index) in savedTrips" 
            :key="trip.id || index" 
            class="card shadow-sm border-0 rounded-4 overflow-hidden"
          >
            <!-- Normal Display View -->
            <div v-if="editingIndex !== index" class="row g-0 h-100">
              <!-- Left side: Image (Conditional) -->
              <div v-if="trip.photoLink" class="col-sm-4 bg-dark">
                <img :src="trip.photoLink" class="img-fluid w-100 h-100 object-fit-cover" alt="Trip Photo" style="min-height: 200px;" @error="handleImageError" />
              </div>
              
              <!-- Right side: Text Content -->
              <div :class="trip.photoLink ? 'col-sm-8' : 'col-12'">
                <div class="card-body p-4 d-flex flex-column h-100">
                  
                  <!-- Top Row: Badge, Date & Edit Button -->
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <span class="badge bg-teal rounded-pill px-3 py-2 me-2">Bus {{ trip.busService }}</span>
                      <span class="text-muted small">{{ trip.date }}</span>
                    </div>
                    <!-- Edit Button -->
                    <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" @click="startEditing(index)">
                      ✏️ Edit
                    </button>
                  </div>
                  
                  <!-- Main Info -->
                  <h4 class="card-title fw-bold mb-2">{{ trip.busStop.name }}</h4>
                  <p class="card-text text-secondary flex-grow-1 mb-3">
                    {{ trip.memories || 'No memories added yet. Click edit to add your notes!' }}
                  </p>
                  
                  <!-- Privacy Status -->
                  <div class="mt-auto pt-2">
                    <span 
                      class="badge px-3 py-2 rounded-pill"
                      :class="trip.isPublic ? 'bg-success' : 'bg-secondary'"
                    >
                      {{ trip.isPublic ? 'Public Shared' : 'Private Keepsake' }}
                    </span>
                  </div>

                </div>
              </div>
            </div>

            <!-- Inline Editing Form View -->
            <div v-else class="card-body p-4 bg-white">
              <h5 class="fw-bold mb-3">Edit Trip Details</h5>
              
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Bus Service</label>
                  <input type="text" v-model="editForm.busService" class="form-control form-control-sm" />
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Date</label>
                  <input type="date" v-model="editForm.date" class="form-control form-control-sm" />
                </div>
                <div class="col-12">
                  <label class="form-label small fw-semibold">Memories / Thoughts</label>
                  <textarea v-model="editForm.memories" class="form-control form-control-sm" rows="3" placeholder="Add ride details..."></textarea>
                </div>
                <div class="col-12">
                  <label class="form-label small fw-semibold">Photo Link</label>
                  <input type="url" v-model="editForm.photoLink" class="form-control form-control-sm" placeholder="https://..." />
                </div>
                <div class="col-12 form-check ms-2">
                  <input type="checkbox" id="editPublic" v-model="editForm.isPublic" class="form-check-input" />
                  <label class="form-check-label small text-muted" for="editPublic">Share publicly to feed</label>
                </div>
              </div>

              <div class="d-flex justify-content-end gap-2 mt-3">
                <button class="btn btn-sm btn-light" @click="cancelEditing">Cancel</button>
                <button class="btn btn-sm btn-teal text-white fw-bold" @click="saveEditing(index)">Save Changes</button>
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

// Shared trips array (auto-populated from home.vue)
const savedTrips = useTrips()

// Inline Editing state
const editingIndex = ref(null)
const editForm = reactive({
  date: '',
  busService: '',
  memories: '',
  photoLink: '',
  isPublic: false
})

const startEditing = (index) => {
  editingIndex.value = index
  const trip = savedTrips.value[index]
  editForm.date = trip.date
  editForm.busService = trip.busService
  editForm.memories = trip.memories
  editForm.photoLink = trip.photoLink
  editForm.isPublic = trip.isPublic
}

const cancelEditing = () => {
  editingIndex.value = null
}

const saveEditing = (index) => {
  savedTrips.value[index] = {
    ...savedTrips.value[index],
    date: editForm.date,
    busService: editForm.busService,
    memories: editForm.memories,
    photoLink: editForm.photoLink,
    isPublic: editForm.isPublic
  }
  editingIndex.value = null
}

const handleImageError = (e) => {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.bg-teal {
  background-color: #1b7a86 !important; 
}
.btn-teal {
  background-color: #1b7a86;
  border-color: #1b7a86;
}
.btn-teal:hover {
  background-color: #145e67;
  border-color: #145e67;
}

.object-fit-cover {
  object-fit: cover;
}
</style>