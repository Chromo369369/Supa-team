<script setup>
import { ref } from 'vue'

defineProps({
    icon: { type: String, default: '🍜' },
    title: { type: String, default: 'Makan run' },
    subtitle: { type: String, default: 'Hawker stalls and kopi nearby' },
    travelTime: { type: Number, default: 19 },
    bus: { type: String, default: '16' }, 
    boardAt: { type: String, default: 'SMU' },
    walk: { type: String, default: '140 m walk' },
    getOffAt: { type: String, default: 'Blk 55' },
    area: { type: String, default: 'Bukit Merah' },
    stops: { type: Number, default: 12 }
})

const isRevealed = ref(false)

function toggleStub() {
    isRevealed.value = !isRevealed.value
}
</script>

<template>
    <section v-if="!isRevealed" class="ticket mx-auto">
        <div class="ticket-main">
            <span class="ticket-icon">{{ icon }}</span>
            <div class="ticket-info">
                <h4 class="ticket-title">{{ title }}</h4>
                <p class="ticket-subtitle">{{ subtitle }}</p>
                <span class="ticket-time">⏱ {{ travelTime }} min travel time</span>
                <div class="ticket-barcode"></div>
            </div>
        </div>

        <button class="ticket-stub" type="button" @click="toggleStub">
            <span class="stub-mark">?</span>
            <span class="stub-text">Tear here</span>
        </button>
    </section>

    <section v-else class="ticket ticket-revealed mx-auto" @click="toggleStub">
        <div class="bus-col">
            <span class="detail-label">{{ bus ? 'Bus' : 'On foot' }}</span>
            <span class="bus-number">{{ bus || 'Walk' }}</span>
        </div>

        <div class="detail-col">
            <template v-if="bus">
                <span class="detail-label">Board at</span>
                <p class="detail-value">{{ boardAt }} <span class="detail-muted">· {{ walk }}</span></p>
            </template>

            <span class="detail-label">{{ bus ? 'Get off at' : 'Walk to' }}</span>
            <p class="detail-value">{{ getOffAt }} <span class="detail-muted">· {{ area }}</span></p>

            <span class="detail-label">{{ bus ? 'Ride' : 'Walk' }}</span>
            <p class="detail-value">
                <template v-if="bus">{{ stops }} stops, </template>about {{ travelTime }} min
            </p>
        </div>
    </section>
</template>


<style scoped>
.ticket {
  display: flex;
  max-width: 580px;
  min-height: 230px;
  background: #fff;
  border-left: 6px solid #0b7a4b;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(20, 26, 51, 0.12);
  overflow: hidden;
  text-align: left;
}

.ticket-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px;
  border-right: 4px dotted #c9ccd6;
}

.ticket-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #e3f2ea;
  font-size: 1.2rem;
}

.ticket-title {
  margin: 16px 0 2px;
  font-size: 1.5rem;
  font-weight: 800;
  color: #141a33;
}

.ticket-subtitle {
  margin: 0 0 10px;
  font-size: 0.9rem;
  color: #4a5068;
}

.ticket-time {
  font-size: 0.95rem;
  color: #4a5068;
}

.ticket-barcode {
  height: 8px;
  width: 170px;
  margin-top: 12px;
  border-radius: 4px;
  background: repeating-linear-gradient(90deg, #e3e5ec 0 4px, transparent 4px 6px);
}

.ticket-stub {
  width: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0b7a4b;
  color: #fff;
  border: none;
  cursor: pointer;
}

.ticket-stub:hover {
  background: #096640;
}

.stub-mark {
  font-size: 2.4rem;
  font-weight: 800;
  line-height: 1;
}

.stub-text {
  font-size: 0.85rem;
  font-weight: 700;
}

.ticket-revealed {
  gap: 24px;
  padding: 24px;
  border-right: 4px dotted #c9ccd6;
  cursor: pointer;
}

.bus-col {
  display: flex;
  flex-direction: column;
}

.bus-number {
  font-size: 3.4rem;
  font-weight: 800;
  line-height: 1;
  color: #0b7a4b;
}

.detail-col {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 0.85rem;
  color: #6b7085;
}

.detail-value {
  margin: 0 0 8px;
  font-weight: 600;
  color: #141a33;
}

.detail-muted {
  font-weight: 400;
  color: #6b7085;
}
</style>
