<template>
  <div class="container-fluid py-4 px-md-5 bg-light min-vh-100">
    <div class="row">
      
      <!-- Left Column: Input Form -->
      <div class="col-lg-4 col-md-5 mb-4">
        <div class="card shadow-sm border-0 rounded-4">
          <div class="card-body p-4">
            <h3 class="mb-2 fw-bold text-dark">
              <span class="me-2">📖</span> Log Trip Into Passport
            </h3>
            <p class="text-muted small mb-4">
              Save bus trip memories. Kept private by default or share publicly for collectibles!
            </p>
            
            <form @submit.prevent="saveMemory">
              
              <!-- 1. Date -->
              <div class="mb-3">
                <label for="tripDate" class="form-label fw-semibold">Date</label>
                <input type="date" id="tripDate" v-model="formData.date" class="form-control" required />
              </div>

              <!-- 2. Bus Service Number -->
              <div class="mb-3">
                <label for="busService" class="form-label fw-semibold">Bus Service</label>
                <input type="text" id="busService" v-model="formData.busService" class="form-control" placeholder="e.g. 175" required />
              </div>

              <!-- 3. Destination / Bus Stop (Searchable Dropdown) -->
              <div class="mb-3 position-relative">
                <label for="busStopSearch" class="form-label fw-semibold">Destination / Stop</label>
                <input 
                  type="text" 
                  id="busStopSearch" 
                  v-model="busStopSearch" 
                  @input="filterBusStops"
                  @focus="showDropdown = true"
                  class="form-control" 
                  placeholder="Search bus stop name or code..." 
                  autocomplete="off"
                  required 
                />
                <!-- Autocomplete Dropdown -->
                <ul v-if="showDropdown && filteredBusStops.length > 0" class="list-group position-absolute w-100 shadow-sm" style="z-index: 1000; max-height: 200px; overflow-y: auto;">
                  <li 
                    v-for="stop in filteredBusStops" 
                    :key="stop.code" 
                    class="list-group-item list-group-item-action cursor-pointer"
                    @click="selectBusStop(stop)"
                  >
                    {{ stop.name }} ({{ stop.code }})
                  </li>
                </ul>
              </div>

              <!-- 4. Memories / Thoughts -->
              <div class="mb-3">
                <label for="memories" class="form-label fw-semibold">Memories / Thoughts</label>
                <textarea id="memories" v-model="formData.memories" class="form-control" rows="3" placeholder="How was the ride?"></textarea>
              </div>

              <!-- 5. Photo Link -->
              <div class="mb-3">
                <label for="photoLink" class="form-label fw-semibold">Photo Link (Optional)</label>
                <input type="url" id="photoLink" v-model="formData.photoLink" class="form-control" placeholder="https://..." />
              </div>

              <!-- 6. Public Sharing Option -->
              <div class="mb-4 form-check">
                <input type="checkbox" id="sharePublicly" v-model="formData.isPublic" class="form-check-input" />
                <label class="form-check-label text-muted small" for="sharePublicly">
                  Share publicly to app feed to earn collectible
                </label>
              </div>

              <!-- 7. Save Button -->
              <div class="d-grid">
                <button type="submit" class="btn btn-save text-white fw-bold">Save Memory</button>
              </div>
              
            </form>
          </div>
        </div>
      </div>

      <!-- Right Column: Generated Log Cards -->
      <div class="col-lg-8 col-md-7">
        <h2 class="fw-bold mb-4">Your Digital Passport Entries</h2>
        
        <div class="d-flex flex-column gap-3">
          
          <!-- Empty State (Shows if no trips are saved) -->
          <div v-if="savedTrips.length === 0" class="text-center text-muted p-5 bg-white rounded-4 shadow-sm">
            <p class="mb-0">No trips logged yet. Fill out the form to save your first memory!</p>
          </div>

          <!-- Dynamic Render of Saved Trips -->
          <div 
            v-for="(trip, index) in savedTrips" 
            :key="index" 
            class="card shadow-sm border-0 rounded-4 overflow-hidden"
          >
            <div class="row g-0 h-100">
              <!-- Left side: Image (Conditional) -->
              <div v-if="trip.photoLink" class="col-sm-4 bg-dark">
                <img :src="trip.photoLink" class="img-fluid w-100 h-100 object-fit-cover" alt="Trip Photo" style="min-height: 200px;" @error="handleImageError" />
              </div>
              
              <!-- Right side: Text Content -->
              <div :class="trip.photoLink ? 'col-sm-8' : 'col-12'">
                <div class="card-body p-4 d-flex flex-column h-100">
                  
                  <!-- Top Row: Badge & Date -->
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-teal rounded-pill px-3 py-2">Bus {{ trip.busService }}</span>
                    <span class="text-muted small">{{ trip.date }}</span>
                  </div>
                  
                  <!-- Main Info -->
                  <h4 class="card-title fw-bold mb-2">{{ trip.busStop.name }}</h4>
                  <p class="card-text text-secondary flex-grow-1">{{ trip.memories }}</p>
                  
                  <!-- Privacy Status -->
                  <div class="mt-auto pt-3">
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
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

//check session validity
definePageMeta( {middleware: auth} )

// Form state
const formData = reactive({
  date: '',
  busService: '',
  busStop: null,
  memories: '',
  photoLink: '',
  isPublic: false
})

// Array to hold the saved logs
const savedTrips = ref([])

// Bus Stop Autocomplete State
const busStopSearch = ref('')
const showDropdown = ref(false)
const filteredBusStops = ref([])

// Mock database of Bus Stops
const allBusStops = ref([
  { code: '09048', name: 'Orchard Rd' },
  { code: '05049', name: 'Chinatown Point' },
  { code: '92049', name: 'East Coast Park' },
  { code: '80219', name: 'Kallang Stn' },
  { code: '01012', name: 'Victoria St / Bugis Stn' }
])

const filterBusStops = () => {
  if (!busStopSearch.value) {
    filteredBusStops.value = []
    showDropdown.value = false
    return
  }
  const query = busStopSearch.value.toLowerCase()
  filteredBusStops.value = allBusStops.value.filter(stop => 
    stop.name.toLowerCase().includes(query) || stop.code.includes(query)
  )
  showDropdown.value = true
}

const selectBusStop = (stop) => {
  formData.busStop = stop
  busStopSearch.value = `${stop.name} (${stop.code})`
  showDropdown.value = false
}

const handleImageError = (e) => {
  e.target.style.display = 'none'
}

// Submit handler
const saveMemory = () => {
  if (!formData.busStop) {
    alert("Please select a valid bus stop from the dropdown list.")
    return
  }
  
  // Push a clone of the form data to the top of the array
  savedTrips.value.unshift({
    date: formData.date,
    busService: formData.busService,
    busStop: { ...formData.busStop },
    memories: formData.memories,
    photoLink: formData.photoLink,
    isPublic: formData.isPublic
  })
  
  // Reset Form
  formData.date = ''
  formData.busService = ''
  formData.busStop = null
  formData.memories = ''
  formData.photoLink = ''
  formData.isPublic = false
  busStopSearch.value = ''
}

// Close dropdown if user clicks outside
onMounted(() => {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.position-relative')) {
      showDropdown.value = false
    }
  })
})
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.cursor-pointer:hover {
  background-color: #f8f9fa;
}

/* Custom Teal Color to match the reference image */
.bg-teal {
  background-color: #1b7a86 !important; 
}
.btn-save {
  background: #0b7a4b;
  border-color: #0b7a4b;
  margin-top: auto;
  padding: 12px 22px;
  border: none;
  border-radius: 50px;
  font-weight: 600;
  color: #fff;
}
.btn-teal:hover {
  background-color: #145e67;
  border-color: #145e67;
}

.object-fit-cover {
  object-fit: cover;
}
</style>