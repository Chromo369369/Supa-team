<!--
  SpinTicket: a mystery trip shown as a bus ticket. Drag the stub to tear it off (or focus it and
  press Enter) to reveal the bus, boarding stop and destination.
-->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import TearTicket from '~/components/ui/TearTicket.vue'

const props = defineProps({
    icon: { type: String, default: '🍜' },
    title: { type: String, default: 'Makan run' },
    subtitle: { type: String, default: 'Hawker stalls and kopi nearby' },
    travelTime: { type: Number, default: 19 },
    bus: { type: String, default: '16' },
    boardAt: { type: String, default: 'SMU' },
    walk: { type: String, default: '140 m walk' },
    getOffAt: { type: String, default: 'Blk 55' },
    area: { type: String, default: 'Bukit Merah' },
    stops: { type: Number, default: 12 },
    /** 'horizontal' (stub on the right) or 'vertical' (stub at the bottom). */
    orientation: { type: String, default: 'horizontal' },
    /** Show a "Put the stub back" link after tearing. */
    resettable: { type: Boolean, default: true }
})

const emit = defineEmits(['tear'])

const isRevealed = ref(false)

const wrap = ref(null)
const available = ref(580)
let observer = null

onMounted(() => {
    const measure = () => {
        if (wrap.value) available.value = wrap.value.clientWidth || available.value
    }
    measure()
    observer = new ResizeObserver(measure)
    observer.observe(wrap.value)
})
onBeforeUnmount(() => observer?.disconnect())

const vertical = computed(() => props.orientation === 'vertical')

// The tear geometry is drawn in px, so pick a size that fits the space we have.
const size = computed(() => {
    if (vertical.value) return { width: Math.min(272, Math.max(220, available.value)), height: 392, stub: 96 }
    const width = Math.min(580, Math.max(280, available.value))
    if (width < 400) return { width, height: 210, stub: 92 }
    return { width, height: 230, stub: 130 }
})
const compact = computed(() => !vertical.value && size.value.width < 400)

function onTear() {
    isRevealed.value = true
    emit('tear')
}
</script>

<template>
    <div ref="wrap" class="spin-ticket" :class="{ 'spin-ticket--compact': compact, 'spin-ticket--vertical': vertical }">
        <TearTicket
            :torn="isRevealed"
            :orientation="orientation"
            :width="size.width"
            :height="size.height"
            :stub-size="size.stub"
            :holes="vertical ? 11 : 9"
            :radius="16"
            background="#ffffff"
            stub-background="#0b7a4b"
            :recenter="!vertical"
            aria-label="Tear the stub to reveal your bus"
            @tear="onTear"
        >
            <div class="ticket-body">
                <Transition name="reveal" mode="out-in">
                    <div v-if="!isRevealed" key="face" class="ticket-face">
                        <span class="ticket-icon">{{ icon }}</span>
                        <div>
                            <h4 class="ticket-title">{{ title }}</h4>
                            <p class="ticket-subtitle">{{ subtitle }}</p>
                            <span class="ticket-time">⏱ {{ travelTime }} min travel time</span>
                            <div class="ticket-barcode"></div>
                        </div>
                    </div>

                    <div v-else key="details" class="ticket-details">
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
                    </div>
                </Transition>
            </div>

            <template #stub>
                <div class="ticket-stub">
                    <span class="stub-mark" aria-hidden="true">?</span>
                    <span class="stub-text">Tear here</span>
                </div>
            </template>
        </TearTicket>

        <button v-if="resettable && isRevealed" type="button" class="btn btn-link btn-sm d-block mx-auto mt-3 p-0 stub-reset" @click="isRevealed = false">
            Put the stub back
        </button>
    </div>
</template>

<style scoped>
.spin-ticket {
  width: 100%;
  max-width: 580px;
  margin-inline: auto;
  text-align: left;
  filter: drop-shadow(0 8px 16px rgba(20, 26, 51, 0.12));
}

.spin-ticket--vertical {
  max-width: 272px;
}

.ticket-body {
  position: absolute;
  inset: 0;
  padding: 24px;
  border-left: 6px solid #0b7a4b;
  overflow: hidden;
}

.spin-ticket--vertical .ticket-body {
  padding: 20px;
  border-left: 0;
  border-top: 6px solid #0b7a4b;
}

.ticket-face,
.ticket-details {
  height: 100%;
}

.ticket-face {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
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
  margin: 0 0 2px;
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
  max-width: 100%;
  margin-top: 12px;
  border-radius: 4px;
  background: repeating-linear-gradient(90deg, #e3e5ec 0 4px, transparent 4px 6px);
}

.ticket-details {
  display: flex;
  gap: 24px;
}

.bus-col,
.detail-col {
  display: flex;
  flex-direction: column;
}

.bus-number {
  font-size: 3.4rem;
  font-weight: 800;
  line-height: 1;
  color: #0b7a4b;
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

.ticket-stub {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-left: 6px;
  color: #fff;
}

.spin-ticket--vertical .ticket-stub {
  padding-left: 0;
  padding-top: 6px;
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

.stub-reset {
  color: #0b7a4b;
}

/* Vertical: bus number on top, details stacked below */
.spin-ticket--vertical .ticket-face {
  justify-content: flex-start;
  gap: 48px;
}

.spin-ticket--vertical .ticket-details {
  flex-direction: column;
  gap: 16px;
}

.spin-ticket--vertical .detail-label {
  font-size: 0.75rem;
}

.spin-ticket--vertical .detail-value {
  margin-bottom: 6px;
  font-size: 0.9rem;
  line-height: 1.25;
}

/* Narrow phones: tighter padding, bus number above the details */
.spin-ticket--compact .ticket-body {
  padding: 16px;
}

.spin-ticket--compact .ticket-title {
  font-size: 1.2rem;
}

.spin-ticket--compact .ticket-details {
  flex-direction: column;
  gap: 4px;
}

.spin-ticket--compact .bus-col {
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
}

.spin-ticket--compact .bus-number {
  font-size: 2rem;
}

.spin-ticket--compact .detail-value {
  margin-bottom: 2px;
  font-size: 0.85rem;
}

/* Face -> details */
.reveal-enter-active {
  transition: opacity 320ms ease, transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.reveal-leave-active {
  transition: opacity 140ms ease;
}

.reveal-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.reveal-leave-to {
  opacity: 0;
}
</style>
