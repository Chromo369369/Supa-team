<!--
  SpinTicket: a mystery trip shown as a bus ticket. Drag the stub to tear it off (or focus it and
  press Enter) to reveal the bus, boarding stop and destination.
-->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import TearTicket from '~/components/ui/TearTicket.vue'

const props = defineProps({
    /** A Bootstrap Icons class, e.g. 'bi-bus-front' (design.md §2.6). */
    icon: { type: String, default: 'bi-egg-fried' },
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
    /** Show a “Put the stub back” button after tearing. */
    resettable: { type: Boolean, default: true },
    /** Heading level of the ticket title, so it fits the page outline (2–6). */
    headingLevel: { type: Number, default: 2, validator: (n) => n >= 2 && n <= 6 }
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
const headingTag = computed(() => `h${Math.min(6, Math.max(2, props.headingLevel))}`)
const iconClass = computed(() => (props.icon.startsWith('bi-') ? props.icon : 'bi-ticket-perforated'))

// Barcode bars (widths in px) drawn as flat rects, not a gradient.
const BARS = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 2]
const barcode = computed(() => {
    let x = 0
    return BARS.map((w, i) => {
        const bar = { x, w, dark: i % 2 === 0 }
        x += w + 1
        return bar
    }).filter((b) => b.dark)
})
const barcodeWidth = BARS.reduce((sum, w) => sum + w + 1, 0)

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
            background="var(--wb-surface)"
            stub-background="var(--wb-green)"
            border-color="var(--wb-ink)"
            :border-width="4"
            :recenter="!vertical"
            aria-label="Tear the stub to reveal your bus"
            @tear="onTear"
        >
            <div class="ticket-body">
                <Transition name="reveal" mode="out-in">
                    <div v-if="!isRevealed" key="face" class="ticket-face">
                        <span class="ticket-icon" aria-hidden="true"><i :class="['bi', iconClass]"></i></span>
                        <div>
                            <component :is="headingTag" class="ticket-title">{{ title }}</component>
                            <p class="ticket-subtitle">{{ subtitle }}</p>
                            <span class="ticket-time"><i class="bi bi-stopwatch" aria-hidden="true"></i> <span class="num">{{ travelTime }}</span> min travel time</span>
                            <svg class="ticket-barcode" :viewBox="`0 0 ${barcodeWidth} 8`" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                                <rect v-for="(bar, i) in barcode" :key="i" :x="bar.x" y="0" :width="bar.w" height="8" />
                            </svg>
                        </div>
                    </div>

                    <div v-else key="details" class="ticket-details">
                        <div class="bus-col">
                            <span class="detail-label">{{ bus ? 'Bus' : 'On foot' }}</span>
                            <span class="bus-number num">{{ bus || 'Walk' }}</span>
                        </div>

                        <div class="detail-col">
                            <template v-if="bus">
                                <span class="detail-label">Board at</span>
                                <p class="detail-value">{{ boardAt }} <span class="detail-muted num">· {{ walk }}</span></p>
                            </template>

                            <span class="detail-label">{{ bus ? 'Get off at' : 'Walk to' }}</span>
                            <p class="detail-value">{{ getOffAt }} <span class="detail-muted">· {{ area }}</span></p>

                            <span class="detail-label">{{ bus ? 'Ride' : 'Walk' }}</span>
                            <p class="detail-value">
                                <template v-if="bus"><span class="num">{{ stops }}</span> stops, </template>about <span class="num">{{ travelTime }}</span> min
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

        <div v-if="resettable && isRevealed" class="stub-reset-row">
            <button type="button" class="btn-wb-ghost btn-sm" @click="isRevealed = false">
                <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                Put the stub back
            </button>
        </div>
    </div>
</template>

<style scoped>
/* Flat paper at rest, no elevation (design.md §3.4). The stub only lifts while it is being dragged. */
.spin-ticket {
  width: 100%;
  max-width: 580px;
  margin-inline: auto;
  text-align: left;
}

.spin-ticket--vertical {
  max-width: 272px;
}

.ticket-body {
  position: absolute;
  inset: 0;
  padding: var(--sp-5);
  border-left: 6px solid var(--wb-green);
  overflow: hidden;
}

.spin-ticket--vertical .ticket-body {
  padding: 20px;
  border-left: 0;
  border-top: 6px solid var(--wb-green);
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
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  font-size: var(--fs-lead);
}

.ticket-title {
  margin: 0 0 2px;
  font-family: var(--font-display);
  font-size: var(--fs-lead);
  font-weight: 600;
  line-height: 1.2;
  color: var(--wb-ink);
}

.ticket-subtitle {
  margin: 0 0 10px;
  font-size: var(--fs-small);
  color: var(--wb-text-2);
}

.ticket-time {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-small);
  color: var(--wb-text-2);
}

.ticket-barcode {
  display: block;
  height: 8px;
  width: 170px;
  max-width: 100%;
  margin-top: var(--sp-3);
  fill: var(--wb-line);
}

.ticket-details {
  display: flex;
  gap: var(--sp-5);
}

.bus-col,
.detail-col {
  display: flex;
  flex-direction: column;
}

.bus-number {
  font-family: var(--font-display);
  font-size: calc(var(--fs-title) * 2); /* the ticket's one big numeral, like the service number on the bus */
  font-weight: 600;
  line-height: 1;
  color: var(--wb-ink);
}

.detail-label {
  font-size: var(--fs-small);
  color: var(--wb-muted);
}

.detail-value {
  margin: 0 0 var(--sp-2);
  font-weight: 600;
  color: var(--wb-ink);
}

.detail-muted {
  font-weight: 400;
  color: var(--wb-muted);
}

.ticket-stub {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-left: 6px;
  color: var(--wb-on-ink); /* white on --wb-green, 5.39:1 */
}

.spin-ticket--vertical .ticket-stub {
  padding-left: 0;
  padding-top: 6px;
}

.stub-mark {
  font-family: var(--font-display);
  font-size: var(--fs-title);
  font-weight: 600;
  line-height: 1;
}

.stub-text {
  font-size: var(--fs-small);
  font-weight: 500;
}

.stub-reset-row {
  display: flex;
  justify-content: center;
  margin-top: var(--sp-3);
}

/* Vertical: bus number on top, details stacked below */
.spin-ticket--vertical .ticket-face {
  justify-content: flex-start;
  gap: var(--sp-7);
}

.spin-ticket--vertical .ticket-details {
  flex-direction: column;
  gap: var(--sp-4);
}

.spin-ticket--vertical .detail-label {
  font-size: var(--fs-meta);
}

.spin-ticket--vertical .detail-value {
  margin-bottom: 6px;
  font-size: var(--fs-small);
  line-height: 1.25;
}

/* Narrow phones: tighter padding, bus number above the details */
.spin-ticket--compact .ticket-body {
  padding: var(--sp-4);
}

.spin-ticket--compact .ticket-details {
  flex-direction: column;
  gap: var(--sp-1);
}

.spin-ticket--compact .bus-col {
  flex-direction: row;
  align-items: baseline;
  gap: var(--sp-2);
}

.spin-ticket--compact .bus-number {
  font-size: var(--fs-title);
}

.spin-ticket--compact .detail-value {
  margin-bottom: 2px;
  font-size: var(--fs-small);
}

/* Face -> details */
.reveal-enter-active {
  transition: opacity 320ms var(--ease), transform var(--t-reveal) var(--ease);
}

.reveal-leave-active {
  transition: opacity 140ms var(--ease);
}

.reveal-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.reveal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .reveal-enter-active,
  .reveal-leave-active {
    transition: opacity 1ms;
  }

  .reveal-enter-from {
    transform: none;
  }
}
</style>
