<!--
  BoardingIntro: the once-per-session welcome intro (plan Tier 1.5, Wave 1 A).
  Shown on /home, so it plays right after someone registers and logs in, or logs in again in a
  new session, and then lifts away onto the home page (boss, 5 Nov 2026; it used to open the landing).
  Idea inspired by the "ghost builds itself from parts" animation by Nicolas Jesenberger
  (recent.design). Original WanderBus drawing and code, nothing ported.

  Sequence
    0 ms      the overlay opens on ink; the ink layer fades out to ground over 1.2 s
    0–420     the orb body pops in (spring), then its shine
    380–800   the capsule eyes open
    700–1200  the smile draws in, the nub arms slide in from the sides
    1250      the road appears: a mini bus, a stop marker, "Drag the bus to the stop", "Board the bus"
    on board  the bus pulls up at the stop, the WanderBus mark is revealed (scale + circular clip),
              the mascot hops (happy) then waves
    +1500     the overlay lifts away (translateY + opacity, 420 ms) and focus moves to the parent's h1
              (or #main when the parent doesn't handle `close`)

  Ways through
    - drag the bus (Pointer Events, mouse, pen and touch, with pointer capture) and drop it near the stop
    - "Board the bus" button, or Enter / Space on the focused bus
    - "Skip intro" (always visible) or Esc: lifts the overlay away at once
    During the reveal, Skip or Esc goes straight to the lift; nothing queues.

  Rules
    - Plays once per browser session (sessionStorage `wb-intro-seen`, every access in try/catch;
      if storage throws, it plays once per page load). Never shown under reduced motion.
    - `?intro=off` skips it; `?intro=on` forces it even if already seen (not under reduced motion).
    - Renders nothing on the server; decided in onMounted. Teleported to <body>.
    - role="dialog" aria-modal, focus trapped inside, body scroll locked and restored.
    - Animates transform, opacity and clip-path only.

  Emits `close` once the overlay has gone (only if it was shown), so the parent can focus its h1.
-->
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WanderMascot, { type MascotMood } from '~/components/ui/WanderMascot.vue'
import { useMotionPrefs } from '~/composables/usePointer'

const emit = defineEmits<{ close: [] }>()

const STORAGE_KEY = 'wb-intro-seen'
const ASSEMBLED_AT = 1250 // parts are all in (1.2 s) plus a breath
const WAVE_AT = 450 // after the reveal starts: the happy hop has landed
const LIFT_AT = 1500 // after the reveal starts
const LIFT_MS = 420 // matches --t-reveal
const SNAP_PX = 56 // drop this close to the stop and it counts
const BUS_W = 56

// Module level: if sessionStorage is unavailable, still only play once per page load.
let shownThisLoad = false

type Phase = 'build' | 'drag' | 'reveal' | 'leave'

const { reducedMotion } = useMotionPrefs()

const open = ref(false)
const phase = ref<Phase>('build')
const mood = ref<MascotMood>('happy')
const announce = ref('')

const dialog = ref<HTMLElement | null>(null)
const skipBtn = ref<HTMLButtonElement | null>(null)
const road = ref<HTMLElement | null>(null)
const busEl = ref<HTMLElement | null>(null)

/* ── drag state ── */
const busX = ref(0)
const dragging = ref(false)
let dragId: number | null = null
let dragStartX = 0
let dragStartBus = 0

let timers: ReturnType<typeof setTimeout>[] = []
let prevOverflow = ''
let closed = false

function at(ms: number, fn: () => void) {
  timers.push(setTimeout(fn, ms))
}

function readSeen(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return shownThisLoad
  }
}

function writeSeen() {
  shownThisLoad = true
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* storage blocked: the module flag covers this page load */
  }
}

/** Where the bus stops: its nose at the marker. */
function stopX() {
  const w = road.value?.clientWidth ?? 0
  return Math.max(0, w - BUS_W - 40)
}

/* ── sequence ── */
function startDrag() {
  if (phase.value !== 'build') return
  phase.value = 'drag'
  // Hand keyboard users straight to the bus, unless they already moved focus themselves.
  nextTick(() => {
    const active = document.activeElement
    if (!active || active === document.body || active === skipBtn.value || active === dialog.value) busEl.value?.focus()
  })
}

function board() {
  if (phase.value === 'build') return
  if (phase.value === 'reveal') {
    lift()
    return
  }
  if (phase.value !== 'drag') return
  phase.value = 'reveal'
  busX.value = stopX()
  mood.value = 'happy'
  announce.value = 'Boarded. Welcome to WanderBus.'
  // The bus element is about to be hidden, so keep focus inside on a stable control.
  skipBtn.value?.focus()
  at(WAVE_AT, () => { mood.value = 'wave' })
  at(LIFT_AT, lift)
}

function lift() {
  if (phase.value === 'leave') return
  timers.forEach(clearTimeout)
  timers = []
  phase.value = 'leave'
  at(LIFT_MS, close)
}

function skip() {
  lift()
}

function close() {
  if (closed) return
  closed = true
  teardown()
  open.value = false
  emit('close')
  // If the parent didn't move focus, land on the page's main region rather than <body>.
  nextTick(() => {
    if (document.activeElement === document.body) {
      document.getElementById('main')?.focus({ preventScroll: true })
    }
  })
}

/* ── drag the bus (Pointer Events) ── */
function onPointerDown(e: PointerEvent) {
  if (phase.value !== 'drag' || (e.pointerType === 'mouse' && e.button !== 0)) return
  dragId = e.pointerId
  dragStartX = e.clientX
  dragStartBus = busX.value
  dragging.value = true
  busEl.value?.setPointerCapture?.(e.pointerId)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== dragId) return
  const max = stopX()
  busX.value = Math.min(max, Math.max(0, dragStartBus + e.clientX - dragStartX))
}

function endDrag(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== dragId) return
  dragging.value = false
  dragId = null
  busEl.value?.releasePointerCapture?.(e.pointerId)
  if (e.type !== 'pointercancel' && busX.value >= stopX() - SNAP_PX) board()
  else busX.value = 0
}

function onBusKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    board()
  }
}

/* ── keyboard: Esc skips, Tab stays inside ── */
function focusables(): HTMLElement[] {
  if (!dialog.value) return []
  return Array.from(
    dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]'),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement)
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    skip()
    return
  }
  if (e.key !== 'Tab') return
  const list = focusables()
  if (!list.length) {
    e.preventDefault()
    dialog.value?.focus()
    return
  }
  const first = list[0]!
  const last = list[list.length - 1]!
  const active = document.activeElement as HTMLElement | null
  const inside = !!active && !!dialog.value?.contains(active)
  if (e.shiftKey && (active === first || !inside)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !inside)) {
    e.preventDefault()
    first.focus()
  }
}

/* ── open / close ── */
function teardown() {
  timers.forEach(clearTimeout)
  timers = []
  document.removeEventListener('keydown', onKeydown, true)
  document.documentElement.style.overflow = prevOverflow
}

function prefersReduced() {
  return reducedMotion.value || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// `?intro=off` skips it, for testing and for links that should land straight on the page.
// `?intro=on` plays it even if it was already seen this session (still never under reduced motion).
function introParam() {
  return new URLSearchParams(window.location.search).get('intro')
}

onMounted(async () => {
  const param = introParam()
  if (prefersReduced() || param === 'off') return
  if (param !== 'on' && readSeen()) return
  writeSeen()
  prevOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown, true)
  open.value = true
  await nextTick()
  skipBtn.value?.focus()
  at(ASSEMBLED_AT, startDrag)
})

// Switching reduced motion on mid-intro ends it at once.
watch(reducedMotion, (on) => {
  if (on && open.value) close()
})

onBeforeUnmount(() => {
  if (open.value) teardown()
})
</script>

<template>
  <Teleport v-if="open" to="body">
    <div
      ref="dialog"
      class="intro"
      :class="`is-${phase}`"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to WanderBus"
      tabindex="-1"
    >
      <div class="intro-ink" aria-hidden="true"></div>

      <button ref="skipBtn" type="button" class="intro-skip" @click="skip">
        Skip intro
        <i class="bi bi-skip-forward-fill" aria-hidden="true"></i>
      </button>

      <div class="intro-body">
        <div class="intro-stage">
          <!-- The mascot, built from its geometric parts (same geometry as WanderMascot) -->
          <svg class="intro-figure" viewBox="0 0 100 100" width="132" height="132" focusable="false" aria-hidden="true">
            <circle class="part part-body" cx="50" cy="54" r="40" />
            <ellipse class="part part-shine" cx="35" cy="32" rx="10" ry="5.5" transform="rotate(-28 35 32)" />
            <rect class="part part-eye part-eye-l" x="31.5" y="38" width="9" height="16" rx="4.5" />
            <rect class="part part-eye part-eye-r" x="59.5" y="38" width="9" height="16" rx="4.5" />
            <path class="part part-mouth" d="M43 66 Q50 72 57 66" pathLength="1" />
            <ellipse class="part part-arm part-arm-l" cx="13" cy="64" rx="7" ry="10" />
            <ellipse class="part part-arm part-arm-r" cx="87" cy="64" rx="7" ry="10" />
          </svg>

          <!-- The WanderBus mark, revealed when the bus boards -->
          <div class="intro-mark" :aria-hidden="phase === 'reveal' || phase === 'leave' ? undefined : 'true'">
            <WanderMascot v-if="phase === 'reveal' || phase === 'leave'" :mood="mood" :size="112" />
            <p class="intro-wordmark">WanderBus</p>
          </div>
        </div>

        <div class="intro-board" :aria-hidden="phase === 'build' ? 'true' : undefined">
          <p class="intro-hint">Drag the bus to the stop</p>

          <div ref="road" class="intro-road">
            <span class="intro-line" aria-hidden="true"></span>

            <svg class="intro-stop" viewBox="0 0 40 64" width="40" height="64" focusable="false" aria-hidden="true">
              <rect class="stop-pole" x="18" y="14" width="4" height="50" rx="2" />
              <rect class="stop-sign" x="4" y="2" width="32" height="20" rx="4" />
              <rect class="stop-led" x="9" y="8" width="22" height="3" rx="1.5" />
              <rect class="stop-led" x="9" y="13" width="14" height="3" rx="1.5" />
            </svg>

            <div
              ref="busEl"
              class="intro-bus"
              :class="{ 'is-dragging': dragging }"
              role="button"
              :tabindex="phase === 'drag' ? 0 : -1"
              aria-label="Bus. Drag it to the stop, or press Enter to board"
              :style="{ transform: `translate3d(${busX}px, 0, 0)` }"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="endDrag"
              @pointercancel="endDrag"
              @lostpointercapture="endDrag"
              @keydown="onBusKey"
            >
              <svg :width="BUS_W" height="30" viewBox="0 0 56 30" focusable="false" aria-hidden="true">
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
            </div>
          </div>

          <button
            type="button"
            class="btn-wb-primary intro-go"
            :disabled="phase !== 'drag'"
            @click="board"
          >
            <i class="bi bi-bus-front" aria-hidden="true"></i>
            Board the bus
          </button>
        </div>
      </div>

      <p class="visually-hidden" aria-live="polite">{{ announce }}</p>
    </div>
  </Teleport>
</template>

<style scoped>
.intro {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-8) var(--gutter) var(--sp-6);
  overflow: hidden;
  background: var(--wb-ground);
  color: var(--wb-ink);
  transition:
    transform var(--t-reveal) var(--ease),
    opacity var(--t-reveal) var(--ease);
}

.intro:focus { outline: none; }

/* ink → ground: the overlay itself is flat ground, and a flat ink layer fades out over it,
   so text never sits on an ink background as far as the computed styles go */
.intro-ink {
  position: absolute;
  inset: 0;
  background: var(--wb-ink);
  pointer-events: none;
  animation: intro-unink var(--t-signature) var(--ease) both;
}

@keyframes intro-unink {
  from { opacity: 1; }
  to { opacity: 0; }
}

.intro.is-leave {
  transform: translate3d(0, -100%, 0);
  opacity: 0;
  pointer-events: none;
}

.intro-skip {
  position: absolute;
  top: var(--sp-4);
  right: var(--gutter);
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 44px;
  padding: 0 var(--sp-4);
  border: 2px solid var(--wb-ink);
  border-radius: var(--r-pill);
  background: var(--wb-surface);
  color: var(--wb-ink);
  font: 500 var(--fs-small)/1 var(--font-ui);
  cursor: pointer;
  touch-action: manipulation;
  transition: transform var(--t-micro) var(--ease);
}

.intro-skip:hover { transform: translateY(-1px); }
.intro-skip:active { transform: scale(0.97); }

.intro-skip:focus-visible,
.intro-bus:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 3px;
}

.intro-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-6);
  width: min(480px, 100%);
}

/* figure and mark share one cell */
.intro-stage {
  display: grid;
  place-items: center;
  min-height: 190px;
}

.intro-figure,
.intro-mark {
  grid-area: 1 / 1;
}

.intro-figure {
  overflow: visible;
  transition:
    transform var(--t-reveal) var(--ease),
    opacity var(--t-ui) var(--ease);
}

.is-reveal .intro-figure,
.is-leave .intro-figure {
  transform: scale(0.6);
  opacity: 0;
}

/* ── the parts ── */
.part {
  transform-box: fill-box;
  transform-origin: center;
  animation-fill-mode: both;
}

.part-body {
  fill: var(--wb-green);
  stroke: var(--wb-ink);
  stroke-width: 2;
  animation: part-pop var(--t-reveal) var(--ease-spring) 0ms both;
}

.part-shine {
  fill: var(--wb-surface);
  opacity: 0.22;
  animation: part-shine var(--t-ui) var(--ease) 300ms both;
}

.part-eye {
  fill: var(--wb-ink);
  animation: part-eye var(--t-ui) var(--ease-spring) 420ms both;
}

.part-eye-r { animation-delay: 520ms; }

.part-mouth {
  fill: none;
  stroke: var(--wb-ink);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-dasharray: 1;
  animation: part-smile var(--t-reveal) var(--ease) 700ms both;
}

.part-arm {
  fill: var(--wb-green);
  stroke: var(--wb-ink);
  stroke-width: 2;
}

.part-arm-l { animation: part-arm-l var(--t-reveal) var(--ease-spring) 780ms both; }
.part-arm-r { animation: part-arm-r var(--t-reveal) var(--ease-spring) 820ms both; }

@keyframes part-pop {
  from { transform: scale(0.2); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes part-shine {
  from { opacity: 0; }
  to { opacity: 0.22; }
}

@keyframes part-eye {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

/* the smile draws in with a dash offset, a paint property the compositor treats like opacity */
@keyframes part-smile {
  from { stroke-dashoffset: 1; opacity: 0; }
  to { stroke-dashoffset: 0; opacity: 1; }
}

@keyframes part-arm-l {
  from { transform: translateX(-14px) scale(0.4); opacity: 0; }
  to { transform: none; opacity: 1; }
}

@keyframes part-arm-r {
  from { transform: translateX(14px) scale(0.4); opacity: 0; }
  to { transform: none; opacity: 1; }
}

/* ── the mark: scale + circular clip reveal ── */
.intro-mark {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
  clip-path: circle(0% at 50% 40%);
  transform: scale(0.8);
  opacity: 0;
  pointer-events: none;
  transition:
    clip-path var(--t-signature) var(--ease),
    transform var(--t-reveal) var(--ease-spring),
    opacity var(--t-micro) var(--ease);
}

.is-reveal .intro-mark,
.is-leave .intro-mark {
  clip-path: circle(75% at 50% 40%);
  transform: scale(1);
  opacity: 1;
}

.intro-wordmark {
  margin: 0;
  font: 600 clamp(2.25rem, 1.5rem + 3vw, 3.5rem)/1 var(--font-display);
  letter-spacing: -0.02em;
  color: var(--wb-ink);
}

/* ── the road ── */
.intro-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-4);
  width: 100%;
  transition:
    transform var(--t-reveal) var(--ease),
    opacity var(--t-ui) var(--ease);
}

.is-build .intro-board {
  transform: translate3d(0, 24px, 0);
  opacity: 0;
  pointer-events: none;
}

.is-reveal .intro-board,
.is-leave .intro-board {
  transform: translate3d(0, 12px, 0);
  opacity: 0;
  pointer-events: none;
}

.intro-hint {
  margin: 0;
  font: 500 var(--fs-lead)/1.3 var(--font-display);
  color: var(--wb-ink);
  text-align: center;
}

.intro-road {
  position: relative;
  width: 100%;
  height: 72px;
}

.intro-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 8px;
  border-radius: var(--r-pill);
  background: var(--wb-surface-2);
}

.intro-stop {
  position: absolute;
  right: 0;
  bottom: 4px;
}

.stop-pole { fill: var(--wb-ink); }
.stop-sign { fill: var(--wb-ink); }
.stop-led { fill: var(--wb-amber); }

/* 56 × 44 hit area around the 56 × 30 drawing */
.intro-bus {
  position: absolute;
  left: 0;
  bottom: 4px;
  display: flex;
  align-items: flex-end;
  width: 56px;
  height: 48px;
  padding-bottom: 2px;
  border-radius: var(--r-control);
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  will-change: transform;
  transition: transform var(--t-ui) var(--ease-spring);
}

.intro-bus.is-dragging {
  cursor: grabbing;
  transition: none;
}

.intro-bus svg { display: block; }

.bus-body { fill: var(--wb-green); }
.bus-ink { fill: var(--wb-ink); }
.bus-sign { fill: var(--wb-amber); }
.bus-hub { fill: var(--wb-surface-2); }

@media (prefers-reduced-motion: reduce) {
  .intro,
  .intro-bus,
  .intro-mark,
  .intro-board,
  .intro-figure { transition: none; }
}
</style>
