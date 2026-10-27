<script setup>
import SpinFilters from '~/components/spin/SpinFilters.vue';
import SpinResults from '~/components/spin/SpinResults.vue';

// Access shared trips state
const savedTrips = useTrips()

// Activity type, travel time, 
const travelTimeTemp = ref(null)
const travelTime = ref(60)
const startingLocation = ref('')
const response = await useFetch('/api/allBusStops')
const status = ref(response.status)
const submitted = ref(false)
const selectedPlaceTemp = ref('')
const selectedPlace = ref('')
const locResponse = await useFetch('/api/onemap',{
    query: {value: startingLocation}
})
const startingStops = ref('')
const allRoutes = await useFetch('/api/allRoutes')
const chosenStop = ref('')
const stopDetails = ref('')
const startDetails = ref('')
const errorMessage = ref('')
const possibleStops = ref({})

function reroll(){
    chosenStop.value = chooseStop(possibleStops.value)
    stopDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.destination)
    startDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.chosen.boardAt)
    autoLogTrip()
}

// Helper to auto-log the trip into Passport
function autoLogTrip() {
  if (chosenStop.value && stopDetails.value) {
    const today = new Date().toISOString().split('T')[0]
    savedTrips.value.unshift({
      id: Date.now(),
      date: today,
      busService: chosenStop.value.chosen?.service || 'N/A',
      busStop: {
        code: stopDetails.value.BusStopCode,
        name: stopDetails.value.Description || stopDetails.value.RoadName || stopDetails.value.BusStopCode
      },
      memories: '',
      photoLink: '',
      isPublic: false
    })
  }
}

async function update(){
    submitted.value = true
    errorMessage.value = ''
    chosenStop.value = ''
    travelTime.value = travelTimeTemp.value
    selectedPlace.value = selectedPlaceTemp.value

    try {
        let starts = filterStartingBusStops(travelTime.value,response.data.value,selectedPlaceTemp.value)
        startingStops.value = starts
        let now = Date.now() / 60000
        let arrivals = {}
        for (let stopCode of Object.keys(starts)){
            let busArrivals = await $fetch('/api/busArrivals', {query: {value: stopCode}})
            arrivals[stopCode] = {}
            let timeAtStop = now + starts[stopCode]
            for (let bus of busArrivals.Services){
                if (!bus.NextBus.EstimatedArrival){
                    continue
                }
                let arrival1 = new Date(bus.NextBus.EstimatedArrival).getTime() / 60000
                let arrival2 = new Date(bus.NextBus2.EstimatedArrival).getTime() / 60000
                let arrival3 = new Date(bus.NextBus3.EstimatedArrival).getTime() / 60000
                if (timeAtStop <= arrival1){
                    arrivals[stopCode][bus.ServiceNo] = Math.ceil((arrival1-now))
                }
                else if (timeAtStop <= arrival2){
                    arrivals[stopCode][bus.ServiceNo] = Math.ceil((arrival2-now))
                }
                else if (timeAtStop <= arrival3){
                    arrivals[stopCode][bus.ServiceNo] = Math.ceil((arrival3-now))
                }
            }
        }
        possibleStops.value = filterBusStops(arrivals,travelTime.value, allRoutes.data.value,starts)
        chosenStop.value = chooseStop(possibleStops.value)
        stopDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.destination)
        startDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.chosen.boardAt)

        // Auto-create passport log on successful spin
        autoLogTrip()

    } catch (e) {
        errorMessage.value = typeof e === 'string' ? e : 'Something went wrong, please try again.'
    }

    return
}
</script>