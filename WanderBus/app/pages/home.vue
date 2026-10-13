<script setup>
    //Activity type, travel time, 
    const travelTimeTemp = ref(60)
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
    async function update(){
        submitted.value = true
        travelTime.value = travelTimeTemp.value 
        selectedPlace.value = selectedPlaceTemp.value
        travelTimeTemp.value = 60
        
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
        let possibleStops = filterBusStops(arrivals,travelTime.value, allRoutes.data.value,starts)
        chosenStop.value = chooseStop(possibleStops)
        stopDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.destination)
        startDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.chosen.boardAt)



        selectedPlaceTemp.value = ''
        return 
    }
</script>
<template>
    <h1 :hidden="submitted">Welcome User, please select your preferences!</h1>
    <div v-if="!submitted">
        <input type="number" v-model="travelTimeTemp" placeholder="Choose your max travel time from your starting location"><br>
        <input type="text" v-model="startingLocation" placeholder="Choose your starting location" @input="selectedPlaceTemp=''">
        <div v-if="startingLocation && locResponse.data.value?.length && !selectedPlaceTemp">
            <select name="" id="" v-model="selectedPlaceTemp" size="5" @change="startingLocation = selectedPlaceTemp.ADDRESS">
                <option v-for="place of locResponse.data.value.slice(0,5)" :value="place" :key="place.ADDRESS">
                    {{ place.ADDRESS }}
                </option>
            </select>
        </div><br>
        <button @click="update()">Submit Preferences</button>
    </div>
    <div v-else-if="submitted">
        <div v-if="chosenStop">
            <h1>Your Chosen Stop is...{{ chosenStop.destination }}, {{ stopDetails.RoadName }} !!</h1>
            <h3>(Near {{ stopDetails.Description }})</h3><br><br>
            <h1>Here is the route to get there:</h1><br>
            <ol>
                <li>
                    <h3>Walk {{ Math.ceil(startingStops[chosenStop.chosen.boardAt]) }} min to {{ chosenStop.chosen.boardAt }}, </h3>
                </li>
                <li>
                    <h3 v-if="chosenStop.chosen.bus">Take bus {{ chosenStop.chosen.bus }} for {{ chosenStop.chosen.stops }} stops to reach {{ chosenStop.destination }}, {{ stopDetails.RoadName }}</h3>
                    <h3 v-else>You have reached {{ chosenStop.destination }}, {{ stopDetails.RoadName }} !!</h3>
                </li>
                <li>
                    <h3>Your total travel time to reach our chosen bus stop is approximately {{ Math.ceil(chosenStop.chosen.totalTime) }} minutes</h3>
                </li>
                    
                    
                
            </ol>
        </div>
        <div v-else>
            <h1>Preparing your adventure...</h1>
        </div>
        
    
    </div>
    
    
</template>