<script setup>
defineProps({
    line1: String,
    line2: String
})
</script>

<template>
    <div class="led-board">
        <span class="led-q">??</span>
        <span class="led-text">{{ line1 }}<br>{{ line2 }}</span>
    </div>
</template>

<style scoped>
.led-board {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 20px;
  background-color: #141a33;
  background-image: radial-gradient(#2a3150 1px, transparent 1px);
  background-size: 4px 4px;
  border-radius: 12px;
  font-family: monospace;
  color: #f5a623;
}

.led-q {
  font-size: 3rem;
  font-weight: 700;
}

.led-text {
  font-size: 1.6rem;
  line-height: 1.1;
  letter-spacing: 2px;
}
</style>
