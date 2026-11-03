<script setup lang="ts">
const {$supabase} = useNuxtApp()
defineProps({
    submitted:Boolean
})
defineEmits(['saveTrip'])


</script>

<template>
    <button v-if="submitted" @click="$emit('saveTrip')">Save trip here!</button>
</template>