<script setup>
    //Activity type, travel time, 
    const travelTimeTemp = ref(60)
    const travelTime = ref(60)
    const startingLocation = ref('')
    const response = await useFetch('/api/allBusStops')
    const status = ref(response.status)
    const submitted = ref(false)
    const selectedPlace = ref('')
    const locResponse = await useFetch('/api/onemap',{
        query: {value: startingLocation}
    })
    function update(){
        submitted.value = true
        travelTime.value = travelTimeTemp.value 
        return 
    }
</script>
<template>
    <h1>Welcome User, please select your preferences!</h1>
    <div v-if="!submitted">
        <input type="number" v-model="travelTimeTemp" placeholder="Choose your max travel time from your starting location">
        <input type="text" v-model="startingLocation" placeholder="Choose your starting location">
        <div v-if="startingLocation && locResponse.data.value?.length">
            <select name="" id="" v-model="selectedPlace">
                <option value="" v-for="place of locResponse.data.value.slice(0,5)" :value="place" :key="place.ADDRESS">
                    {{ place.ADDRESS }}
                </option>
            </select>
        </div>
        <button @click="update()">Submit Preferences</button>
    </div>
    <div v-else-if="submitted">
    
        <select name="allStops" v-if="status == 'success'">
        <option v-for="stops of response.data.value" :value="stops" :key="stops.BusStopCode">
            {{ stops.BusStopCode }}
            {{ stops.Latitude }}
            {{ stops.Longitude }}
        </option>
    </select>
    <h1 v-else-if="status=='pending'">Loading...</h1>
    </div>
    
</template>