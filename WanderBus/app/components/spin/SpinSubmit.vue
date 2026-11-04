<script setup>
defineProps({
    submitted: Boolean
})
defineEmits(['saveTrip'])
</script>

<template>
    <button v-if="submitted" type="button" class="btn save-trip" @click="$emit('saveTrip')">Save to passport</button>
</template>

<style scoped>
.save-trip {
  background: #fff;
  border: 1px solid #0b7a4b;
  color: #0b7a4b;
  border-radius: 50px;
  padding: 12px 28px;
  font-weight: 600;
}

.save-trip:hover {
  background: #e3f2ea;
  color: #0b7a4b;
}
</style>
