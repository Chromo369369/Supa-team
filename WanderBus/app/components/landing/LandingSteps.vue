<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMotionPrefs } from '~/composables/usePointer'

const steps = [
  { num: 1, title: 'Set your limits', text: 'Choose where you’re starting, how long you have and what you feel like: food, cafés, parks, museums, sights or malls.' },
  { num: 2, title: 'Tear a ticket', text: 'Spin, then tear the stub to see your bus, where to board and where to get off.' },
  { num: 3, title: 'Ride and get off', text: 'Take the bus to your stop. The ride fits in the time you set.' },
  { num: 4, title: 'Explore, then head home', text: 'See what’s within 1 km of the stop, from hawker centres to parks, and save the trip to your passport.' },
]

const BUS_W = 56
const BUS_H = 30
/** where the fill's leading edge sits, as a share of the viewport height */
const READ_LINE = 0.55

const { reducedMotion } = useMotionPrefs()

const list = ref<HTMLElement | null>(null)
const markers = ref<HTMLElement[]>([])

/** false until mounted: the CSS-only full line shows */
const ready = ref(false)
/** true when the fill follows the scroll (not reduced motion) */
const animated = ref(false)
/** 0 … 1 along the line */
const progress = ref(1)
/** stop centres in px from the top of the list, and the line's x */
const stops = ref<number[]>([])
const lineX = ref(0)
/** half a stop marker: the bus runs just ahead of the fill, below the sign it last passed */
const lead = ref(0)


const first = computed(() => stops.value[0] ?? 0)
const span = computed(() => Math.max(0, (stops.value[stops.value.length - 1] ?? 0) - first.value))
const edge = computed(() => progress.value * span.value)

const lit = computed(() => steps.map((_, i) => {
  if (!ready.value || !animated.value) return true
  const at = (stops.value[i] ?? 0) - first.value
  return edge.value >= at - 1
}))

const fillStyle = computed(() => ({
  top: `${first.value}px`,
  height: `${span.value}px`,
  left: `${lineX.value}px`,
  transform: `scaleY(${progress.value})`,
}))
const busStyle = computed(() => ({
  transform: `translate3d(${lineX.value - BUS_W / 2}px, ${first.value + edge.value + lead.value}px, 0)`,
}))

/* ── measuring ── */
function layout() {
  const el = list.value
  if (!el) return
  const box = el.getBoundingClientRect()
  stops.value = markers.value.map((m) => {
    const r = m.getBoundingClientRect()
    return r.top + r.height / 2 - box.top
  })
  const m0 = markers.value[0]?.getBoundingClientRect()
  lineX.value = m0 ? m0.left + m0.width / 2 - box.left : 0
  lead.value = m0 ? m0.height / 2 - 4 : 0
}

let frame = 0
function measure() {
  frame = 0
  const el = list.value
  if (!el || !animated.value) return
  const top = el.getBoundingClientRect().top + first.value
  progress.value = span.value > 0 ? clamp((window.innerHeight * READ_LINE - top) / span.value, 0, 1) : 1
}

function onScroll() {
  if (!frame) frame = requestAnimationFrame(measure)
}

/* ── listeners ── */
let io: IntersectionObserver | null = null
let ro: ResizeObserver | null = null
let listening = false

function listen(on: boolean) {
  if (on === listening) return
  listening = on
  if (on) {
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
  } else {
    window.removeEventListener('scroll', onScroll)
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }
}

function stopScroll() {
  listen(false)
  io?.disconnect()
  io = null
}

function startScroll() {
  stopScroll()
  if (!list.value || typeof IntersectionObserver === 'undefined') {
    progress.value = 1
    return
  }
  io = new IntersectionObserver(([entry]) => listen(!!entry?.isIntersecting))
  io.observe(list.value)
}

function applyMode() {
  const reduce = reducedMotion.value || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const canObserve = typeof IntersectionObserver !== 'undefined'
  animated.value = !reduce && canObserve
  if (animated.value) {
    measure()
    startScroll()
  } else {
    stopScroll()
    progress.value = 1
  }
}

watch(reducedMotion, () => applyMode())

onMounted(() => {
  layout()
  ready.value = true
  applyMode()
  if (typeof ResizeObserver !== 'undefined' && list.value) {
    ro = new ResizeObserver(() => {
      layout()
      measure()
    })
    ro.observe(list.value)
  }
})

onBeforeUnmount(() => {
  stopScroll()
  ro?.disconnect()
  ro = null
})
</script>

<template>
  <section id="how-it-works" class="section-white steps-section">
    <div class="container landing-section">
      <h2 class="section-title steps-heading">How a side quest works</h2>

      <!-- Numbers removed per taste rules; to revert, restore the .step-num circle (step.num is kept).
           The order stays semantic: a real <ol> (role="list" keeps it a list once the markers are hidden). -->
      <div class="route-wrap">
      <ol ref="list" class="route list-unstyled mb-0" :class="{ 'is-live': ready && animated }" role="list">
        <li
          v-for="(step, i) in steps"
          :key="step.num"
          class="route-step"
          :class="{ 'is-lit': lit[i], 'is-last': i === steps.length - 1, 'is-flip': i % 2 === 1 }"
        >
          <!-- the CSS-only line: a segment from this stop down to the next one -->
          <span v-if="i < steps.length - 1" class="route-seg" aria-hidden="true"></span>

          <span ref="markers" class="route-marker" aria-hidden="true">
            <svg class="route-sign" viewBox="0 0 32 24" width="32" height="24" focusable="false" aria-hidden="true">
              <g class="sign-off">
                <rect class="sign-plate" x="0" y="0" width="32" height="24" rx="6" />
                <rect class="sign-glyph" x="8" y="5" width="16" height="9" rx="2" />
                <circle class="sign-glyph" cx="11.5" cy="17" r="2" />
                <circle class="sign-glyph" cx="20.5" cy="17" r="2" />
              </g>
              <g class="sign-on">
                <rect class="sign-plate" x="0" y="0" width="32" height="24" rx="6" />
                <rect class="sign-glyph" x="8" y="5" width="16" height="9" rx="2" />
                <circle class="sign-glyph" cx="11.5" cy="17" r="2" />
                <circle class="sign-glyph" cx="20.5" cy="17" r="2" />
              </g>
            </svg>
          </span>

          <div class="route-copy">
            <h3 class="step-title">{{ step.title }}</h3>
            <p class="step-text mb-0">{{ step.text }}</p>
          </div>
        </li>
      </ol>

        <!-- the scroll fill and the bus: only once the script can place them -->
        <span v-if="ready && animated" class="route-fill" :style="fillStyle" aria-hidden="true"></span>
        <span v-if="ready" class="route-bus" :style="busStyle" aria-hidden="true">
          <svg :width="BUS_W" :height="BUS_H" viewBox="0 0 56 30" focusable="false" aria-hidden="true">
            <rect class="bus-body" x="1" y="2" width="53" height="21" rx="5" />
            <rect class="bus-ink" x="6" y="7" width="9" height="7" rx="1.5" />
            <rect class="bus-ink" x="18" y="7" width="9" height="7" rx="1.5" />
            <rect class="bus-ink" x="30" y="7" width="9" height="7" rx="1.5" />
            <path class="bus-ink" d="M44 6 H50 Q53 6 53 9 V16 H44 Z" />
            <rect class="bus-sign" x="18" y="3" width="21" height="2.4" rx="1" />
            <rect class="bus-sign" x="51" y="18" width="3" height="3" rx="1" />
            <circle class="bus-ink" cx="14" cy="24" r="5" />
            <circle class="bus-ink" cx="42" cy="24" r="5" />
            <circle class="bus-hub" cx="14" cy="24" r="2" />
            <circle class="bus-hub" cx="42" cy="24" r="2" />
          </svg>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.steps-section {
  /* the bus straddles the line; it never causes a sideways scroll */
  overflow-x: clip;
}

.landing-section {
  padding-block: var(--sp-8);
  padding-inline: var(--gutter);
}

@media (min-width: 992px) {
  .landing-section {
    padding-block: var(--sp-9);
  }
}

.steps-heading {
  margin: 0 0 var(--sp-7);
}

/* ── the route ── */
.route-wrap {
  --line-w: 8px;
  --marker: 48px;
  --row-gap: var(--sp-7);
  position: relative;
  max-width: 960px;
  margin-inline: auto;
}
.route {
  position: relative;
  display: grid;
  row-gap: var(--row-gap);
}

/* desktop: line down the centre, copy alternating on either side */
.route-step {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--marker) minmax(0, 1fr);
  column-gap: var(--sp-5);
  align-items: start;
}
.route-marker { grid-column: 2; grid-row: 1; }
.route-copy {
  grid-column: 1;
  grid-row: 1;
  text-align: right;
  justify-self: end;
  max-width: 34ch;
}
.route-step.is-flip .route-copy {
  grid-column: 3;
  text-align: left;
  justify-self: start;
}

/* the stop marker sits on the line; its centre lines up with the title's first line */
.route-marker {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--marker);
  height: var(--marker);
  margin-top: -6px;
}
/* a small knockout around the sign, so the line stops just short of it */
.route-marker::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 40px;
  height: 32px;
  margin: -16px 0 0 -20px;
  border-radius: var(--r-control);
  background: var(--wb-surface);
}
.route-sign { position: relative; }

/* CSS-only line: from this stop's centre to the next stop's centre */
.route-seg {
  position: absolute;
  z-index: 0;
  left: calc(50% - var(--line-w) / 2);
  top: calc(var(--marker) / 2 - 6px);
  bottom: calc(-1 * var(--row-gap) - var(--marker) / 2 + 6px);
  width: var(--line-w);
  border-radius: var(--r-pill);
  background: var(--wb-green);
}

/* with the script, the segments become the unfilled road and the fill takes over */
.route.is-live .route-seg { background: var(--wb-surface-2); }

.route-fill {
  position: absolute;
  z-index: 0;
  width: var(--line-w);
  margin-left: calc(var(--line-w) / -2);
  border-radius: var(--r-pill);
  background: var(--wb-green);
  transform-origin: 50% 0;
  will-change: transform;
}

.route-bus {
  position: absolute;
  z-index: 2;
  left: 0;
  top: 0;
  line-height: 0;
  pointer-events: none;
  will-change: transform;
}
.route-bus svg { display: block; }
.bus-body { fill: var(--wb-green); }
.bus-ink { fill: var(--wb-ink); }
.bus-sign { fill: var(--wb-amber); }
.bus-hub { fill: var(--wb-surface-2); }


/* ── stop signs: unlit and lit layers; lighting is an opacity and scale change only ── */
.sign-off .sign-plate { fill: var(--wb-surface-2); }
.sign-off .sign-glyph { fill: var(--wb-text-2); }
.sign-on .sign-plate { fill: var(--wb-green); }
.sign-on .sign-glyph { fill: var(--wb-on-ink); }
.is-last .sign-on .sign-plate { fill: var(--wb-amber); }
.is-last .sign-on .sign-glyph { fill: var(--wb-ink); }

.sign-on {
  opacity: 0;
  transform: scale(0.6);
  transform-box: fill-box;
  transform-origin: center;
  transition:
    opacity var(--t-ui) var(--ease),
    transform var(--t-ui) var(--ease-spring);
}
.is-lit .sign-on {
  opacity: 1;
  transform: none;
}

.step-title {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-lead);
  font-weight: 600;
  color: var(--wb-ink);
}

.step-text {
  color: var(--wb-text-2);
}

/* phones: the line runs down the left edge, every step to its right */
@media (max-width: 767px) {
  .route-wrap {
    --marker: 40px;
    --row-gap: var(--sp-6);
  }
  .route-step {
    grid-template-columns: var(--marker) minmax(0, 1fr);
    column-gap: var(--sp-4);
  }
  .route-marker { grid-column: 1; }
  .route-copy,
  .route-step.is-flip .route-copy {
    grid-column: 2;
    text-align: left;
    justify-self: start;
    max-width: none;
  }
  .route-seg { left: calc(var(--marker) / 2 - var(--line-w) / 2); }
}

@media (prefers-reduced-motion: reduce) {
  .sign-on { transition: none; }
}
</style>
