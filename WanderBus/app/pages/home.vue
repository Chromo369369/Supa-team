<script setup>
import SpinFilters from '~/components/spin/SpinFilters.vue';
import SpinResults from '~/components/spin/SpinResults.vue';
import BoardingIntro from '~/components/landing/BoardingIntro.vue';
import { filterByAmens } from '~/composables/filterAmens';

const { $supabase } = useNuxtApp()
const toast = useToast()

definePageMeta({ middleware: 'auth' })

const amenStops = await useFetch('/api/allAmenities')
const preferences = ref([])
const travelTimeTemp = ref(60)
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
// Up to 3 different stops for bays A/B/C; picking a bay sets chosenStop.
const ticketOptions = ref([])


async function reroll() {
    chosenStop.value = chooseStop(possibleStops.value)
    stopDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.destination)
    startDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.chosen.boardAt)
}

// chooseStop can repeat a pick, so call it on a shrinking copy (it still throws when nothing fits).
function pickTickets(stops) {
    const left = { ...stops }
    const picks = []
    do {
        const pick = chooseStop(left)
        picks.push(pick)
        delete left[pick.destination]
    } while (picks.length < 3 && Object.keys(left).length)
    return picks
}

function chooseTicket(option) {
    chosenStop.value = option
    stopDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.destination)
    startDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.chosen.boardAt)
}

async function update(){
    submitted.value = true
    errorMessage.value = ''
    chosenStop.value = ''
    ticketOptions.value = []
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
        ticketOptions.value = pickTickets(possibleStops.value)


    } catch (e) {
        errorMessage.value = typeof e === 'string' ? e : 'Your spin didn’t go through, so tap Spin again to retry.'
    }
}
// guards against double-clicks creating duplicate passport entries
const savingTrip = ref(false)
const savedTrip = ref(false)
watch(chosenStop, () => { savedTrip.value = false })

async function saveTrip(){
        if (savingTrip.value || savedTrip.value) return
        savingTrip.value = true
        try{
            const {data, error} = await $supabase.from('passport_entries').insert({
                starting_stop: startDetails.value.Description,
                end_stop: stopDetails.value.Description,
                time_taken: Math.ceil(chosenStop.value.chosen.totalTime),
                bus_taken:chosenStop.value.chosen.bus,
                starting_location: selectedPlace.value.ADDRESS
            })
            if(error){
                toast.error(`Couldn’t save your trip: ${error.message}`, { action: { label: 'Retry', run: saveTrip } })
                return
            }
            savedTrip.value = true
            toast.success('Saved to your passport')


        }catch(e){
            console.log(e)
            toast.error('Couldn’t save your trip. Check your connection and try again.', { action: { label: 'Retry', run: saveTrip } })
        }finally{
            savingTrip.value = false
        }
    }
</script>

<template>
    <section class="container py-4 spin-page">
        <!-- Welcome intro: once per session, right after logging in (or registering, then logging in) -->
        <BoardingIntro />
        <h1 class="page-title">Spin a side quest</h1>
        <p v-if="selectedPlaceTemp" class="start-line">
            <i class="bi bi-geo-alt-fill" aria-hidden="true"></i>
            Starting near {{ selectedPlaceTemp.ADDRESS }}
        </p>

        <div class="spin-layout">
            <SpinFilters
                v-model:travel-time="travelTimeTemp"
                v-model:starting-location="startingLocation"
                v-model:selected-place="selectedPlaceTemp"
                :places="locResponse.data.value"
                :categories="Object.keys(categories)"
                v-model:preferences="preferences"
                :busy="submitted && !chosenStop && !ticketOptions.length && !errorMessage"
                :has-spun="submitted"
                @submit="update()"
            />

            <SpinResults
                :submitted="submitted"
                :error-message="errorMessage"
                :chosen-stop="chosenStop"
                :ticket-options="ticketOptions"
                :bus-stops="response.data.value ?? []"
                :stop-details="stopDetails"
                :start-details="startDetails"
                :starting-stops="startingStops"
                :preferences="preferences"
                :amenities="amenStops.data.value ?? {}"
                :saving="savingTrip"
                :saved="savedTrip"
                @reroll="reroll()"
                @choose="chooseTicket($event)"
                @retry="update()"
                @save-trip="saveTrip()"
            />
        </div>
    </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 var(--sp-5);
  font-size: var(--fs-title);
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.page-title:has(+ .start-line) {
  margin-bottom: var(--sp-2);
}

.start-line {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
  margin: 0 0 var(--sp-5);
  color: var(--wb-text-2);
  font-weight: 500;
  overflow-wrap: anywhere;
}

/* Expanded to 2 columns (340px for filters, remaining width for results) */
.spin-layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: var(--sp-6);
}

@media (max-width: 991.98px) {
  .spin-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .spin-page {
    padding-bottom: 148px !important; /* room for the dock and its helper line */
  }
}
</style>