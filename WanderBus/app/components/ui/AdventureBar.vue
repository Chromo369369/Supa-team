<!--
  Adventure pill (F1): a dark pill floating bottom centre on every page while a solo adventure runs.
  Left: the bus number as an LED chip (the LedBoard dot-matrix look; a walker glyph for walking trips).
  Middle: a pulsing amber dot with "On the bus" / "Walking", then the stop name and the live timer.
  Right: "Hold to end adventure". Press and hold about a second (pointer, or Enter / Space) and the fill
  sweeps across; let go early and it cancels. When it completes, AdventureEndDialog opens.
  Assistive tech: a click that comes without a pointer or key press (event.detail === 0, or no pointerdown
  before it) opens the dialog straight away. Reduced motion: no sweep, a 3-2-1 count in the label instead.
  Mounted once in layouts/default.vue, which keeps the landing pill, the phone spin dock and the
  desktop toasts clear of it (see .has-adventure there).
-->
<script setup lang="ts">
import { ledDots, ledTextWidth } from '~/utils/ledFont'

const { session, active, elapsed, endPrompt } = useAdventure()

const HOLD_MS = 1000
const COUNT_FROM = 3

const pad = (n: number) => String(n).padStart(2, '0') // taste-skill-ignore: clock digits
// mm:ss, or h:mm:ss past an hour
const clock = computed(() => {
  const s = elapsed.value
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
})

const bus = computed(() => session.value?.bus || null)
const walking = computed(() => !bus.value)
const status = computed(() => (walking.value ? 'Walking' : 'On the bus'))

// ---------- LED chip ----------
// The same 5x7 font and dot sizes as LedBoard (lit r 0.42, unlit r 0.3 on a 1-unit grid), one dot row/column of margin.
// Walking trips get a little walker drawn in the same 5x7 grid.
const WALKER = [6, 6, 12, 22, 4, 10, 17]
const walkerDots: Array<[number, number]> = []
WALKER.forEach((bits, row) => {
  for (let col = 0; col < 5; col++) if (bits & (16 >> col)) walkerDots.push([col, row])
})

const ledText = computed(() => (bus.value ?? '').slice(0, 4))
const ledCols = computed(() => (walking.value ? 5 : Math.max(5, ledTextWidth(ledText.value))) + 2)
const ledRows = 9
const litDots = computed(() => (walking.value ? walkerDots : ledDots(ledText.value)) as Array<[number, number]>)
const offDots = computed(() => {
  const out: Array<[number, number]> = []
  for (let y = 0; y < ledRows; y++) for (let x = 0; x < ledCols.value; x++) out.push([x, y])
  return out
})
const chipLabel = computed(() => (walking.value ? 'Walking trip' : `Bus ${bus.value}`))

// ---------- hold to end ----------
const holdBtn = ref<HTMLButtonElement | null>(null)
const holding = ref(false)
const count = ref(COUNT_FROM)
const reduceMotion = ref(false)
let holdTimer: ReturnType<typeof setTimeout> | null = null
let countTimer: ReturnType<typeof setInterval> | null = null
let pointerPressed = false          // a pointer press started this activation, so its click is not an AT click
let heldKey: string | null = null   // the key being held, so its repeats and keyup are not passed on
let motionQuery: MediaQueryList | null = null

const onMotionChange = () => { reduceMotion.value = !!motionQuery?.matches }

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotionChange()
  motionQuery.addEventListener('change', onMotionChange)
})

function clearTimers() {
  if (holdTimer) clearTimeout(holdTimer)
  if (countTimer) clearInterval(countTimer)
  holdTimer = null
  countTimer = null
}

function startHold() {
  if (holding.value || endPrompt.value) return
  holding.value = true
  count.value = COUNT_FROM
  clearTimers()
  holdTimer = setTimeout(completeHold, HOLD_MS)
  countTimer = setInterval(() => { count.value = Math.max(1, count.value - 1) }, HOLD_MS / COUNT_FROM)
}

function cancelHold() {
  clearTimers()
  holding.value = false
}

function completeHold() {
  clearTimers()
  holding.value = false
  openDialog()
}

function openDialog() {
  endPrompt.value = true
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  pointerPressed = true
  // keep the press on the button even if the finger drifts a little
  try { holdBtn.value?.setPointerCapture(e.pointerId) } catch { /* not capturable: pointerleave still cancels */ }
  startHold()
}

function onPointerEnd() {
  cancelHold()
}

// Enter fires click on keydown and Space on keyup; both are prevented so a keyboard press must be held.
// Once the hold completes the dialog has focus, so the window listeners swallow that key's repeats and its
// keyup, which would otherwise press the dialog's first button.
function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  if (e.repeat || heldKey) return
  heldKey = e.key
  window.addEventListener('keydown', swallowKey, true)
  window.addEventListener('keyup', releaseKey, true)
  window.addEventListener('blur', dropKey) // the tab lost focus, so the keyup may never come
  startHold()
}

function swallowKey(e: KeyboardEvent) {
  if (e.key !== heldKey) return
  e.preventDefault()
  e.stopPropagation()
}

function releaseKey(e: KeyboardEvent) {
  if (e.key !== heldKey) return
  e.preventDefault()
  e.stopPropagation()
  dropKey()
}

function dropKey() {
  heldKey = null
  window.removeEventListener('keydown', swallowKey, true)
  window.removeEventListener('keyup', releaseKey, true)
  window.removeEventListener('blur', dropKey)
  cancelHold()
}

// Pointer and keyboard presses are handled by the hold above. A click with no press behind it
// (detail 0, or no pointerdown) comes from assistive tech, and opens the dialog right away.
function onClick(e: MouseEvent) {
  const fromPress = pointerPressed && e.detail !== 0
  pointerPressed = false
  if (!fromPress) openDialog()
}

// Focus leaving mid-hold cancels it. A held key keeps its window listeners until its keyup,
// including after a completed hold has moved focus into the dialog.
function onBlur() {
  cancelHold()
}

onBeforeUnmount(() => {
  dropKey()
  motionQuery?.removeEventListener('change', onMotionChange)
})

const holdLabel = computed(() => (holding.value && reduceMotion.value ? `Keep holding… ${count.value}` : null))
</script>

<template>
  <Transition name="adv-pill">
    <aside v-if="active && session" class="adv-pill" aria-label="Your adventure">
      <!-- LED chip: the bus number, or a walker for walking trips -->
      <span class="adv-led" role="img" :aria-label="chipLabel">
        <svg
          :viewBox="`0 0 ${ledCols} ${ledRows}`"
          :width="ledCols * 3"
          :height="ledRows * 3"
          aria-hidden="true"
          focusable="false"
        >
          <circle v-for="([x, y], i) in offDots" :key="`o${i}`" :cx="x + 0.5" :cy="y + 0.5" r="0.3" class="adv-led-off" />
          <g class="adv-led-on">
            <circle v-for="([x, y], i) in litDots" :key="`l${i}`" :cx="x + 1.5" :cy="y + 1.5" r="0.42" />
          </g>
        </svg>
      </span>

      <div class="adv-pill-text">
        <p class="adv-pill-status">
          <span class="adv-pill-dot" aria-hidden="true"></span>
          {{ status }}
        </p>
        <p class="adv-pill-where">
          <span class="visually-hidden">{{ walking ? 'Walking to' : 'Heading to' }} </span>
          <strong class="adv-pill-stop">{{ session.stopName }}</strong>
          <span class="adv-pill-clock num" role="timer" aria-live="off">
            <span class="visually-hidden">Time on this adventure </span>{{ clock }}
          </span>
        </p>
      </div>

      <button
        ref="holdBtn"
        type="button"
        class="adv-hold"
        :class="{ 'is-holding': holding }"
        aria-label="Hold to end adventure"
        aria-describedby="adv-hold-hint"
        @pointerdown="onPointerDown"
        @pointerup="onPointerEnd"
        @pointercancel="onPointerEnd"
        @lostpointercapture="onPointerEnd"
        @keydown="onKeyDown"
        @click="onClick"
        @blur="onBlur"
        @contextmenu.prevent
      >
        <span class="adv-hold-fill" aria-hidden="true"></span>
        <span class="adv-hold-label">
          <i class="bi bi-flag" aria-hidden="true"></i>
          <template v-if="holdLabel"><span class="num">{{ holdLabel }}</span></template>
          <template v-else>Hold to end<span class="adv-hold-more"> adventure</span></template>
        </span>
      </button>
      <span id="adv-hold-hint" class="visually-hidden">Press and hold to end</span>
    </aside>
  </Transition>
</template>

<style scoped>
/* The pill floats over the page, so it gets the float shadow. Height (64px) matches --adventure-pill-h in the layout. */
.adv-pill {
  position: fixed;
  z-index: 1035; /* over the phone spin dock (1030) and the header, under toasts (1090) and dialogs */
  left: calc(var(--gutter) + env(safe-area-inset-left, 0px));
  right: calc(var(--gutter) + env(safe-area-inset-right, 0px));
  bottom: calc(var(--sp-4) + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  max-width: 560px;
  min-height: 64px;
  margin: 0 auto;
  padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-3);
  border-radius: var(--r-card);
  background: var(--wb-ink);
  color: var(--wb-on-ink);
  box-shadow: var(--wb-float); /* taste-skill-ignore: the pill floats over the page */
}

/* ---------- LED chip ---------- */
.adv-led {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: var(--sp-1);
  border-radius: var(--sp-2);
  background: color-mix(in srgb, var(--wb-on-ink) 6%, var(--wb-ink));
}

.adv-led svg { display: block; }

.adv-led-off { fill: color-mix(in srgb, var(--wb-on-ink) 9%, var(--wb-ink)); }

/* lit dots: amber as a glyph fill, as on LedBoard */
.adv-led-on { fill: var(--wb-amber); }

/* ---------- status ---------- */
.adv-pill-text {
  flex: 1;
  min-width: 0;
  line-height: 1.3;
}

.adv-pill-text p { margin: 0; }

.adv-pill-status {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--wb-amber);
  font-size: var(--fs-small);
  font-weight: 600;
}

.adv-pill-dot {
  position: relative;
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--wb-amber);
}

/* a ring that grows and fades from the dot: transform and opacity only */
.adv-pill-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--wb-amber);
  animation: adv-pulse 1.6s var(--ease) infinite;
}

@keyframes adv-pulse {
  from { transform: scale(1); opacity: .6; }
  to { transform: scale(2.6); opacity: 0; }
}

.adv-pill-where {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  min-width: 0;
}

.adv-pill-stop {
  overflow: hidden;
  font-size: var(--fs-body);
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.adv-pill-clock {
  flex-shrink: 0;
  color: var(--wb-on-ink-2);
  font-size: var(--fs-small);
  font-weight: 500;
}

/* ---------- hold to end ---------- */
.adv-hold {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--sp-4);
  border: 2px solid var(--wb-on-ink);
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--wb-on-ink);
  font: 600 var(--fs-small)/1 var(--font-ui);
  white-space: nowrap;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

.adv-hold:hover { background: color-mix(in srgb, var(--wb-on-ink) 8%, transparent); }

/* the global green ring is hard to see on ink */
.adv-hold:focus-visible {
  outline: 3px solid var(--wb-amber);
  outline-offset: 2px;
}

/* the sweep: scaleX from the left, linear over the hold; snaps back fast when released early */
.adv-hold-fill {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--wb-on-ink) 22%, transparent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform var(--t-micro) var(--ease);
}

.adv-hold.is-holding .adv-hold-fill {
  transform: scaleX(1);
  transition: transform 1000ms linear; /* = HOLD_MS */
}

.adv-hold-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

@media (max-width: 479.98px) {
  .adv-pill { gap: var(--sp-2); }
  .adv-hold { padding: 0 var(--sp-3); }
  /* "Hold to end" on phones; the button's aria-label keeps "adventure" */
  .adv-hold-more { display: none; }
}

.adv-pill-enter-active,
.adv-pill-leave-active { transition: transform var(--t-ui) var(--ease), opacity var(--t-ui) var(--ease); }
.adv-pill-enter-from,
.adv-pill-leave-to { transform: translateY(calc(100% + var(--sp-4))); opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .adv-pill-dot::after { animation: none; opacity: 0; }
  .adv-hold-fill,
  .adv-hold.is-holding .adv-hold-fill { transform: scaleX(0); transition: none; }
  .adv-pill-enter-active,
  .adv-pill-leave-active { transition: none; }
}
</style>
