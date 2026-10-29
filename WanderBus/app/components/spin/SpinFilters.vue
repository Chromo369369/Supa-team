<script setup>
const travelTime = defineModel('travelTime')
const startingLocation = defineModel('startingLocation')
const selectedPlace = defineModel('selectedPlace')
const preferences = defineModel('preferences')

defineProps({
    places: Array,
    categories: Array
})

const emit = defineEmits(['submit'])

const isOpen = ref(false)

function submit() {
    isOpen.value = false
    emit('submit')
}
</script>

<template>
    <aside class="filters" :class="{ open: isOpen }">
        <button class="filters-toggle d-lg-none" type="button" @click="isOpen = !isOpen">
            <span>
                <span class="toggle-title">Filters</span>
                <span class="toggle-summary">
                    {{ travelTime ? `Up to ${travelTime} min` : 'No travel time set' }},
                    {{ selectedPlace ? selectedPlace.ADDRESS : 'no starting location' }}
                </span>
            </span>
            <span>{{ isOpen ? '▾' : '▴' }}</span>
        </button>

        <div class="filters-body">
            <h2 class="filters-title">Your filters</h2>

            <label class="filter-label" for="start-location">Starting location</label>
            <input id="start-location" type="text" class="form-control" v-model="startingLocation" placeholder="Search for a place or address" @input="selectedPlace = ''">
            <select v-if="startingLocation && places?.length && !selectedPlace" class="form-select mt-2" v-model="selectedPlace" size="5" @change="startingLocation = selectedPlace.ADDRESS">
                <option v-for="place of places.slice(0,5)" :value="place" :key="place.ADDRESS">
                    {{ place.ADDRESS }}
                </option>
            </select>

            <label class="filter-label mt-4" for="travel-time">Max travel time (min)</label>
            <input id="travel-time" type="number" class="form-control" v-model="travelTime" placeholder="e.g. 40">
            <div v-for="cat of categories" :key="cat" class="form-check">
              <label :for="cat" class="form-check-label" >{{ cat }}</label>
              <input type="checkbox" class="form-check-input" :id="cat" :value="cat" v-model="preferences">

            </div>

            <button class="btn btn-wb-green w-100 mt-4" @click="submit()" :disabled="!selectedPlace || !travelTime">Submit Preferences</button>
        </div>
    </aside>
</template>

<style scoped>
.filters {
  background: #fff;
  border: 1px solid #e3e5ec;
  border-radius: 16px;
  padding: 20px;
  align-self: start;
  position: sticky;
  top: 90px;
}

.filters-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #141a33;
  margin-bottom: 16px;
}

.filter-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #141a33;
  margin-bottom: 8px;
}

.btn-wb-green {
  background: #0b7a4b;
  color: #fff;
  border-radius: 50px;
  padding: 12px 28px;
  font-weight: 600;
}

.btn-wb-green:hover {
  background: #096640;
  color: #fff;
}

.btn-wb-green:disabled {
  background: #9cc9b5;
  color: #fff;
}

@media (max-width: 991.98px) {
  .filters {
    position: fixed;
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1020;
    border-radius: 16px 16px 0 0;
    padding: 12px 16px;
  }

  .filters-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: 1px solid #c9ccd6;
    border-radius: 12px;
    padding: 10px 14px;
    text-align: left;
  }

  .toggle-title {
    display: block;
    font-weight: 700;
    color: #141a33;
  }

  .toggle-summary {
    display: block;
    font-size: 0.8rem;
    color: #6b7085;
  }

  .filters-body {
    display: none;
    max-height: 70vh;
    overflow-y: auto;
    padding-top: 16px;
  }

  .filters.open .filters-body {
    display: block;
  }
}
</style>
