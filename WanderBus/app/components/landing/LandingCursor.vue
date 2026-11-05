<!--
  LandingCursor: the page-wide cursor bus on the landing page (plan round 2, Wave 1 A), and the
  corner pill that turns it on and off. Original WanderBus drawing.

  Mount once, as the last child of the landing root (pages/index.vue: `<div class="landing">`),
  under a parent that provides the shared state:

      provide(BUS_CURSOR_KEY, createBusCursorState())

  Cursor bus
  - A `position: fixed; inset: 0` layer (aria-hidden, pointer-events: none) holding the mini bus,
    the mascot that follows it (and looks at it) and a pool of 12 footprints that fade over 1.2 s.
    The bus is drawn exactly at the pointer in client coords, so it stays glued while scrolling.
  - Only with `(pointer: fine)`, no reduced motion, the pill on, the tab visible and a mouse or pen
    inside the landing root. Then the root gets `landing--bus-cursor` (`cursor: none`, scoped to
    the landing page, never global).
  - Over a link, button, [role=button], input, select, textarea, label or the ticket's tear stub
    (found with `closest(…)`), the native cursor returns and the bus parks beside it, faded.
  - Otherwise (no pointer yet, pointer outside the landing or the window, touch, coarse pointer,
    pill off) the layer is empty and HeroChase shows its lane bus in the hero instead.

  Hand-off (one bus on screen, never two): this component writes `state.active`. HeroChase hides
  its lane bus while it is true and jumps back into the lane when it turns false. When the cursor
  bus takes over, its mascot starts where the lane mascot stands (`state.lane.locate()`) and walks over.

  Pill: "Bus cursor on" / "Bus cursor off", aria-pressed, remembered per tab in sessionStorage
  (`wb-bus-cursor`, every access in try/catch). Off also stops the lane bus. Hidden under reduced
  motion. It rides in a sticky dock at the end of the landing root, so it floats bottom right while
  you scroll and comes to rest below the CTA, never over the CTA button or the footer.
-->
<script lang="ts">
import { ref, type InjectionKey, type Ref } from 'vue'

export interface BusCursorState {
  /** the pill: cursor bus on, lane bus moving */
  enabled: Ref<boolean>
  /** the cursor bus is on screen (so the lane bus must hide) */
  active: Ref<boolean>
  /** set by HeroChase: where the lane mascot stands now, in client px (null if not drawn) */
  lane: { locate: (() => { x: number; y: number } | null) | null }
}

export const BUS_CURSOR_KEY: InjectionKey<BusCursorState> = Symbol('wb-bus-cursor')

export function createBusCursorState(): BusCursorState {
  return { enabled: ref(true), active: ref(false), lane: { locate: null } }
}
</script>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, watch } from 'vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'
import { useMotionPrefs } from '~/composables/usePointer'

const POOL = 12
const FADE_MS = 1200
const STEP_PX = 22 // distance the mascot walks between footprints
const BUS_W = 56
const BUS_H = 30
const MASCOT = 30
const LAG_PX = 46 // how far behind the bus the mascot aims to be
const PARK_X = 24 // parked bus offset from the pointer, over interactive elements
const PARK_Y = 18
const ROOT_CLASS = 'landing--bus-cursor'
const STORAGE_KEY = 'wb-bus-cursor'
const INTERACTIVE = 'a, button, [role="button"], input, select, textarea, label, [data-testid="tear-stub"]'

const state = inject(BUS_CURSOR_KEY, null) ?? createBusCursorState()
const enabled = state.enabled
const { reducedMotion } = useMotionPrefs()

const layer = ref<HTMLElement | null>(null)
const busEl = ref<HTMLElement | null>(null)
const mascotEl = ref<HTMLElement | null>(null)
const prints = ref<HTMLElement[]>([])

const mounted = ref(false)
const finePointer = ref(false)
const tabVisible = ref(true)
/** a mouse or pen is inside the landing root */
const inside = ref(false)
const overInteractive = ref(false)
/** where the mascot looks, in client coords */
const lookAt = ref<{ x: number; y: number } | null>(null)

const active = computed(
  () => mounted.value && enabled.value && finePointer.value && !reducedMotion.value && tabVisible.value && inside.value,
)

/* ── simulation state (plain numbers, client px) ── */
const bus = { face: 1, tilt: 0 }
const pal = { x: 0, y: 0 }
const ptr = { x: 0, y: 0, t: 0 }
let lastPrint = { x: 0, y: 0 }
let printIndex = 0
let printSide = 1
let raf = 0
let lastTime = 0
let landing: HTMLElement | null = null

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ── storage ── */
function readPref(): boolean | null {
  try {
    const v = window.sessionStorage.getItem(STORAGE_KEY)
    return v === null ? null : v === '1'
  } catch {
    return null
  }
}

function writePref(on: boolean) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* storage blocked: the choice lasts for this page view */
  }
}

function toggle() {
  enabled.value = !enabled.value
  writePref(enabled.value)
}

/* ── drawing ── */
function busX() { return ptr.x + (overInteractive.value ? PARK_X : 0) }
function busY() { return ptr.y + (overInteractive.value ? PARK_Y : 0) }

function renderBus() {
  if (!busEl.value) return
  busEl.value.style.transform =
    `translate3d(${busX() - BUS_W / 2}px, ${busY() - BUS_H / 2}px, 0) rotate(${bus.tilt}deg) scaleX(${bus.face})`
  busEl.value.classList.toggle('is-parked', overInteractive.value)
}

function renderMascot() {
  if (mascotEl.value) {
    mascotEl.value.style.transform = `translate3d(${pal.x - MASCOT / 2}px, ${pal.y - MASCOT / 2}px, 0)`
  }
  lookAt.value = { x: busX(), y: busY() }
}

function dropPrint() {
  const el = prints.value[printIndex]
  printIndex = (printIndex + 1) % POOL
  if (!el) return
  printSide = -printSide
  const t = `translate3d(${pal.x + printSide * 5 - 3}px, ${pal.y + MASCOT / 2 - 4}px, 0)`
  el.getAnimations?.().forEach((a) => a.cancel())
  el.style.transform = t
  el.animate?.(
    [
      { opacity: 0.5, transform: `${t} scale(1)` },
      { opacity: 0, transform: `${t} scale(0.6)` },
    ],
    { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' },
  )
}

function tick(now: number) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000))
  lastTime = now
  bus.tilt *= 1 - Math.min(1, dt * 6) // level out when the pointer rests
  renderBus()

  const k = 1 - Math.exp(-dt * 2)
  pal.x += (busX() - bus.face * LAG_PX - pal.x) * k
  pal.y += (busY() + 4 - pal.y) * k
  if (Math.hypot(pal.x - lastPrint.x, pal.y - lastPrint.y) > STEP_PX) {
    dropPrint()
    lastPrint = { x: pal.x, y: pal.y }
  }
  renderMascot()
  raf = requestAnimationFrame(tick)
}

/** The cursor bus takes over: the mascot starts where the lane mascot stood, if it is on screen. */
function begin() {
  const l = state.lane.locate?.() ?? null
  const onScreen = !!l && l.x >= 0 && l.x <= window.innerWidth && l.y >= 0 && l.y <= window.innerHeight
  pal.x = onScreen ? l!.x : ptr.x - bus.face * LAG_PX
  pal.y = onScreen ? l!.y : ptr.y + 4
  lastPrint = { ...pal }
  bus.tilt = 0
  renderBus()
  renderMascot()
  lastTime = performance.now()
  if (!raf) raf = requestAnimationFrame(tick)
}

function end() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

/* ── pointer on the landing root ── */
function onMove(e: PointerEvent) {
  if (e.pointerType === 'touch') {
    inside.value = false
    return
  }
  const dt = Math.max(1, e.timeStamp - ptr.t) / 1000
  const vx = (e.clientX - ptr.x) / dt
  const vy = (e.clientY - ptr.y) / dt
  const fresh = !inside.value
  ptr.x = e.clientX
  ptr.y = e.clientY
  ptr.t = e.timeStamp
  overInteractive.value = !!(e.target as Element | null)?.closest?.(INTERACTIVE)
  inside.value = true
  if (!active.value) return
  if (!fresh) {
    if (vx > 40) bus.face = 1
    else if (vx < -40) bus.face = -1
    bus.tilt += (clamp(vy * 0.012, -10, 10) * bus.face - bus.tilt) * 0.35
  }
  renderBus() // in the same frame as the move, so it never trails the pointer
}

function onLeave(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  inside.value = false
  overInteractive.value = false
}

// Scrolling moves the page under a still pointer: recheck what it is over, without a move event.
function onScroll() {
  if (!inside.value || !landing) return
  const hit = document.elementFromPoint(ptr.x, ptr.y)
  if (!hit || !landing.contains(hit)) {
    inside.value = false
    overInteractive.value = false
    return
  }
  overInteractive.value = !!hit.closest(INTERACTIVE)
}

watch(active, (on) => {
  state.active.value = on
  landing?.classList.toggle(ROOT_CLASS, on)
  if (on) begin()
  else end()
})

let mqFine: MediaQueryList | null = null
const syncFine = () => { finePointer.value = !!mqFine?.matches }
const onVisibility = () => { tabVisible.value = document.visibilityState !== 'hidden' }

onMounted(() => {
  const saved = readPref()
  if (saved !== null) enabled.value = saved
  onVisibility()
  document.addEventListener('visibilitychange', onVisibility)
  mqFine = window.matchMedia?.('(pointer: fine)') ?? null
  syncFine()
  mqFine?.addEventListener?.('change', syncFine)
  landing = layer.value?.parentElement ?? null
  landing?.addEventListener('pointermove', onMove, { passive: true })
  landing?.addEventListener('pointerover', onMove, { passive: true })
  landing?.addEventListener('pointerleave', onLeave, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  mounted.value = true
})

onBeforeUnmount(() => {
  end()
  mqFine?.removeEventListener?.('change', syncFine)
  document.removeEventListener('visibilitychange', onVisibility)
  landing?.removeEventListener('pointermove', onMove)
  landing?.removeEventListener('pointerover', onMove)
  landing?.removeEventListener('pointerleave', onLeave)
  window.removeEventListener('scroll', onScroll)
  landing?.classList.remove(ROOT_CLASS)
  state.active.value = false
  landing = null
})
</script>

<template>
  <div ref="layer" class="lcursor" :class="{ 'is-on': active }" aria-hidden="true">
    <span v-for="i in POOL" :key="i" ref="prints" class="lcursor-print"></span>

    <div ref="mascotEl" class="lcursor-mascot">
      <WanderMascot mood="idle" :size="MASCOT" gaze :target="lookAt" />
    </div>

    <div ref="busEl" class="lcursor-bus">
      <svg :width="BUS_W" :height="BUS_H" viewBox="0 0 56 30" focusable="false" aria-hidden="true">
        <rect class="lcursor-body" x="1" y="2" width="53" height="21" rx="5" />
        <rect class="lcursor-ink" x="6" y="7" width="9" height="7" rx="1.5" />
        <rect class="lcursor-ink" x="18" y="7" width="9" height="7" rx="1.5" />
        <rect class="lcursor-ink" x="30" y="7" width="9" height="7" rx="1.5" />
        <path class="lcursor-ink" d="M44 6 H50 Q53 6 53 9 V16 H44 Z" />
        <rect class="lcursor-sign" x="18" y="3" width="21" height="2.4" rx="1" />
        <rect class="lcursor-lamp" x="51" y="18" width="3" height="3" rx="1" />
        <circle class="lcursor-tyre" cx="14" cy="24" r="5" />
        <circle class="lcursor-tyre" cx="42" cy="24" r="5" />
        <circle class="lcursor-hub" cx="14" cy="24" r="2" />
        <circle class="lcursor-hub" cx="42" cy="24" r="2" />
      </svg>
    </div>
  </div>

  <div class="lcursor-dock">
    <button
      v-if="!reducedMotion"
      type="button"
      class="lcursor-pill"
      :aria-pressed="enabled ? 'true' : 'false'"
      @click="toggle"
    >
      <i class="bi bi-bus-front" aria-hidden="true"></i>
      <!-- The state word is visual only: aria-pressed already says on or off. -->
      <span>Bus cursor <span aria-hidden="true">{{ enabled ? 'on' : 'off' }}</span></span>
    </button>
  </div>
</template>

<style>
/* Unscoped: lands on the landing root, and only while the cursor bus is on. */
.landing--bus-cursor { cursor: none; }
/* :where() keeps this at one class of weight, so a control's own cursor (grab on the stub) wins. */
.landing--bus-cursor :where(a, button, [role="button"], select, label, [data-testid="tear-stub"]) { cursor: pointer; }
.landing--bus-cursor :where(input, textarea) { cursor: text; }
</style>

<style scoped>
/* Below the site header (1030), above the page content. */
.lcursor {
  position: fixed;
  inset: 0;
  z-index: 1020;
  overflow: hidden;
  pointer-events: none;
  visibility: hidden;
}

/* No fade in or out: the lane bus and this bus swap in the same frame. */
.lcursor.is-on { visibility: visible; }

.lcursor-bus,
.lcursor-mascot,
.lcursor-print {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
}

/* transform is never transitioned: the bus must stay glued to the pointer */
.lcursor-bus { transition: opacity var(--t-micro) var(--ease); }
.lcursor-bus.is-parked { opacity: 0.45; }
.lcursor-bus svg { display: block; }

.lcursor-body { fill: var(--wb-green); }
.lcursor-ink,
.lcursor-tyre { fill: var(--wb-ink); }
.lcursor-sign,
.lcursor-lamp { fill: var(--wb-amber); }
.lcursor-hub { fill: var(--wb-surface-2); }

.lcursor-mascot { line-height: 0; }

.lcursor-print {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wb-green);
  opacity: 0;
}

/* Sticky at the end of the landing root: floats bottom right while scrolling, rests below the
   CTA. The negative top margin tucks its resting slot into the CTA section's bottom padding. */
.lcursor-dock {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  justify-content: flex-end;
  margin-top: calc(-1 * var(--sp-7));
  padding: 0 var(--gutter) calc(var(--gutter) + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.lcursor-pill {
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
  white-space: nowrap;
  cursor: pointer;
  pointer-events: auto;
  touch-action: manipulation;
  transition: transform var(--t-micro) var(--ease), color var(--t-micro) var(--ease);
}

.lcursor-pill .bi { font-size: 1.125rem; color: var(--wb-green); }
.lcursor-pill[aria-pressed='false'] { color: var(--wb-text-2); }
.lcursor-pill[aria-pressed='false'] .bi { color: var(--wb-muted); }

.lcursor-pill:hover { transform: translateY(-1px); }
.lcursor-pill:active { transform: scale(0.97); }

.lcursor-pill:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .lcursor,
  .lcursor-pill { display: none; }
}
</style>
