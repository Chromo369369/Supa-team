<!--
  SpinTicket: a mystery trip shown as a bus ticket. Drag the stub to tear it off (or focus it and
  press Enter) to reveal the bus, boarding stop and destination.

  `compact`: a small, already-torn ticket strip (bus, board at, get off at, ride) for the passport
  memory card. Not interactive: no stub, no tilt, no focus stop, no reset button. Reads at ~260px.

  `band`: the travel-time band from the belt (TicketBelt's bandFor), so the torn ticket keeps the
  colour it rode in on. short = green stub with white text (5.39:1), medium = amber stub with ink
  text (8.45:1), long = ink stub with white text (17.1:1). The default is short (green).

  Horizontal tickets are drawn at the container's own width (from 280px up to 580px), so the right
  edge meets its container's edge.
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
    headingLevel: { type: Number, default: 2, validator: (n) => n >= 2 && n <= 6 },
    /** Mini, non-interactive strip of the torn ticket (passport memory card). Ignores orientation. */
    compact: { type: Boolean, default: false },
    /** Travel-time band: 'short' (green), 'medium' (amber) or 'long' (ink). Colours the stub and accents. */
    band: { type: String, default: 'short', validator: (b) => ['short', 'medium', 'long'].includes(b) }
})

// Stub fill and the text on it; each pair is at least 4.5:1.
const BAND_COLOURS = {
    short: { fill: 'var(--wb-green)', ink: 'var(--wb-on-ink)' },
    medium: { fill: 'var(--wb-amber)', ink: 'var(--wb-ink)' },
    long: { fill: 'var(--wb-ink)', ink: 'var(--wb-on-ink)' }
}
const colours = computed(() => BAND_COLOURS[props.band] ?? BAND_COLOURS.short)

const emit = defineEmits(['tear'])

const isRevealed = ref(false)

const wrap = ref(null)
const available = ref(580)
let observer = null

// The reveal is a CSS transition; JS also drops it under reduced motion (the global guard is the backstop).
const reduceMotion = ref(false)
let motionQuery = null
const onMotionChange = () => {
    reduceMotion.value = motionQuery.matches
}

onMounted(() => {
    const measure = () => {
        if (wrap.value) available.value = wrap.value.clientWidth || available.value
    }
    measure()
    observer = new ResizeObserver(measure)
    observer.observe(wrap.value)

    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduceMotion.value = motionQuery.matches
    motionQuery.addEventListener('change', onMotionChange)
})
onBeforeUnmount(() => {
    observer?.disconnect()
    motionQuery?.removeEventListener('change', onMotionChange)
})

const vertical = computed(() => !props.compact && props.orientation === 'vertical')
const torn = computed(() => props.compact || isRevealed.value)

// The tear geometry is drawn in px, so pick a size that fits the space we have.
const size = computed(() => {
    if (props.compact) return { width: Math.min(360, Math.max(240, available.value)), height: 108, stub: 16 }
    if (vertical.value) return { width: Math.min(272, Math.max(220, available.value)), height: 392, stub: 96 }
    const width = Math.min(580, Math.max(280, available.value))
    if (width < 400) return { width, height: 210, stub: 92 }
    return { width, height: 230, stub: 130 }
})
const narrow = computed(() => !props.compact && !vertical.value && size.value.width < 400)
const holes = computed(() => (props.compact ? 6 : vertical.value ? 16 : 14))
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
    if (props.compact) return
    isRevealed.value = true
    emit('tear')
}
</script>

<template>
    <div
        ref="wrap"
        class="spin-ticket"
        :class="{ 'spin-ticket--narrow': narrow, 'spin-ticket--vertical': vertical, 'spin-ticket--strip': compact }"
        :style="{ '--st-accent': colours.fill, '--st-on-accent': colours.ink }"
    >
        <!-- border-width 4 shows a 2px ink outline: the paper covers the stroke's inner half. -->
        <TearTicket
            :torn="torn"
            :orientation="vertical ? 'vertical' : 'horizontal'"
            :width="size.width"
            :height="size.height"
            :stub-size="size.stub"
            :holes="holes"
            :hole-size="4"
            :notch="compact ? 6 : 9"
            :radius="compact ? 12 : 16"
            background="var(--wb-surface)"
            :stub-background="colours.fill"
            border-color="var(--wb-ink)"
            :border-width="4"
            :recenter="!vertical && !compact"
            :tilt="!compact"
            aria-label="Tear the stub to reveal your bus"
            @tear="onTear"
        >
            <div v-if="compact" class="ticket-body ticket-strip">
                <p class="strip-head">
                    <span class="strip-bus">
                        <i :class="['bi', bus ? 'bi-bus-front' : 'bi-person-walking']" aria-hidden="true"></i>
                        <span v-if="bus" class="num">{{ bus }}</span>
                        <template v-else>Walk</template>
                    </span>
                    <span class="strip-meta">
                        <template v-if="bus && stops != null"><span class="num">{{ stops }}</span> stops<template v-if="travelTime != null"> · </template></template>
                        <template v-if="travelTime != null">about <span class="num">{{ travelTime }}</span> min</template>
                    </span>
                </p>
                <dl class="strip-rows">
                    <template v-if="bus">
                        <dt>Board at</dt>
                        <dd :title="boardAt">{{ boardAt }}</dd>
                    </template>
                    <dt>{{ bus ? 'Get off at' : 'Walk to' }}</dt>
                    <dd :title="area ? `${getOffAt} · ${area}` : getOffAt">{{ getOffAt }}<span v-if="area" class="detail-muted"> · {{ area }}</span></dd>
                </dl>
            </div>

            <div v-else class="ticket-body">
                <Transition :name="reduceMotion ? 'reveal-instant' : 'reveal'" mode="out-in">
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

            <template v-if="!compact" #stub>
                <div class="ticket-stub">
                    <span class="stub-mark" aria-hidden="true">?</span>
                    <span class="stub-text">Tear here</span>
                </div>
            </template>
        </TearTicket>

        <div v-if="resettable && isRevealed && !compact" class="stub-reset-row">
            <button type="button" class="btn-wb-ghost" @click="isRevealed = false">
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
  border-left: 6px solid var(--st-accent, var(--wb-green));
  overflow: hidden;
}

.spin-ticket--vertical .ticket-body {
  padding: 20px;
  border-left: 0;
  border-top: 6px solid var(--st-accent, var(--wb-green));
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
  color: var(--st-on-accent, var(--wb-on-ink)); /* white on green 5.39:1, ink on amber 8.45:1, white on ink 17.1:1 */
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
.spin-ticket--narrow .ticket-body {
  padding: var(--sp-4);
}

.spin-ticket--narrow .ticket-details {
  flex-direction: column;
  gap: var(--sp-1);
}

.spin-ticket--narrow .bus-col {
  flex-direction: row;
  align-items: baseline;
  gap: var(--sp-2);
}

.spin-ticket--narrow .bus-number {
  font-size: var(--fs-title);
}

.spin-ticket--narrow .detail-value {
  margin-bottom: 2px;
  font-size: var(--fs-small);
}

/* Compact strip: the torn ticket in miniature, for the passport memory card */
.spin-ticket--strip {
  max-width: 360px;
  margin-inline: 0;
}

.ticket-strip {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
  border-left-width: 4px;
}

.strip-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
  margin: 0;
}

.strip-bus {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--font-display);
  font-size: var(--fs-lead);
  font-weight: 600;
  line-height: 1;
  color: var(--wb-ink);
}

.strip-bus .bi {
  font-size: var(--fs-body);
}

.strip-meta {
  font-size: var(--fs-meta);
  color: var(--wb-text-2);
  white-space: nowrap;
}

.strip-rows {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: var(--sp-2);
  row-gap: 2px;
  margin: 0;
  font-size: var(--fs-small);
  line-height: 1.3;
}

.strip-rows dt {
  font-size: var(--fs-meta);
  font-weight: 400;
  line-height: 1.6;
  color: var(--wb-muted);
}

.strip-rows dd {
  margin: 0;
  overflow: hidden;
  font-weight: 600;
  color: var(--wb-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
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
