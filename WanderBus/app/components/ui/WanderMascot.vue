<script lang="ts">
export type MascotMood = 'idle' | 'loading' | 'happy' | 'sad' | 'sleepy' | 'wave' | 'peek' | 'cover-eyes'
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMotionPrefs, usePointer } from '~/composables/usePointer'

const props = withDefaults(defineProps<{
  mood?: MascotMood
  color?: string
  size?: number
  gaze?: boolean
  target?: { x: number; y: number } | null
  label?: string
  hat?: 'captain' | null
}>(), {
  mood: 'idle',
  color: 'var(--wb-green)',
  size: 48,
  gaze: false,
  target: null,
  label: '',
  hat: null,
})

const root = ref<SVGSVGElement | null>(null)
const { reducedMotion, coarsePointer } = useMotionPrefs()

// The pointer is only needed for pointer gaze (a target needs no listener).
const followsPointer = computed(() => props.gaze && !props.target && !reducedMotion.value && !coarsePointer.value)
const pointer = usePointer({ active: followsPointer })

const asleep = computed(() => props.mood === 'idle' && followsPointer.value && pointer.idle.value)
const currentMood = computed<MascotMood>(() => (asleep.value ? 'sleepy' : props.mood))

const gazeOn = computed(() => {
  if (!props.gaze || reducedMotion.value) return false
  if (currentMood.value === 'sleepy' || currentMood.value === 'cover-eyes') return false
  return props.target ? true : !coarsePointer.value
})

/* ── gaze: eyes shift toward the point, at most 3 screen px ── */
const dx = ref(0)
const dy = ref(0)

function look() {
  const el = root.value
  const point = props.target ?? (pointer.hasMoved.value ? { x: pointer.x.value, y: pointer.y.value } : null)
  if (!gazeOn.value || !el || !point) {
    dx.value = 0
    dy.value = 0
    return
  }
  const r = el.getBoundingClientRect()
  const vx = point.x - (r.left + r.width / 2)
  const vy = point.y - (r.top + r.height * 0.46)
  const dist = Math.hypot(vx, vy)
  if (dist < 1) {
    dx.value = 0
    dy.value = 0
    return
  }
  // 3px on screen in viewBox units, capped so tiny mascots don't cross-eye themselves.
  const reach = Math.min(6, (3 * 100) / props.size) * Math.min(1, dist / 160)
  dx.value = (vx / dist) * reach
  dy.value = (vy / dist) * reach
}

watch(
  [() => pointer.x.value, () => pointer.y.value, () => props.target?.x, () => props.target?.y, gazeOn],
  look,
)

/* ── blinking ── */
const blinking = ref(false)
const startled = ref(false)
let blinkTimer: ReturnType<typeof setTimeout> | undefined
let blinkEnd: ReturnType<typeof setTimeout> | undefined
let startleEnd: ReturnType<typeof setTimeout> | undefined
let alive = false

function blink() {
  if (reducedMotion.value) return
  clearTimeout(blinkEnd)
  blinking.value = true
  blinkEnd = setTimeout(() => { blinking.value = false }, 180)
}

function scheduleBlink() {
  clearTimeout(blinkTimer)
  if (!alive || reducedMotion.value) return
  if (currentMood.value !== 'idle' && currentMood.value !== 'peek') return
  blinkTimer = setTimeout(() => {
    blink()
    scheduleBlink()
  }, 4000 + Math.random() * 2000)
}

watch([currentMood, reducedMotion], scheduleBlink)

// Woken by a pointer move: one startled blink.
watch(asleep, (now, was) => {
  if (!was || now || reducedMotion.value) return
  clearTimeout(startleEnd)
  startled.value = true
  startleEnd = setTimeout(() => { startled.value = false }, 420)
})

onMounted(() => {
  alive = true
  scheduleBlink()
})
onBeforeUnmount(() => {
  alive = false
  clearTimeout(blinkTimer)
  clearTimeout(blinkEnd)
  clearTimeout(startleEnd)
})

defineExpose({ blink })

/* ── drawing ── */
const MOUTHS: Record<MascotMood, string> = {
  idle: 'M43 66 Q50 72 57 66',
  loading: 'M47 68 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0',
  happy: 'M40 63 Q50 79 60 63 Q50 67 40 63 Z',
  sad: 'M43 71 Q50 64 57 71',
  sleepy: 'M46 68 L54 68',
  wave: 'M41 64 Q50 74 59 64',
  peek: 'M45 66 Q50 69 55 66',
  'cover-eyes': 'M46 69 Q50 65 54 69',
}
const mouth = computed(() => MOUTHS[currentMood.value])

// Outline stays a crisp 1–2px at any size (non-scaling stroke).
const outline = computed(() => (props.size < 40 ? 1 : 2))

const a11y = computed(() =>
  props.label ? { role: 'img', 'aria-label': props.label } : { 'aria-hidden': 'true' as const },
)
</script>

<template>
  <svg
    ref="root"
    class="wander-mascot"
    :class="[`is-${currentMood}`, { 'is-blinking': blinking, 'is-startled': startled }]"
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    focusable="false"
    :style="{ '--wm-color': color }"
    v-bind="a11y"
  >
    <g class="wm-rig">
      <circle class="wm-body" cx="50" cy="54" r="40" vector-effect="non-scaling-stroke" :stroke-width="outline" />
      <ellipse class="wm-shine" cx="35" cy="32" rx="10" ry="5.5" transform="rotate(-28 35 32)" />

      <g class="wm-eyes" :style="{ transform: `translate(${dx}px, ${dy}px)` }">
        <rect class="wm-eye" x="31.5" y="38" width="9" height="16" rx="4.5" />
        <rect class="wm-eye" x="59.5" y="38" width="9" height="16" rx="4.5" />
      </g>
      <path class="wm-mouth" :d="mouth" :style="{ transform: `translate(${dx / 2}px, ${dy / 2}px)` }" />

      <ellipse class="wm-arm wm-arm-l" cx="13" cy="64" rx="7" ry="10" vector-effect="non-scaling-stroke" :stroke-width="outline" />
      <ellipse class="wm-arm wm-arm-r" cx="87" cy="64" rx="7" ry="10" vector-effect="non-scaling-stroke" :stroke-width="outline" />

      <text v-if="currentMood === 'sleepy'" class="wm-z" x="78" y="20">z</text>

      <!-- captain's cap, drawn in its own 60 x 30 space and set on the crown of the head -->
      <g v-if="hat === 'captain'" class="wm-hat" transform="translate(20 -3) rotate(-7 30 20)">
        <path class="wm-hat-crown" d="M3 13 Q30 -3 57 13 L50 19 L10 19 Z" vector-effect="non-scaling-stroke" :stroke-width="outline" />
        <rect class="wm-hat-band" x="10" y="18" width="40" height="6" rx="1" />
        <path class="wm-hat-visor" d="M9 23 Q30 33 51 23 Q30 27 9 23 Z" />
        <circle class="wm-hat-badge" cx="30" cy="12" r="3.5" vector-effect="non-scaling-stroke" :stroke-width="outline" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.wander-mascot {
  display: inline-block;
  flex-shrink: 0;
  overflow: visible;
  vertical-align: middle;
}

.wm-rig,
.wm-eye,
.wm-arm,
.wm-z {
  transform-box: fill-box;
}

.wm-rig { transform-origin: 50% 100%; }

.wm-body {
  fill: var(--wm-color);
  stroke: var(--wb-ink);
}

.wm-shine {
  fill: var(--wb-surface);
  opacity: .22;
}

.wm-eyes,
.wm-mouth {
  transition: transform 120ms var(--ease);
}

.wm-eye {
  fill: var(--wb-ink);
  transform-origin: center;
  transition: transform var(--t-micro) var(--ease);
}

.wm-mouth {
  fill: none;
  stroke: var(--wb-ink);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wm-arm {
  fill: var(--wm-color);
  stroke: var(--wb-ink);
  transform-origin: center;
  transition: transform var(--t-ui) var(--ease-spring);
}

.wm-hat-crown {
  fill: var(--wb-surface);
  stroke: var(--wb-ink);
  stroke-linejoin: round;
}
.wm-hat-band,
.wm-hat-visor { fill: var(--wb-ink); }
.wm-hat-badge {
  fill: var(--wb-amber);
  stroke: var(--wb-ink);
}

.wm-z {
  fill: var(--wb-ink);
  font: 600 18px var(--font-display);
}

/* idle (and peek): random blink, started from JS */
.is-blinking .wm-eye { animation: wm-blink 180ms var(--ease); }
@keyframes wm-blink {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(.1); }
}

/* woken up: eyes pop wide, then blink */
.is-startled .wm-eye { animation: wm-startle var(--t-reveal) var(--ease); }
@keyframes wm-startle {
  0% { transform: scaleY(.15); }
  35% { transform: scale(1.25); }
  65% { transform: scaleY(.1); }
  100% { transform: none; }
}

/* loading: a 6px bob, 1.2s loop */
.is-loading .wm-rig { animation: wm-bob 1.2s ease-in-out infinite; }
@keyframes wm-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* happy: hop with squash and stretch, then the smile stays */
.is-happy .wm-mouth { fill: var(--wb-ink); }
.is-happy .wm-rig { animation: wm-hop var(--t-reveal) var(--ease-spring); }
@keyframes wm-hop {
  0% { transform: scale(1.08, .9); }
  40% { transform: translateY(-12px) scale(.94, 1.08); }
  75% { transform: translateY(0) scale(1.05, .95); }
  100% { transform: none; }
}

/* sad: drops 4px, mouth flips, eyes droop */
.is-sad .wm-eye { transform: translateY(2px) scaleY(.8); }
.is-sad .wm-rig { animation: wm-droop var(--t-reveal) var(--ease) forwards; }
@keyframes wm-droop {
  to { transform: translateY(4px); }
}

/* sleepy: eyes become lines, a "z" floats up */
.is-sleepy .wm-eye { transform: translateY(5px) scaleY(.18); }
.is-sleepy .wm-z { animation: wm-z 2s ease-in-out infinite; }
@keyframes wm-z {
  0% { transform: translate(0, 6px) scale(.7); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translate(6px, -12px) scale(1.1); opacity: 0; }
}

/* wave: right arm swings up from the shoulder and rocks ±20° three times */
.is-wave .wm-arm-r {
  transform-origin: 50% 5%;
  animation: wm-wave var(--t-signature) var(--ease);
}
@keyframes wm-wave {
  0%, 100% { transform: rotate(0); }
  14% { transform: rotate(-140deg); }
  28% { transform: rotate(-120deg); }
  42% { transform: rotate(-160deg); }
  56% { transform: rotate(-120deg); }
  70% { transform: rotate(-160deg); }
  84% { transform: rotate(-140deg); }
}

/* peek: rises a little over an edge */
.is-peek .wm-rig { animation: wm-peek var(--t-reveal) var(--ease-spring) both; }
@keyframes wm-peek {
  from { transform: translateY(12px); }
  to { transform: none; }
}

/* cover-eyes: both arms come up over the eyes, body shrinks a touch */
.is-cover-eyes .wm-arm-l { transform: translate(23px, -18px) rotate(-18deg); }
.is-cover-eyes .wm-arm-r { transform: translate(-23px, -18px) rotate(18deg); }
.is-cover-eyes .wm-rig { animation: wm-shy var(--t-ui) var(--ease) forwards; }
@keyframes wm-shy {
  to { transform: translateY(3px) scale(.97); }
}

@media (prefers-reduced-motion: reduce) {
  .wm-z { animation: none; opacity: 1; }
  .wm-eyes, .wm-mouth { transition: none; }
}
</style>
