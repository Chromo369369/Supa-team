<script setup>
import SpinFilters from '~/components/spin/SpinFilters.vue';
import SpinResults from '~/components/spin/SpinResults.vue';
import { filterByAmens } from '~/composables/filterAmens';

const { $supabase } = useNuxtApp()

definePageMeta({ middleware: 'auth' })

const amenStops = await useFetch('/api/allAmenities')
const preferences = ref([])
const travelTimeTemp = ref(null)
const travelTime = ref(60)
const startingLocation = ref('')
const response = await useFetch('/api/allBusStops')
const status = ref(response.status)
const submitted = ref(false)
const selectedPlaceTemp = ref('')
const selectedPlace = ref('')
const locResponse = await useFetch('/api/onemap', {
    query: { value: startingLocation }
})
const startingStops = ref('')
const allRoutes = await useFetch('/api/allRoutes')
const chosenStop = ref('')
const stopDetails = ref('')
const startDetails = ref('')
const errorMessage = ref('')
const possibleStops = ref({})


async function reroll() {
    chosenStop.value = chooseStop(possibleStops.value)
    stopDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.destination)
    startDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.chosen.boardAt)
    
    // Auto-save new rerolled quest immediately
    await autoSavePassportEntry()
}

async function update(){
    submitted.value = true
    errorMessage.value = ''
    chosenStop.value = ''
    travelTime.value = travelTimeTemp.value
    selectedPlace.value = selectedPlaceTemp.value

    try {
        let starts = filterStartingBusStops(travelTime.value, response.data.value, selectedPlaceTemp.value)
        startingStops.value = starts
        let now = Date.now() / 60000
        let arrivals = {}
        // ask LTA for every starting stop at the same time instead of one by one (40 stops took ~10s in a row)
        let stopCodes = Object.keys(starts)
        let allArrivals = await Promise.all(stopCodes.map(stopCode => $fetch('/api/busArrivals', { query: { value: stopCode } })))
        for (let [index, stopCode] of stopCodes.entries()) {
            let busArrivals = allArrivals[index]
            arrivals[stopCode] = {}
            let timeAtStop = now + starts[stopCode]
            for (let bus of busArrivals.Services || []) {
                if (!bus.NextBus?.EstimatedArrival) continue
                let arrival1 = new Date(bus.NextBus.EstimatedArrival).getTime() / 60000
                let arrival2 = new Date(bus.NextBus2?.EstimatedArrival).getTime() / 60000
                let arrival3 = new Date(bus.NextBus3?.EstimatedArrival).getTime() / 60000
                
                if (timeAtStop <= arrival1) {
                    arrivals[stopCode][bus.ServiceNo] = Math.ceil((arrival1 - now))
                } else if (timeAtStop <= arrival2) {
                    arrivals[stopCode][bus.ServiceNo] = Math.ceil((arrival2 - now))
                } else if (timeAtStop <= arrival3) {
                    arrivals[stopCode][bus.ServiceNo] = Math.ceil((arrival3 - now))
                }
            }
        }
        possibleStops.value = filterBusStops(arrivals, travelTime.value, allRoutes.data.value, starts)
        possibleStops.value = filterByAmens(preferences.value, possibleStops.value, amenStops.data.value)
        chosenStop.value = chooseStop(possibleStops.value)
        stopDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.destination)
        startDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.chosen.boardAt)


    } catch (e) {
        errorMessage.value = typeof e === 'string' ? e : 'Something went wrong, please try again.'
    }
}
async function saveTrip(){
        try{
            const {data, error} = await $supabase.from('passport_entries').insert({
                starting_stop: startDetails.value.Description,
                end_stop: stopDetails.value.Description,
                time_taken: Math.ceil(chosenStop.value.chosen.totalTime),
                bus_taken:chosenStop.value.chosen.bus,
                starting_location: selectedPlace.value.ADDRESS
            })
            if(error){
                alert(`Could not save your trip: ${error.message}`)
                return
            }
            alert('Your entry has been saved successfully, to view it, please head to the passport page!')
            
                
        }catch(e){
            console.log(e)
        }
    }
</script>

<template>
    <section class="container py-4 spin-page">
        <h1 class="page-title">Spin a side quest</h1>
        <p class="small-note mb-4">
            📍 {{ selectedPlace ? `Starting near ${selectedPlace.ADDRESS}` : 'Pick a starting location to begin' }}
        </p>

        <div class="spin-layout">
            <SpinFilters
                v-model:travel-time="travelTimeTemp"
                v-model:starting-location="startingLocation"
                v-model:selected-place="selectedPlaceTemp"
                :categories="Object.keys(categories)"
                v-model:preferences="preferences"
                :places="locResponse.data.value"
                @submit="update()"
            />

            <SpinResults
                :submitted="submitted"
                :error-message="errorMessage"
                :chosen-stop="chosenStop"
                :stop-details="stopDetails"
                :start-details="startDetails"
                :starting-stops="startingStops"
                :preferences="preferences"
                @reroll="reroll()"
            />
            <SpinSubmit
                :submitted="submitted && !!chosenStop"
                @saveTrip="saveTrip()"
            />
        </div>
    </section>
</template>

<style scoped>
.page-title {
  font-size: 2.4rem;
  font-weight: 800;
  color: #141a33;
}

/* Expanded to 2 columns (340px for filters, remaining width for results) */
.spin-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 32px;
}

@media (max-width: 991.98px) {
  .spin-layout {
    grid-template-columns: 1fr;
  }

  .spin-page {
    padding-bottom: 120px !important;
  }
}
</style>