<!--
  BusDriveBy: the bus that carries every state (design.md §3.2, §3.3). A flat SVG side view with a
  green body, ink windows, the mascot in the second window, a mini LedBoard destination sign, two
  wheels and a road line. Original WanderBus drawing, no ported source.

  Props
    mode       parked | arrive | depart | idle-loop | breakdown                      (default parked)
    label      LED text, shown in capitals                                            (default '')
    badge      optional LED badge on the left of the sign, e.g. a bus number          (default '')
    size       sm | md | lg: max width 160 / 360 / 520 px, scales down with its box    (default md)
    skippable  click, Enter, Space or Escape jumps the current mode to its end state  (default false)
    delay      ms to wait before the mode starts (stagger buses into bays)            (default 0)
    mood       override the mascot mood, e.g. 'wave' while parked at the pole         (default auto)
    mascotColor  mascot body colour                                                   (default var(--wb-green))

  Emits
    done(mode)  when arrive, depart or breakdown finish (or are skipped). parked and idle-loop
                never emit: parked has nothing to play and idle-loop runs until the mode changes.

  Exposes `play()` (replay the current mode) and `skip()` through a template ref. A parent can also
  replay by changing `:key`.

  Timings (§3.2)
    arrive     drive in from -120% to centre, 900 ms --ease; 120 ms squash; doors open --t-ui (1270 ms)
    depart     doors close --t-ui, then drive from centre to +120%, 700 ms --ease      (950 ms)
    idle-loop  wheels roll, road dashes scroll, body bobs 2 px over --t-signature    (loops)
    breakdown  3° tilt with a wobble, puff of smoke scales and fades, mascot sad      (900 ms)

  Accessibility: the drawing is decorative. Without `skippable` the whole thing is aria-hidden and
  has no tab stop. With it, the root is a button named "Skip the bus animation" with a visible focus
  ring. It never announces state itself; parents do that. Under reduced motion the end state shows at
  once and `done` fires on the next tick.
-->
<script lang="ts">
export type BusMode = 'parked' | 'arrive' | 'depart' | 'idle-loop' | 'breakdown'
export type BusSize = 'sm' | 'md' | 'lg'
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LedBoard from '~/components/ui/LedBoard.vue'
import WanderMascot, { type MascotMood } from '~/components/ui/WanderMascot.vue'
import { useMotionPrefs } from '~/composables/usePointer'

const props = withDefaults(defineProps<{
  mode?: BusMode
  label?: string
  badge?: string
  size?: BusSize
  skippable?: boolean
  delay?: number
  mood?: MascotMood | null
  mascotColor?: string
}>(), {
  mode: 'parked',
  label: '',
  badge: '',
  size: 'md',
  skippable: false,
  delay: 0,
  mood: null,
  mascotColor: 'var(--wb-green)',
})

const emit = defineEmits<{ done: [mode: BusMode] }>()

/* ── timings (ms); passed to CSS as custom properties so both sides agree ── */
const DRIVE_IN = 900
const SQUASH = 120
const DOORS = 250 // --t-ui
const DRIVE_OUT = 700
const BREAKDOWN = 900

const ENDS: Partial<Record<BusMode, number>> = {
  arrive: DRIVE_IN + SQUASH + DOORS,
  depart: DOORS + DRIVE_OUT,
  breakdown: BREAKDOWN,
}

/* ── geometry: everything below is in viewBox units (320 × 140) ── */
const VB_W = 320
const VB_H = 140
const SIGN = { x: 127, y: 25, w: 148, h: 24 }
const WIN2 = { x: 194, y: 58, w: 46, h: 36 }
const pct = (v: number, of: number) => `${(v / of) * 100}%`
const box = (r: { x: number; y: number; w: number; h: number }) => ({
  left: pct(r.x, VB_W),
  top: pct(r.y, VB_H),
  width: pct(r.w, VB_W),
  height: pct(r.h, VB_H),
})
const signBox = box(SIGN)
const winBox = box(WIN2)

const SSR_WIDTH: Record<BusSize, number> = { sm: 140, md: 320, lg: 480 }

const root = ref<HTMLElement | null>(null)
const bus = ref<HTMLElement | null>(null)
const busW = ref(SSR_WIDTH[props.size])
const { reducedMotion } = useMotionPrefs()

// LED dots sized so the 17-row board exactly fills the sign; mascot about its window's height.
const ledPitch = computed(() => Math.max(0.4, Math.round(((busW.value * SIGN.h) / VB_W / 17) * 100) / 100))
const mascotPx = computed(() => Math.max(14, Math.round(((busW.value * WIN2.h) / VB_W) * 1.05)))
const ledText = computed(() => props.label.toUpperCase())

/* ── state ── */
type Phase = 'rest' | 'play' | 'end'
const phase = ref<Phase>('rest')
const stopped = ref(false) // arrive: the bus has pulled up
const doorsOpen = ref(false)

const canSkip = computed(() => props.skippable && props.mode in ENDS)
const playing = computed(() => phase.value === 'play')

const mascotMood = computed<MascotMood>(() => {
  if (props.mood) return props.mood
  switch (props.mode) {
    case 'arrive': return stopped.value ? 'happy' : 'idle'
    case 'depart': return 'happy'
    case 'idle-loop': return 'loading'
    case 'breakdown': return 'sad'
    default: return 'idle'
  }
})

let timers: ReturnType<typeof setTimeout>[] = []
let alive = false
let runId = 0

function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}
function at(ms: number, fn: () => void) {
  timers.push(setTimeout(fn, Math.max(0, ms)))
}

function settle(mode: BusMode) {
  stopped.value = true
  doorsOpen.value = mode === 'arrive'
  phase.value = 'end'
}

function finish(announce = true) {
  clearTimers()
  const mode = props.mode
  settle(mode)
  if (announce && mode in ENDS) emit('done', mode)
}

async function play() {
  if (!alive) return
  clearTimers()
  const id = ++runId
  const mode = props.mode
  const end = ENDS[mode]

  if (reducedMotion.value) {
    settle(mode)
    if (end !== undefined) {
      await nextTick()
      if (id === runId) emit('done', mode)
    }
    return
  }

  stopped.value = mode !== 'arrive'
  if (mode !== 'depart') doorsOpen.value = false

  // Drop the play class for one frame so the same mode can replay from the top.
  phase.value = 'rest'
  await nextTick()
  if (id !== runId) return
  void root.value?.offsetWidth
  phase.value = 'play'

  const d = Math.max(0, props.delay)
  if (mode === 'arrive') {
    at(d + DRIVE_IN, () => { stopped.value = true })
    at(d + DRIVE_IN + SQUASH, () => { doorsOpen.value = true })
  } else if (mode === 'depart') {
    at(d, () => { doorsOpen.value = false })
  }
  if (end !== undefined) at(d + end, () => finish())
}

function skip() {
  if (!canSkip.value || !playing.value) return
  finish()
}

function onKey(e: KeyboardEvent) {
  if (!canSkip.value) return
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
    if (e.key === ' ') e.preventDefault()
    skip()
  }
}

watch(() => props.mode, () => { play() })
// Reduced motion switched on mid-run: jump to the end.
watch(reducedMotion, (on) => { if (on && playing.value) finish() })

let resizeObserver: ResizeObserver | null = null
function measure() {
  if (bus.value) busW.value = bus.value.clientWidth || busW.value
}

onMounted(() => {
  alive = true
  measure()
  if (typeof ResizeObserver !== 'undefined' && bus.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(bus.value)
  }
  play()
})
onBeforeUnmount(() => {
  alive = false
  runId++
  clearTimers()
  resizeObserver?.disconnect()
})

defineExpose({ play, skip })

const rootAttrs = computed(() =>
  canSkip.value
    ? {
        role: 'button',
        tabindex: 0,
        'aria-label': 'Skip the bus animation',
        'aria-disabled': playing.value ? undefined : ('true' as const),
      }
    : { 'aria-hidden': 'true' as const },
)

const timing = computed(() => ({
  '--bdb-delay': `${Math.max(0, props.delay)}ms`,
  '--bdb-in': `${DRIVE_IN}ms`,
  '--bdb-squash': `${SQUASH}ms`,
  '--bdb-doors': `${DOORS}ms`,
  '--bdb-out': `${DRIVE_OUT}ms`,
  '--bdb-break': `${BREAKDOWN}ms`,
}))
</script>

<template>
  <div
    ref="root"
    class="bdb"
    :class="[`bdb--${size}`, `is-${mode}`, `is-${phase}`, { 'is-skippable': canSkip, 'is-doors-open': doorsOpen }]"
    :style="timing"
    v-bind="rootAttrs"
    @click="skip"
    @keydown="onKey"
  >
    <div class="bdb-road" aria-hidden="true">
      <svg class="bdb-dashes" focusable="false" aria-hidden="true"><line x1="0" y1="1" x2="100%" y2="1" /></svg>
    </div>

    <div class="bdb-drive" aria-hidden="true">
      <div ref="bus" class="bdb-pose">
        <div class="bdb-bob">
          <svg class="bdb-svg" :viewBox="`0 0 ${VB_W} ${VB_H}`" focusable="false" aria-hidden="true">
            <!-- body -->
            <rect class="bdb-body" x="6" y="18" width="300" height="104" rx="14" />
            <rect class="bdb-roof" x="20" y="18" width="272" height="4" />
            <rect class="bdb-skirt" x="6" y="104" width="300" height="6" />
            <!-- sign bezel (LED sits on top) -->
            <rect class="bdb-ink" x="125" y="23" width="152" height="28" rx="3" />
            <!-- side windows, back to front -->
            <rect class="bdb-ink" x="38" y="58" width="46" height="36" rx="4" />
            <rect class="bdb-ink" x="90" y="58" width="46" height="36" rx="4" />
            <rect class="bdb-ink" x="142" y="58" width="46" height="36" rx="4" />
            <rect class="bdb-ink" x="194" y="58" width="46" height="36" rx="4" />
            <!-- windscreen -->
            <path class="bdb-ink" d="M284 24 H296 Q302 24 302 32 V92 Q302 96 298 96 H284 Z" />
            <!-- doorway: panels slide into the body, clipped by the frame -->
            <rect class="bdb-ink" x="246" y="56" width="32" height="62" rx="2" />
            <svg x="247" y="57" width="30" height="60" viewBox="0 0 30 60" overflow="hidden">
              <g class="bdb-door bdb-door-l">
                <rect class="bdb-door-panel" x="0" y="0" width="15" height="60" />
                <rect class="bdb-glass" x="3" y="4" width="9" height="30" rx="1.5" />
              </g>
              <g class="bdb-door bdb-door-r">
                <rect class="bdb-door-panel" x="15" y="0" width="15" height="60" />
                <rect class="bdb-glass" x="18" y="4" width="9" height="30" rx="1.5" />
              </g>
            </svg>
            <!-- lights -->
            <rect class="bdb-head" x="300" y="100" width="6" height="8" rx="1.5" />
            <rect class="bdb-tail" x="6" y="98" width="4" height="10" rx="1" />
          </svg>

          <div class="bdb-sign" :style="signBox">
            <LedBoard class="bdb-led" :line1="ledText" :badge="badge" :pitch="ledPitch" />
          </div>
          <div class="bdb-window" :style="winBox">
            <WanderMascot class="bdb-mascot" :mood="mascotMood" :size="mascotPx" :color="mascotColor" />
          </div>
        </div>

        <svg class="bdb-svg bdb-under" :viewBox="`0 0 ${VB_W} ${VB_H}`" focusable="false" aria-hidden="true">
          <!-- puff of smoke (breakdown) -->
          <circle class="bdb-puff bdb-puff-1" cx="26" cy="12" r="7" />
          <circle class="bdb-puff bdb-puff-2" cx="40" cy="8" r="5" />
          <circle class="bdb-puff bdb-puff-3" cx="16" cy="6" r="4" />
          <!-- wheels -->
          <g v-for="cx in [74, 214]" :key="cx">
            <circle class="bdb-arch" :cx="cx" cy="122" r="20" />
            <g class="bdb-wheel">
              <circle class="bdb-tyre" :cx="cx" cy="122" r="16" />
              <circle class="bdb-hub" :cx="cx" cy="122" r="7" />
              <rect class="bdb-tyre" :x="cx - 1.2" y="115.5" width="2.4" height="5" rx="1" />
              <circle class="bdb-tyre" :cx="cx" cy="122" r="1.6" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bdb {
  position: relative;
  display: block;
  width: 100%;
  max-width: 360px;
  overflow: hidden;
  /* room for the tilt and the wheels to sit on the road */
  padding-bottom: 2px;
  -webkit-tap-highlight-color: transparent;
}
.bdb--sm { max-width: 160px; }
.bdb--lg { max-width: 520px; }

.bdb.is-skippable:not([aria-disabled]) { cursor: pointer; }
.bdb.is-skippable:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
  border-radius: var(--r-control);
}

/* ── road ── */
.bdb-road {
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  overflow: hidden;
  background: var(--wb-line);
}
.bdb-dashes {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(100% + 32px);
  height: 100%;
  overflow: visible;
}
.bdb-dashes line {
  stroke: var(--wb-control);
  stroke-width: 2;
  stroke-dasharray: 16 16;
}

/* ── bus layers ── */
.bdb-drive,
.bdb-pose { position: relative; }
.bdb-pose {
  aspect-ratio: 320 / 140;
  transform-origin: 50% 100%;
}
.bdb-bob { position: absolute; inset: 0; }
.bdb-svg {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.bdb-body { fill: var(--wb-green); }
.bdb-roof { fill: color-mix(in srgb, var(--wb-on-ink) 22%, var(--wb-green)); }
.bdb-skirt { fill: var(--wb-green-hover); }
.bdb-ink,
.bdb-tyre,
.bdb-arch { fill: var(--wb-ink); }
.bdb-arch { fill: color-mix(in srgb, var(--wb-ink) 70%, var(--wb-green)); }
.bdb-door-panel { fill: var(--wb-green-hover); }
.bdb-glass { fill: var(--wb-ink); }
.bdb-head { fill: var(--wb-amber); }
.bdb-tail { fill: var(--wb-danger); }
.bdb-hub { fill: var(--wb-surface-2); }

.bdb-sign,
.bdb-window {
  position: absolute;
  overflow: hidden;
}
.bdb-sign .bdb-led {
  width: 100%;
  border-radius: 2px;
}
.bdb-window {
  border-radius: 4%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.bdb-window .bdb-mascot {
  margin-top: 1%;
}

.bdb-wheel,
.bdb-puff,
.bdb-door {
  transform-box: fill-box;
  transform-origin: center;
}

/* doors: JS toggles .is-doors-open at the right moment; this is the slide */
.bdb-door { transition: transform var(--bdb-doors) var(--ease); }
.is-doors-open .bdb-door-l { transform: translateX(-13px); }
.is-doors-open .bdb-door-r { transform: translateX(13px); }

.bdb-puff {
  fill: var(--wb-control);
  opacity: 0;
}

/* ── arrive ── */
.is-arrive.is-play .bdb-drive {
  animation: bdb-in var(--bdb-in) var(--ease) var(--bdb-delay) both;
}
.is-arrive.is-play .bdb-wheel {
  animation: bdb-roll-in var(--bdb-in) var(--ease) var(--bdb-delay) both;
}
.is-arrive.is-play .bdb-pose {
  animation: bdb-squash var(--bdb-squash) var(--ease-spring) calc(var(--bdb-delay) + var(--bdb-in)) both;
}

/* ── depart ── */
.is-depart.is-play .bdb-drive {
  animation: bdb-out var(--bdb-out) var(--ease) calc(var(--bdb-delay) + var(--bdb-doors)) both;
}
.is-depart.is-play .bdb-wheel {
  animation: bdb-roll-out var(--bdb-out) var(--ease) calc(var(--bdb-delay) + var(--bdb-doors)) both;
}
.is-depart.is-end .bdb-drive {
  transform: translateX(120%);
  opacity: 0;
}

/* ── idle-loop ── */
.is-idle-loop.is-play .bdb-wheel { animation: bdb-roll 700ms linear var(--bdb-delay) infinite; }
.is-idle-loop.is-play .bdb-bob { animation: bdb-bob var(--t-signature) var(--ease) var(--bdb-delay) infinite; }
.is-idle-loop.is-play .bdb-dashes { animation: bdb-road 240ms linear var(--bdb-delay) infinite; }

/* ── breakdown ── */
.is-breakdown.is-play .bdb-pose {
  animation: bdb-tilt 600ms var(--ease) var(--bdb-delay) both;
}
.is-breakdown.is-play .bdb-puff {
  animation: bdb-puff 660ms var(--ease) var(--bdb-delay) both;
}
.is-breakdown.is-play .bdb-puff-2 { animation-delay: calc(var(--bdb-delay) + 120ms); }
.is-breakdown.is-play .bdb-puff-3 { animation-delay: calc(var(--bdb-delay) + 240ms); }
.is-breakdown.is-end .bdb-pose { transform: rotate(3deg); }

@keyframes bdb-in {
  from { transform: translateX(-120%); }
  to { transform: translateX(0); }
}
@keyframes bdb-out {
  from { transform: translateX(0); opacity: 1; }
  90% { opacity: 1; }
  to { transform: translateX(120%); opacity: 0; }
}
/* 120% of a 320-unit bus is 384 units; a wheel of r16 turns ~3.8 times over that distance */
@keyframes bdb-roll-in {
  from { transform: rotate(-1380deg); }
  to { transform: rotate(0deg); }
}
@keyframes bdb-roll-out {
  from { transform: rotate(0deg); }
  to { transform: rotate(1380deg); }
}
@keyframes bdb-roll {
  to { transform: rotate(360deg); }
}
@keyframes bdb-squash {
  0%, 100% { transform: none; }
  45% { transform: scale(1.03, 0.94); }
}
@keyframes bdb-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
@keyframes bdb-road {
  to { transform: translateX(-32px); }
}
@keyframes bdb-tilt {
  0% { transform: rotate(0deg); }
  30% { transform: rotate(4.5deg); }
  55% { transform: rotate(1.6deg); }
  78% { transform: rotate(3.5deg); }
  100% { transform: rotate(3deg); }
}
@keyframes bdb-puff {
  0% { opacity: 0; transform: translate(0, 0) scale(0.3); }
  25% { opacity: 0.9; }
  100% { opacity: 0; transform: translate(-6px, -8px) scale(1.7); }
}

@media (prefers-reduced-motion: reduce) {
  .bdb *,
  .bdb .bdb-door { animation: none !important; transition: none !important; }
}
</style>
