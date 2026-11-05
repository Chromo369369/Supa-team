<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'
import { BUS_CURSOR_KEY } from '~/components/landing/LandingCursor.vue'
import { useMotionPrefs } from '~/composables/usePointer'

const POOL = 12
const FADE_MS = 1200
const STEP_PX = 22 // distance the mascot walks between footprints
const BUS_W = 56
const BUS_H = 30
const MASCOT = 30
const LAG_PX = 46 // how far behind the bus the mascot aims to be
const LANE_SPEED = 140 // px/s-ish across the lane

const { reducedMotion } = useMotionPrefs()
const shared = inject(BUS_CURSOR_KEY, null)
const parked = computed(() => shared ? !shared.enabled.value : false)
const hidden = computed(() => shared ? shared.active.value : false)

const root = ref<HTMLElement | null>(null)
const busEl = ref<HTMLElement | null>(null)
const mascotEl = ref<HTMLElement | null>(null)
const prints = ref<HTMLElement[]>([])

const inView = ref(true)
const tabVisible = ref(true)
const mounted = ref(false)
const placed = ref(false)

/** where the mascot looks, in client coords (fed every frame) */
const lookAt = ref<{ x: number; y: number } | null>(null)

const running = computed(
  () => mounted.value && !parked.value && !hidden.value && inView.value && tabVisible.value && !reducedMotion.value,
)

/* ── simulation state (plain numbers, hero-local px) ── */
const bus = { x: 0, y: 0, face: 1, tilt: 0 }
const pal = { x: 0, y: 0 }
let lastPrint = { x: 0, y: 0 }
let printIndex = 0
let printSide = 1
// Route phase: sin(routeT) = -1 is the left end of the lane.
let routeT = (3 * Math.PI) / 2
let laneEl: HTMLElement | null = null
let raf = 0
let lastTime = 0
let hero: HTMLElement | null = null

interface Area {
  /** bus centre range */
  x0: number
  x1: number
  y0: number
  y1: number
  /** mascot centre range */
  mx0: number
  mx1: number
}


function bounds() {
  return root.value?.getBoundingClientRect() ?? null
}

/** The lane, in hero-local px, or null if there is none. */
function area(r: DOMRect): Area | null {
  if (!laneEl || !laneEl.isConnected) laneEl = hero?.querySelector<HTMLElement>('[data-chase-lane]') ?? null
  const lr = laneEl?.getBoundingClientRect()
  if (!lr || lr.height <= 0) return null
  const lx = lr.left - r.left
  const cy = lr.top - r.top + lr.height / 2 - 2
  const mid = lx + lr.width / 2
  const x0 = lr.width > BUS_W ? lx + BUS_W / 2 : mid
  const x1 = lr.width > BUS_W ? lx + lr.width - BUS_W / 2 : mid
  const mx0 = lr.width > MASCOT ? lx + MASCOT / 2 : mid
  const mx1 = lr.width > MASCOT ? lx + lr.width - MASCOT / 2 : mid
  return { x0, x1, y0: cy - 3, y1: cy + 3, mx0, mx1 }
}

/** Phase speed: a steady pace across the lane. */
function omega(a: Area) {
  return clamp(LANE_SPEED / Math.max(1, a.x1 - a.x0), 0.25, 1.4)
}

function routePoint(a: Area, t: number) {
  return {
    x: a.x0 + (a.x1 - a.x0) * (0.5 + 0.5 * Math.sin(t)),
    y: (a.y0 + a.y1) / 2 + ((a.y1 - a.y0) / 2) * Math.sin(2 * t),
  }
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

function clearPrints() {
  prints.value.forEach((el) => el.getAnimations?.().forEach((a) => a.cancel()))
}

function render(r: DOMRect) {
  if (busEl.value) {
    busEl.value.style.transform =
      `translate3d(${bus.x - BUS_W / 2}px, ${bus.y - BUS_H / 2}px, 0) rotate(${bus.tilt}deg) scaleX(${bus.face})`
  }
  if (mascotEl.value) {
    mascotEl.value.style.transform = `translate3d(${pal.x - MASCOT / 2}px, ${pal.y - MASCOT / 2}px, 0)`
  }
  lookAt.value = { x: r.left + bus.x, y: r.top + bus.y }
  placed.value = true
}

/** Put everything at its resting spot in the lane (the reduced-motion still is the right end). */
function placeStill() {
  const r = bounds()
  if (!r || !r.width) return
  const a = area(r)
  if (!a) {
    placed.value = false
    return
  }
  const p = reducedMotion.value ? { x: a.x1, y: (a.y0 + a.y1) / 2 } : routePoint(a, routeT)
  bus.x = clamp(p.x, a.x0, a.x1)
  bus.y = clamp(p.y, a.y0, a.y1)
  bus.face = Math.cos(routeT) >= 0 || reducedMotion.value ? 1 : -1
  bus.tilt = 0
  pal.x = clamp(bus.x - bus.face * LAG_PX, a.mx0, a.mx1)
  pal.y = bus.y + 4
  lastPrint = { ...pal }
  render(r)
}

function tick(now: number) {
  raf = 0
  const r = bounds()
  const a = r && r.width ? area(r) : null
  if (!r || !a) {
    raf = requestAnimationFrame(tick)
    return
  }
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000))
  lastTime = now

  routeT += dt * omega(a)
  const target = routePoint(a, routeT)
  const tx = clamp(target.x, a.x0, a.x1)
  const ty = clamp(target.y, a.y0, a.y1)
  // Frame-rate independent easing along the lane.
  const kBus = 1 - Math.exp(-dt * 3.2)
  const prevX = bus.x
  const prevY = bus.y
  bus.x += (tx - bus.x) * kBus
  bus.y += (ty - bus.y) * kBus
  const vx = dt ? (bus.x - prevX) / dt : 0
  const vy = dt ? (bus.y - prevY) / dt : 0
  if (vx > 8) bus.face = 1
  else if (vx < -8) bus.face = -1
  bus.tilt += (clamp(vy * 0.04, -9, 9) * bus.face - bus.tilt) * 0.2

  // The mascot lags behind and stays in the lane, so it bunches up behind the bus at the ends.
  const kPal = 1 - Math.exp(-dt * 2)
  pal.x += (clamp(bus.x - bus.face * LAG_PX, a.mx0, a.mx1) - pal.x) * kPal
  pal.y += (bus.y + 4 - pal.y) * kPal

  if (Math.hypot(pal.x - lastPrint.x, pal.y - lastPrint.y) > STEP_PX) {
    dropPrint()
    lastPrint = { x: pal.x, y: pal.y }
  }

  render(r)
  raf = requestAnimationFrame(tick)
}

function start() {
  if (raf) return
  lastTime = performance.now()
  raf = requestAnimationFrame(tick)
}

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

watch(running, (on) => (on ? start() : stop()))
watch(reducedMotion, (on) => {
  if (on) {
    stop()
    placeStill()
  }
})
// Hand-off: hide at once when the cursor bus appears; jump back into the lane when it goes.
watch(hidden, (on) => {
  if (on) clearPrints()
  else placeStill()
})

let io: IntersectionObserver | null = null
let ro: ResizeObserver | null = null
const onVisibility = () => { tabVisible.value = document.visibilityState !== 'hidden' }

onMounted(() => {
  onVisibility()
  document.addEventListener('visibilitychange', onVisibility)
  hero = root.value?.parentElement ?? null
  if (shared) {
    shared.lane.locate = () => {
      const r = bounds()
      return r && placed.value ? { x: r.left + pal.x, y: r.top + pal.y } : null
    }
  }
  if (typeof IntersectionObserver !== 'undefined' && root.value) {
    io = new IntersectionObserver(([entry]) => { inView.value = !!entry?.isIntersecting })
    io.observe(root.value)
  }
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    // Only the still layout needs re-placing; the loop reads the bounds every frame.
    ro = new ResizeObserver(() => { if (!raf) placeStill() })
    ro.observe(root.value)
  }
  placeStill()
  mounted.value = true
  if (running.value) start()
})

onBeforeUnmount(() => {
  stop()
  io?.disconnect()
  ro?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
  if (shared) shared.lane.locate = null
  hero = null
  laneEl = null
})
</script>

<template>
  <div ref="root" class="chase">
    <div class="chase-layer" :class="{ 'is-placed': placed, 'is-hidden': hidden }" aria-hidden="true">
      <span v-for="i in POOL" :key="i" ref="prints" class="chase-print"></span>

      <div ref="mascotEl" class="chase-mascot">
        <WanderMascot mood="idle" :size="MASCOT" gaze :target="lookAt" />
      </div>

      <div ref="busEl" class="chase-bus">
        <svg :width="BUS_W" :height="BUS_H" viewBox="0 0 56 30" focusable="false" aria-hidden="true">
          <rect class="chase-body" x="1" y="2" width="53" height="21" rx="5" />
          <rect class="chase-ink" x="6" y="7" width="9" height="7" rx="1.5" />
          <rect class="chase-ink" x="18" y="7" width="9" height="7" rx="1.5" />
          <rect class="chase-ink" x="30" y="7" width="9" height="7" rx="1.5" />
          <path class="chase-ink" d="M44 6 H50 Q53 6 53 9 V16 H44 Z" />
          <rect class="chase-sign" x="18" y="3" width="21" height="2.4" rx="1" />
          <rect class="chase-lamp" x="51" y="18" width="3" height="3" rx="1" />
          <circle class="chase-tyre" cx="14" cy="24" r="5" />
          <circle class="chase-tyre" cx="42" cy="24" r="5" />
          <circle class="chase-hub" cx="14" cy="24" r="2" />
          <circle class="chase-hub" cx="42" cy="24" r="2" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No z-index here, so the layer can sit below the hero content. */
.chase {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.chase-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  opacity: 0;
  transition: opacity var(--t-reveal) var(--ease);
}

.chase-layer.is-placed { opacity: 1; }

/* The cursor bus is on screen: gone in the same frame, no fade, so two buses never show. */
.chase-layer.is-hidden {
  visibility: hidden;
  opacity: 0;
  transition: none;
}

.chase-bus,
.chase-mascot,
.chase-print {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
}

.chase-bus svg { display: block; }

.chase-body { fill: var(--wb-green); }
.chase-ink,
.chase-tyre { fill: var(--wb-ink); }
.chase-sign,
.chase-lamp { fill: var(--wb-amber); }
.chase-hub { fill: var(--wb-surface-2); }

.chase-mascot { line-height: 0; }

.chase-print {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wb-green);
  opacity: 0;
}
</style>
