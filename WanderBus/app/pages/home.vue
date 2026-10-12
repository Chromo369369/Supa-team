<script setup>
    //Activity type, travel time, 
    const travelTime = ref(60)
    const startingLocation = ref('')
</script>
<template>
    <h1>Welcome User, please select your preferences!</h1>
    <input type="number" v-model="travelTime" placeholder="Choose your max travel time from your starting location">
    <input type="text" v-model="startingLocation" placeholder="Choose your starting location">
</template>