<!--
  StampCarousel: the passport as a wall of glossy rubber stamps (design.md §4.5). One stamp per
  saved trip, all on one full-height stage with three phases:
    1. Scatter wall: every stamp lies loose and slightly turned across the stage, so many trips
       show at once.
    2. Cascade: scrolling the page through the stage (the stage stays pinned while it morphs), or
       pressing "Line them up", gathers the stamps into the slanted cascade line.
    3. Zoom: choosing a stamp (click, swipe, Previous / Next, the arrow keys) zooms it, centred
       right, and its details open top left: stop name, bus, from, set off, time taken, date,
       the note, then the page's editor and Edit / Delete trip buttons (slots).

  Ported to Vue 3 from two 21st.dev components, used as part of this application only:
  - "3D CD Disc Carousel" (Disc Cascade Carousel) by kedhareswer, component id 35505,
    https://21st.dev/kedhareswer/disc-cascade-carousel. Kept: the cascade pose maths (spacing,
    rise, depth, yaw, fan, tilt and roll per step), the gloss (back-set edge, soft shade, conic
    sheen glint driven by pointer and yaw with mix-blend-mode: screen, inset highlight rings, the
    chosen disc leaning toward the pointer by up to 12 degrees), the seeded PRNG, the top-left
    details head and the bottom-right controls.
  - "Scroll Morph Hero" by prashantsom75, component id 9583,
    https://21st.dev/@prashantsom75/components/scroll-morph-hero. Kept: the scatter-to-formation
    morph (each item lerps from its scatter pose to its formation pose by one morph value), driven
    by scroll progress and smoothed with the source's spring (stiffness 40, damping 20).
  Changes for WanderBus: Vue SFC with no React, Tailwind or framer-motion; real page scroll through
  a sticky stage instead of a captured wheel; the scatter is a seeded, jittered grid (from the trip
  id) instead of Math.random, and the circle and arc phases become the disc cascade; CDs become ink
  stamps with a scalloped edge and no centre hole or hub; the details head shows trip facts with
  spacing and tone steps instead of hairline rows; no wordmark, nav, index menu, frame, press
  quotes or autoplay; CSS transitions on --ease between poses; 44px controls; tokens from main.css
  only.
  Round 2 (boss, 5 Nov 2026):
  - Centre art is the trip photo clipped to the inner circle; with no photo, a still WanderMascot
    (no gaze, blink or motion) on a flat tint, its colour picked from the trip id. The source's
    seven generated label patterns are removed, and so is the opaque centre plate.
  - Rim text: the stop name on the top arc, "BUS 12 · 5 NOV" or "ON FOOT · 5 NOV" upright on the
    bottom arc; WANDERBUS joins the top line only for short names (see the rim layout note).
  - Notes are set in the app font (--font-ui) at 16px instead of the handwriting face.
  Tier 2 (design.md §5, "Crumple delete"): a deleted trip's stamp crumples (SVG displacement
  filter plus a squash and twist, about 450ms), then falls. This replaces the simple fall; under
  reduced motion it only fades.

  Props
    items   passport_entries rows (id, end_stop, end_stop_code, entry_time, bus_taken, starting_stop,
            starting_location, time_taken, entry_notes, photo_url)
    label   accessible name of the carousel
  Slots (scoped, { item, index })
    editor    the in-place editor for that trip
    actions   buttons under the details (Edit / Delete trip live in the page)

  Accessibility: APG carousel pattern. The root is aria-roledescription="carousel"; the details
  panel is the slide ("2 of 5: Blk 55"). Left / Right / Home / End move between trips while focus
  is in the carousel (never from inside a form field) and Escape closes the details. Previous /
  Next are 44px buttons. Nothing plays on its own. Changes are announced through a polite status
  line. Pointer effects (tilt, glint) only follow a fine pointer. Under prefers-reduced-motion
  there is no scatter, morph, deal-in, roll or crumple: the stamps start in the cascade with the
  first trip open, every change is instant, and a deleted stamp fades out.
-->
<script setup>
import { computed, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue'
import { useMotionPrefs } from '~/composables/usePointer'
import { bandFor } from '~/components/spin/TicketBelt.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: 'Your trips' }
})

const uid = `sc${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const { reducedMotion, canTrack } = useMotionPrefs()

// gold foil stamps while the shop look perk-stamp-gold is equipped (useRewards)
const rewards = useRewards()
const gold = computed(() => rewards.isOn('perk-stamp-gold'))

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const lerp = (a, b, t) => a * (1 - t) + b * t

/** Small deterministic PRNG (from the disc source), so a stamp looks the same on every render. */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashOf(v) {
  let x = 2166136261
  for (const c of String(v ?? '')) {
    x ^= c.charCodeAt(0)
    x = Math.imul(x, 16777619)
  }
  return x >>> 0
}

/* ── filters: trip length, how, sort (kept in the URL query: ?len=&how=&sort=) ── */
const route = useRoute()
const router = useRouter()
const LEN_OPTS = [
  { value: 'all', label: 'All' },
  { value: 'short', label: 'Short', range: '≤20 min' },
  { value: 'medium', label: 'Medium', range: '21–40' },
  { value: 'long', label: 'Long', range: '>40' }
]
const HOW_OPTS = [
  { value: 'all', label: 'All' },
  { value: 'bus', label: 'Bus' },
  { value: 'walk', label: 'Walk' }
]
const SORT_OPTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'longest', label: 'Longest' }
]
const DEFAULTS = { len: 'all', how: 'all', sort: 'newest' }
const OPTS = { len: LEN_OPTS, how: HOW_OPTS, sort: SORT_OPTS }
const pick = (key) => {
  const v = route.query[key]
  return OPTS[key].some((o) => o.value === v) ? v : DEFAULTS[key]
}
const filters = computed(() => ({ len: pick('len'), how: pick('how'), sort: pick('sort') }))
const filtersActive = computed(() => filters.value.len !== 'all' || filters.value.how !== 'all')
function setFilter(key, value) {
  if (filters.value[key] === value) return
  const query = { ...route.query, [key]: value }
  if (value === DEFAULTS[key]) delete query[key]
  router.replace({ query })
}
function clearFilters() {
  const query = { ...route.query }
  delete query.len
  delete query.how
  router.replace({ query })
}

// Same rule as passport.vue: empty, null or 'Walk' means the trip was walked.
const isBus = (t) => !!t?.bus_taken && t.bus_taken !== 'Walk'
const timeOf = (t) => (t?.entry_time ? new Date(t.entry_time).getTime() : 0)
const minutesOf = (t) => (t?.time_taken == null || t.time_taken === '' ? null : Number(t.time_taken))
// The same bands as the spin belt (TicketBelt's bandFor). A trip with no time only shows under All.
const bandOf = (t) => {
  const m = minutesOf(t)
  return m == null || Number.isNaN(m) ? null : bandFor(m)
}
const list = computed(() => {
  const { len, how, sort } = filters.value
  const out = props.items.filter((t) =>
    (len === 'all' || bandOf(t) === len) &&
    (how === 'all' || (how === 'bus') === isBus(t))
  )
  if (sort === 'oldest') out.sort((a, b) => timeOf(a) - timeOf(b))
  else if (sort === 'longest') out.sort((a, b) => (minutesOf(b) ?? -1) - (minutesOf(a) ?? -1) || timeOf(b) - timeOf(a))
  else out.sort((a, b) => timeOf(b) - timeOf(a))
  return out
})
const total = computed(() => props.items.length)
const noMatch = computed(() => total.value > 0 && list.value.length === 0)

/* ── which trip is chosen (tracked by id, so a reload keeps your place) ── */
const index = ref(0)
const currentId = ref(list.value[0]?.id)
const n = computed(() => list.value.length)
const active = computed(() => list.value[index.value] ?? null)
const cardTransition = ref('sc-next')

const rootEl = ref(null)
const track = ref(null)
const stage = ref(null)
const scene = ref(null)
const mounted = ref(false)

/* ── phases: scatter → cascade (lined) → zoom ── */
const lined = ref(false)        // latched once the morph completes, or by "Line them up"
const zoomed = ref(false)       // the chosen stamp is zoomed and its details are open
const scrollMorph = ref(0)      // 0..1 from the page scroll through the pinned stage
const morph = ref(0)            // the smoothed value every pose lerps by
const springing = ref(false)

const canScatter = computed(() => mounted.value && !reducedMotion.value && n.value > 1)
const scrollMorphOn = computed(() => canScatter.value && !lined.value)
const morphTarget = computed(() => (scrollMorphOn.value ? scrollMorph.value : 1))
const phase = computed(() => (morph.value < 0.985 ? 'scatter' : zoomed.value ? 'zoom' : 'cascade'))
const showDetails = computed(() => phase.value === 'zoom' && !!active.value)

// The source's spring (stiffness 40, damping 20), stepped by requestAnimationFrame while it moves.
let raf = 0
let vel = 0
let last = 0
function step(t) {
  raf = 0
  const dt = Math.min(0.05, Math.max(0, (t - last) / 1000))
  last = t
  const target = morphTarget.value
  const a = -40 * (morph.value - target) - 20 * vel
  vel += a * dt
  morph.value = clamp(morph.value + vel * dt, 0, 1)
  if (Math.abs(target - morph.value) < 0.004 && Math.abs(vel) < 0.01) {
    morph.value = target
    vel = 0
    springing.value = false
    return
  }
  raf = requestAnimationFrame(step)
}
function kick() {
  if (typeof window === 'undefined') return
  if (reducedMotion.value) {
    morph.value = morphTarget.value
    vel = 0
    return
  }
  if (raf || morph.value === morphTarget.value) return
  springing.value = true
  last = performance.now()
  raf = requestAnimationFrame(step)
}
watch(morphTarget, kick)

/* Line up or scatter, keeping the stage where it is on screen while the scroll track changes. */
async function setLined(v) {
  if (lined.value === v) return
  const before = stage.value?.getBoundingClientRect().top
  lined.value = v
  if (!v) {
    zoomed.value = false
    scrollMorph.value = 0
  }
  await nextTick()
  const el = stage.value
  if (!el || before == null) return
  if (v) {
    const after = el.getBoundingClientRect().top
    if (Math.abs(after - before) > 1) window.scrollBy({ top: after - before, behavior: 'instant' })
  } else {
    // Back to the top of the track, so the scroll morph starts again from the wall.
    const stick = parseFloat(getComputedStyle(el).top) || 0
    const top = track.value?.getBoundingClientRect().top ?? 0
    if (top < stick - 1) window.scrollBy({ top: top - stick, behavior: 'instant' })
    readScroll()
  }
}
const toggleLined = () => setLined(!lined.value)

/* ── scroll progress through the pinned stage ── */
let scrollFrame = 0
function readScroll() {
  scrollFrame = 0
  if (!scrollMorphOn.value || !track.value || !stage.value) return
  const travel = track.value.offsetHeight - stage.value.offsetHeight
  if (travel <= 0) return
  const stick = parseFloat(getComputedStyle(stage.value).top) || 0
  const p = clamp((stick - track.value.getBoundingClientRect().top) / travel, 0, 1)
  const t = clamp(p / 0.85, 0, 1)
  scrollMorph.value = t * t * (3 - 2 * t)
  if (p >= 0.999) setLined(true)
}
function onScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(readScroll)
}
watch(scrollMorphOn, (on) => {
  if (typeof window === 'undefined') return
  if (on) {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    nextTick(readScroll)
  } else {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
  }
})

/* ── stage size ── */
const size = reactive({ w: 960, h: 640 })
let sizeObserver = null
const wide = computed(() => size.w >= 640)
const s = computed(() =>
  wide.value
    ? clamp(Math.min(size.w * 0.22, size.h * 0.4), 140, 260)
    : clamp(Math.min(size.w * 0.42, size.h * 0.42), 110, 200)
)

function startAt() {
  // Reduced motion, or a single trip: no wall, straight to the line with the trip open.
  if (reducedMotion.value || n.value <= 1) {
    lined.value = true
    zoomed.value = true
    morph.value = 1
  }
}
onMounted(() => {
  mounted.value = true
  startAt()
  if (scene.value && typeof ResizeObserver !== 'undefined') {
    sizeObserver = new ResizeObserver(([e]) => {
      size.w = e.contentRect.width
      size.h = e.contentRect.height
      onScroll()
    })
    sizeObserver.observe(scene.value)
  }
})
watch(reducedMotion, (on) => {
  if (on) {
    lined.value = true
    morph.value = 1
  }
})
onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  if (scrollFrame) cancelAnimationFrame(scrollFrame)
  if (crumpleRaf) cancelAnimationFrame(crumpleRaf)
  sizeObserver?.disconnect()
  noteObserver?.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})

/* ── poses ── */
// Cascade, from the disc source's poseOf(): spacing, rise, depth, yaw, fan, tilt, roll per step.
const POSE = { spacing: 1.02, rise: 0.24, depth: 0.42, yaw: 22, fan: -10, tilt: -6, roll: 110 }

function cascadePose(d, z) {
  const S = s.value
  const near = Math.min(d, 2.2)
  const ox = z && wide.value ? size.w * 0.16 : 0
  const oy = size.h * (wide.value ? 0.04 : 0.02)
  const push = d === 0 ? 0 : Math.sign(d) * 0.3 * z
  const zoomScale = wide.value ? 1.35 : 1.25
  return {
    x: (d * POSE.spacing + push) * S + ox,
    y: -d * POSE.rise * S + oy,
    tz: near * POSE.depth * S + (d === 0 ? z * 0.2 * S : 0),
    rz: d === 0 ? POSE.tilt + z * 3 : POSE.tilt,
    ry: POSE.yaw + d * POSE.fan - (d === 0 ? z * 14 : 0),
    rx: 8,
    sc: d === 0 ? lerp(1, zoomScale, z) : 1,
    op: d < -2.5 ? Math.max(0, 1 - (-d - 2.5) / 1.2) : 1,
    hidden: d < -4 || d > 2.8,
    roll: d * POSE.roll
  }
}

// Scatter wall: a jittered grid seeded by each trip's id, so the wall is the same on every visit.
const scatter = computed(() => {
  const W = size.w
  const H = size.h
  const N = n.value
  const pad = Math.max(16, Math.min(W, H) * 0.05)
  const aw = Math.max(1, W - pad * 2)
  const ah = Math.max(1, H - pad * 2 - 64) // keep the controls clear
  let cols = Math.max(1, Math.round(Math.sqrt((N * aw) / ah)))
  const rows = Math.ceil(N / cols)
  cols = Math.ceil(N / rows)
  const cw = aw / cols
  const ch = ah / rows
  const base = clamp((Math.min(cw, ch) * 0.9) / s.value, 0.3, 0.95)
  return list.value.map((t, i) => {
    const r = rng(hashOf(t.id) + 7)
    const col = i % cols
    const row = Math.floor(i / cols)
    const inRow = row === rows - 1 ? N - row * cols : cols
    const cx = pad + ((cols - inRow) * cw) / 2 + (col + 0.5) * cw + (r() - 0.5) * cw * 0.3
    const cy = pad + (row + 0.5) * ch + (r() - 0.5) * ch * 0.3
    return { x: cx - W / 2, y: cy - H / 2, tz: 0, rz: (r() - 0.5) * 24, ry: 0, rx: 0, sc: base * (0.92 + r() * 0.12), roll: (r() - 0.5) * 40 }
  })
})

const poses = computed(() => {
  const m = morph.value
  const z = zoomed.value ? 1 : 0
  const S = s.value
  return list.value.map((_, i) => {
    const d = i - index.value
    const c = cascadePose(d, z)
    const a = scatter.value[i]
    const settled = m >= 0.985
    const x = lerp(a.x, c.x, m)
    const ry = lerp(a.ry, c.ry, m)
    const f = (v) => v.toFixed(2)
    return {
      transform:
        `translate3d(${f(x)}px, ${f(lerp(a.y, c.y, m))}px, ${f(lerp(a.tz, c.tz, m))}px) ` +
        `rotateZ(${f(lerp(a.rz, c.rz, m))}deg) rotateY(${f(ry)}deg) rotateX(${f(lerp(a.rx, c.rx, m))}deg) scale(${lerp(a.sc, c.sc, m).toFixed(3)})`,
      zIndex: m < 0.5 ? 10 + i : d === 0 && z ? 200 : 100 + Math.round(d * 10),
      opacity: lerp(1, c.hidden ? 0 : c.op, m),
      hidden: settled && c.hidden,
      roll: `${f(lerp(a.roll, c.roll, m))}deg`,
      glint: `${f(ry * 3 + (x / S) * 40)}deg`
    }
  })
})
const dealDelay = (i) => `${Math.min(i, 12) * 70}ms`

/* ── moving between trips ── */
function go(i) {
  if (!n.value) return
  const next = clamp(i, 0, n.value - 1)
  if (next === index.value) return
  cardTransition.value = next > index.value ? 'sc-next' : 'sc-prev'
  index.value = next
  currentId.value = list.value[next]?.id
}
function select(i) {
  go(i)
  zoomed.value = true
  if (!lined.value) setLined(true)
}
const prev = () => select(index.value - 1)
const next = () => select(index.value + 1)

function closeDetails() {
  zoomed.value = false
  nextTick(() => scene.value?.focus({ preventScroll: true }))
}

watch(
  () => list.value.map((t) => t.id),
  (ids, old) => {
    const pos = ids.indexOf(currentId.value)
    if (pos >= 0) {
      index.value = pos
    } else {
      // The chosen trip is gone. Deleted (no longer in the items prop): its details fall and the next
      // one opens. Only filtered out: the details just slide along.
      const deleted = old?.includes(currentId.value) && !props.items.some((t) => t.id === currentId.value)
      if (deleted) cardTransition.value = 'sc-fall'
      index.value = Math.min(index.value, Math.max(ids.length - 1, 0))
    }
    currentId.value = ids[index.value]
  }
)

// A deleted trip takes its Delete button with it: keep focus in the carousel instead of dropping it.
function onCardAfterLeave() {
  const el = document.activeElement
  if (!el || el === document.body) scene.value?.focus({ preventScroll: true })
}

/*
  Crumple delete (design.md §5): a deleted trip's stamp crumples, then falls. The TransitionGroup
  below is keyed by trip id, so when the page reloads its list only the removed stamp leaves (no
  leave on the first load, since there is no `appear`). The squash, twist and fall are CSS keyframes
  on .sc-deal (transform and opacity); the paper crinkle is one SVG filter (feTurbulence noise into
  feDisplacementMap), whose displacement this hook ramps from 0 to full over CRUMPLE_MS. Under
  reduced motion there is no filter and the stamp only fades.
*/
const CRUMPLE_MS = 450
const CRUMPLE_PX = 30
const crumpleMap = ref(null)
let crumpleRaf = 0
function onDiscBeforeLeave(el) {
  // Filtered out, not deleted: the trip is still in the items prop, so it just goes, no crumple.
  if (props.items.some((t) => String(t.id) === el.dataset?.tripId)) {
    el.classList.add('is-filtered-out')
    return
  }
  const deal = el.querySelector?.('.sc-deal')
  const map = crumpleMap.value
  if (reducedMotion.value || !deal || !map) return
  if (crumpleRaf) cancelAnimationFrame(crumpleRaf)
  map.setAttribute('scale', '0')
  deal.style.filter = `url(#${uid}-crumple)`
  const t0 = performance.now()
  const tick = (t) => {
    const p = clamp((t - t0) / CRUMPLE_MS, 0, 1)
    map.setAttribute('scale', ((1 - (1 - p) ** 3) * CRUMPLE_PX).toFixed(1))
    crumpleRaf = p < 1 ? requestAnimationFrame(tick) : 0
  }
  crumpleRaf = requestAnimationFrame(tick)
}
const discDuration = computed(() => ({ enter: 0, leave: reducedMotion.value ? 250 : 760 }))

function onKey(e) {
  if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
  if (e.key === 'Escape' && aroundOpen.value) {
    // close the "which stop?" menu first, back on its toggle
    e.preventDefault()
    aroundOpen.value = false
    nextTick(() => document.getElementById(`${uid}-around-toggle`)?.focus())
    return
  }
  if (e.key === 'Escape' && zoomed.value) {
    e.preventDefault()
    closeDetails()
    return
  }
  const keys = { ArrowLeft: prev, ArrowRight: next, Home: () => select(0), End: () => select(n.value - 1) }
  const run = keys[e.key]
  if (!run) return
  e.preventDefault()
  run()
}

/* ── swipe on the stage (taps fall through to the stamp buttons) ── */
let swipe = null
let swallowClick = false
function onPointerDown(e) {
  if (e.button !== 0 || e.target?.closest?.('.sc-controls')) return
  swipe = { x: e.clientX, y: e.clientY }
}
function onPointerUp(e) {
  if (!swipe) return
  const dx = e.clientX - swipe.x
  const dy = e.clientY - swipe.y
  swipe = null
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    // Swallow the click this release would fire on a stamp, and only that one.
    swallowClick = true
    setTimeout(() => { swallowClick = false }, 0)
    // The line climbs to the right, so dragging left brings the next trip in.
    dx < 0 ? next() : prev()
  }
}
function onDiscClick(i) {
  if (swallowClick) {
    swallowClick = false
    return
  }
  select(i)
}

/* ── the glint and the chosen stamp's lean follow a mouse, never a finger ── */
function onPointerMove(e) {
  if (!canTrack.value || e.pointerType !== 'mouse' || !scene.value || !rootEl.value) return
  const r = scene.value.getBoundingClientRect()
  const ox = zoomed.value && wide.value ? size.w * 0.16 : 0
  const span = s.value * 1.5
  const px = clamp((e.clientX - (r.left + r.width / 2 + ox)) / span, -1, 1)
  const py = clamp((e.clientY - (r.top + r.height / 2)) / span, -1, 1)
  rootEl.value.style.setProperty('--sc-px', px.toFixed(3))
  rootEl.value.style.setProperty('--sc-py', py.toFixed(3))
}
function onPointerLeave() {
  rootEl.value?.style.setProperty('--sc-px', '0')
  rootEl.value?.style.setProperty('--sc-py', '0')
}

/* ── trip facts ── */
const stopName = (t) => t?.end_stop || 'Your destination'

/* ── "See what's around <stop>": a link from the open stamp to its stop page (/stop/<code>) ──
   New trips save end_stop_code. Older rows only have the end_stop name, so the first one that
   needs it fetches /api/allBusStops once (LTA BusStops rows: BusStopCode, RoadName, Description),
   and the name is matched on Description: one match links straight there, several open a small
   menu of "<Description>, <RoadName>" links, none shows no link. */
const normName = (s) => String(s ?? '').trim().toLowerCase()
let stopIndexPromise = null   // resolves to Map(normalised Description -> [{ code, description, road }])
function loadStopIndex() {
  stopIndexPromise ??= $fetch('/api/allBusStops')
    .then((rows) => {
      const index = new Map()
      for (const row of rows || []) {
        const key = normName(row.Description)
        if (!key) continue
        if (!index.has(key)) index.set(key, [])
        index.get(key).push({ code: row.BusStopCode, description: row.Description, road: row.RoadName })
      }
      return index
    })
    .catch((err) => {
      stopIndexPromise = null   // let a later stamp try again
      throw err
    })
  return stopIndexPromise
}
const stopMatches = reactive({})   // trip id -> the matching stops for an old row, once looked up
async function matchOldStop(trip) {
  const id = trip.id
  if (id in stopMatches) return
  stopMatches[id] = []
  try {
    const index = await loadStopIndex()
    stopMatches[id] = index.get(normName(trip.end_stop)) || []
  } catch (err) {
    console.error('[passport] bus stop lookup failed:', err?.message || err)
    delete stopMatches[id]
  }
}
watch(
  () => (showDetails.value ? active.value : null),
  (trip) => {
    if (trip && !trip.end_stop_code && trip.end_stop) matchOldStop(trip)
  },
  { immediate: true }
)
const aroundStops = computed(() => {
  const t = active.value
  if (!t) return []
  if (t.end_stop_code) return [{ code: t.end_stop_code, description: t.end_stop, road: '' }]
  return stopMatches[t.id] || []
})
const aroundOpen = ref(false)   // the "which stop?" menu when an old name matches several stops
watch(() => active.value?.id, () => { aroundOpen.value = false })
const dateOf = (t) => (t?.entry_time ? new Date(t.entry_time) : null)
const formatDate = (t) =>
  dateOf(t)?.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' }) ?? ''
const formatTime = (t) =>
  dateOf(t)?.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) ?? ''
const formatDuration = (mins) => {
  if (mins == null || mins === '') return ''
  if (mins < 60) return `${mins} min`
  const hr = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${hr} hr ${m} min` : `${hr} hr`
}
const facts = computed(() => {
  const t = active.value
  if (!t) return []
  return [
    { label: 'Bus', value: isBus(t) ? String(t.bus_taken) : 'Walked', num: isBus(t) },
    { label: 'From', value: t.starting_stop || t.starting_location || '' },
    { label: 'Set off', value: formatTime(t), num: true },
    { label: 'Time taken', value: formatDuration(t.time_taken), num: true },
    { label: 'Date', value: formatDate(t), num: true }
  ].filter((f) => f.value)
})
const pad2 = (v) => String(v).padStart(2, '0') // taste-skill-ignore: the "01 / 07" counter is a control readout the boss asked for

// Photo failures are remembered per URL, so a replaced photo gets a fresh try.
const failed = reactive({})
const photoKey = (t) => `${t.id}|${t.photo_url?.length}|${t.photo_url?.slice(-24)}`
const hasPhoto = (t) => !!t?.photo_url && !failed[photoKey(t)]

// Notes: 3 lines, then "Read more" if the text runs on.
const expanded = reactive({})
const overflowing = ref(false)
const noteEl = ref(null)
let noteObserver = null

function measureNote() {
  const el = noteEl.value
  if (!el) {
    overflowing.value = false
    return
  }
  if (expanded[active.value?.id]) return
  overflowing.value = el.scrollHeight > el.clientHeight + 2
}
watch(noteEl, (el) => {
  noteObserver?.disconnect()
  if (el && typeof ResizeObserver !== 'undefined') {
    noteObserver = new ResizeObserver(measureNote)
    noteObserver.observe(el)
  }
  nextTick(measureNote)
})
watch(() => [active.value?.id, active.value?.entry_notes], () => nextTick(measureNote))
onMounted(() => document.fonts?.ready.then(measureNote))

/* ── the stamp face ── */
// A scalloped edge: 40 small half-circles round a 92-unit circle in the 200-unit stamp.
const SCALLOP = (() => {
  const N = 40
  const R = 92
  const b = R * Math.sin(Math.PI / N)
  const pt = (k) => {
    const a = (k / N) * Math.PI * 2
    return `${(100 + R * Math.cos(a)).toFixed(2)} ${(100 + R * Math.sin(a)).toFixed(2)}`
  }
  let d = `M ${pt(0)}`
  for (let k = 1; k <= N; k++) d += ` A ${b.toFixed(2)} ${b.toFixed(2)} 0 0 1 ${pt(k)}`
  return `${d} Z`
})()

const Scallop = {
  name: 'StampScallop',
  render: () => h('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false' }, [
    h('path', { d: SCALLOP, style: { fill: 'currentColor' } })
  ])
}

// The seven generated label patterns (sunburst, rings, halftone, horizon, stripes, eclipse, mosaic)
// are gone: with no photo the centre is the mascot.
// Kept in view: aesthetic label images like the original Disc Cascade Carousel's (boss, 5 Nov 2026).

// No-photo mascot colours: one pair per trip, picked by hashOf(trip id) % 7, so a stamp keeps its
// colour on every visit but the wall isn't all green. Each pair is a token and its flat tint.
const MASCOT_COLORS = [
  ['var(--wb-green)', 'var(--wb-green-tint)'],
  ['var(--wb-amber)', 'var(--wb-amber-tint)'],
  ['var(--cat-food)', 'var(--cat-food-tint)'],
  ['var(--cat-nature)', 'var(--cat-nature-tint)'],
  ['var(--cat-heritage)', 'var(--cat-heritage-tint)'],
  ['var(--cat-art)', 'var(--cat-art-tint)'],
  ['var(--cat-shopping)', 'var(--cat-shopping-tint)']
]

// A still WanderMascot, drawn from WanderMascot.vue's geometry (orb, shine, capsule eyes, smile,
// nub arms). Drawn here rather than mounting the component, so it never blinks, gazes or hops.
function mascotArt(color, tint) {
  const line = { stroke: 'var(--wb-ink)', strokeWidth: 2.5 }
  return [
    h('rect', { x: -10, y: -6, width: 120, height: 120, style: { fill: tint } }),
    h('ellipse', { cx: 13, cy: 64, rx: 7, ry: 10, style: { fill: color, ...line } }),
    h('ellipse', { cx: 87, cy: 64, rx: 7, ry: 10, style: { fill: color, ...line } }),
    h('circle', { cx: 50, cy: 54, r: 40, style: { fill: color, ...line } }),
    h('ellipse', { cx: 35, cy: 32, rx: 10, ry: 5.5, transform: 'rotate(-28 35 32)', style: { fill: 'var(--wb-surface)', opacity: 0.22 } }),
    h('rect', { x: 31.5, y: 38, width: 9, height: 16, rx: 4.5, style: { fill: 'var(--wb-ink)' } }),
    h('rect', { x: 59.5, y: 38, width: 9, height: 16, rx: 4.5, style: { fill: 'var(--wb-ink)' } }),
    h('path', { d: 'M43 66 Q50 72 57 66', style: { fill: 'none', stroke: 'var(--wb-ink)', strokeWidth: 3.5, strokeLinecap: 'round' } })
  ]
}

/*
  Rim layout (200-unit stamp; ink rings at r 86 and 80 outside, the dashed ring at r 65.5 inside):
  - Top arc, r 70, 200 degrees over the top, read left to right: the stop name. WANDERBUS is added
    after it only when the name is 12 characters or fewer, so the whole line fits without squeezing.
  - Bottom arc, r 77, 140 degrees under the bottom, drawn left to right the short way round so the
    letters stand upright (their tops point at the centre): "BUS 12 · 5 NOV" or "ON FOOT · 5 NOV".
  - A 10 degree gap and an ink dot at each side keep the two lines apart.
  - A line longer than its arc is squeezed to fit (textLength); stop names over 32 characters are
    cut with an ellipsis first, so the type never drops below about 70% of its width.
*/
const RIM_FS = 12.5
const CHAR_W = RIM_FS * 0.72 // a capital plus the .12em tracking, measured loosely for Lexend Deca
const polar = (r, deg) => {
  const a = (deg * Math.PI) / 180
  return `${(100 + r * Math.cos(a)).toFixed(2)} ${(100 + r * Math.sin(a)).toFixed(2)}`
}
const ARC_TOP = { r: 70, span: 200 } // 170 to 10 degrees clockwise (SVG angles, y down) over the top
const ARC_BOTTOM = { r: 77, span: 140 } // 160 to 20 degrees anticlockwise under the bottom
const TOP_PATH = `M ${polar(ARC_TOP.r, 170)} A ${ARC_TOP.r} ${ARC_TOP.r} 0 1 1 ${polar(ARC_TOP.r, 10)}`
const BOTTOM_PATH = `M ${polar(ARC_BOTTOM.r, 160)} A ${ARC_BOTTOM.r} ${ARC_BOTTOM.r} 0 0 0 ${polar(ARC_BOTTOM.r, 20)}`
const roomOf = (arc) => ((arc.span / 360) * 2 * Math.PI * arc.r * 0.92)
const TOP_ROOM = roomOf(ARC_TOP)
const BOTTOM_ROOM = roomOf(ARC_BOTTOM)

function rimTop(t) {
  let name = stopName(t).toUpperCase()
  if (name.length > 32) name = `${name.slice(0, 31).trimEnd()}…`
  return name.length <= 12 ? `${name} · WANDERBUS` : name
}
function rimBottom(t) {
  const d = dateOf(t)
  const day = d ? d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }).toUpperCase() : ''
  const head = isBus(t) ? `BUS ${t.bus_taken}` : 'ON FOOT'
  return day ? `${head} · ${day}` : head
}
const fit = (text, room) => (text.length * CHAR_W > room ? { textLength: room.toFixed(0), lengthAdjust: 'spacingAndGlyphs' } : {})

let stampSeq = 0
const StampFace = {
  name: 'StampFace',
  props: { trip: { type: Object, required: true } },
  setup(p) {
    const id = `${uid}-face-${++stampSeq}`
    return () => {
      const t = p.trip
      const [color, tint] = MASCOT_COLORS[hashOf(t.id) % MASCOT_COLORS.length]
      const top = rimTop(t)
      const bottom = rimBottom(t)
      const ink = { fill: 'none', stroke: 'currentColor' }
      const rimText = (path, text, room) =>
        h('text', { class: 'ink-rim', 'font-size': RIM_FS, style: { fill: 'currentColor' } }, [
          h('textPath', { href: `#${id}-${path}`, startOffset: '50%', 'text-anchor': 'middle', ...fit(text, room) }, text)
        ])
      return [
        // paper
        h('svg', { class: 'sc-paper', viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false' }, [
          h('path', { d: SCALLOP, style: { fill: 'var(--sc-paper, var(--wb-surface))' } })
        ]),
        // centre art: the trip photo, otherwise the still mascot on its tint
        h('span', { class: 'sc-art' }, [
          hasPhoto(t)
            ? h('img', { src: t.photo_url, alt: '', width: 300, height: 300, decoding: 'async', draggable: 'false', onError: () => { failed[photoKey(t)] = true } })
            : h('svg', { viewBox: '0 4 100 100', 'aria-hidden': 'true', focusable: 'false' }, mascotArt(color, tint))
        ]),
        // the inset highlight rings (gloss)
        h('svg', { class: 'sc-gloss', viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false' }, [
          h('circle', { cx: 100, cy: 100, r: 90, style: { fill: 'none', stroke: 'var(--wb-surface)', strokeWidth: 1.4, opacity: 0.7 } }),
          h('circle', { cx: 100, cy: 100, r: 64, style: { fill: 'none', stroke: 'var(--wb-surface)', strokeWidth: 1.2, opacity: 0.5 } })
        ]),
        // the ink overprint: rings, the two rim lines and the side dots
        h('svg', { class: 'sc-ink', viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false' }, [
          h('defs', [
            h('path', { id: `${id}-top`, d: TOP_PATH }),
            h('path', { id: `${id}-bottom`, d: BOTTOM_PATH })
          ]),
          h('g', { style: ink }, [
            h('circle', { cx: 100, cy: 100, r: 86, 'stroke-width': 4.5 }),
            h('circle', { cx: 100, cy: 100, r: 80, 'stroke-width': 1.4 }),
            h('circle', { cx: 100, cy: 100, r: 65.5, 'stroke-width': 2.4, 'stroke-dasharray': '2 4' })
          ]),
          ...[15, 165].map((deg) => {
            const [cx, cy] = polar(73.5, deg).split(' ')
            return h('circle', { cx, cy, r: 2.2, style: { fill: 'currentColor' } })
          }),
          rimText('top', top, TOP_ROOM),
          rimText('bottom', bottom, BOTTOM_ROOM)
        ])
      ]
    }
  }
}
</script>

<template>
  <section
    ref="rootEl"
    class="stamp-carousel"
    :class="{ 'is-reduced': reducedMotion, 'can-track': canTrack, 'stamp-gold': gold }"
    aria-roledescription="carousel"
    :aria-label="label"
    @keydown="onKey"
  >
    <!-- Filters: trip length, how, sort. Native radio groups, so arrow keys move within each one. -->
    <div class="sc-filter-row" role="group" :aria-label="`Filter ${label.toLowerCase()}`">
      <fieldset class="sc-seg">
        <legend class="sc-seg-label">Trip length</legend>
        <div class="sc-seg-opts">
          <label v-for="o in LEN_OPTS" :key="o.value" class="sc-seg-opt" :class="{ 'is-on': filters.len === o.value }">
            <input
              type="radio"
              class="sc-seg-input"
              :name="`${uid}-len`"
              :value="o.value"
              :checked="filters.len === o.value"
              @change="setFilter('len', o.value)"
            >
            <span v-if="o.value !== 'all'" class="sc-swatch" :class="`is-${o.value}`" aria-hidden="true"></span>
            <span>{{ o.label }}</span>
            <span v-if="o.range" class="sc-seg-range num">{{ o.range }}</span>
          </label>
        </div>
      </fieldset>
      <fieldset class="sc-seg">
        <legend class="sc-seg-label">How</legend>
        <div class="sc-seg-opts">
          <label v-for="o in HOW_OPTS" :key="o.value" class="sc-seg-opt" :class="{ 'is-on': filters.how === o.value }">
            <input
              type="radio"
              class="sc-seg-input"
              :name="`${uid}-how`"
              :value="o.value"
              :checked="filters.how === o.value"
              @change="setFilter('how', o.value)"
            >
            <span>{{ o.label }}</span>
          </label>
        </div>
      </fieldset>
      <fieldset class="sc-seg">
        <legend class="sc-seg-label">Sort</legend>
        <div class="sc-seg-opts">
          <label v-for="o in SORT_OPTS" :key="o.value" class="sc-seg-opt" :class="{ 'is-on': filters.sort === o.value }">
            <input
              type="radio"
              class="sc-seg-input"
              :name="`${uid}-sort`"
              :value="o.value"
              :checked="filters.sort === o.value"
              @change="setFilter('sort', o.value)"
            >
            <span>{{ o.label }}</span>
          </label>
        </div>
      </fieldset>
      <div class="sc-filter-meta">
        <p class="sc-result-count" role="status">
          <span class="num">{{ n }}</span> of <span class="num">{{ total }}</span> {{ total === 1 ? 'trip' : 'trips' }}
        </p>
        <button v-if="filtersActive && !noMatch" type="button" class="btn-wb-ghost btn-sm" @click="clearFilters">
          Clear filters
        </button>
      </div>
    </div>

    <div ref="track" class="sc-track" :class="{ 'is-scroll-morph': scrollMorphOn }">
      <div
        ref="stage"
        class="sc-stage"
        :class="[`is-${phase}`, { 'is-springing': springing, 'has-details': showDetails }]"
      >
        <!-- The stamps: click one, swipe, or focus here and use the arrow keys -->
        <div
          ref="scene"
          class="sc-scene"
          tabindex="0"
          role="group"
          :aria-label="`Trip stamps. Use the Left and Right arrow keys to move between ${n} trips.`"
          :style="{ '--sc-s': `${s}px` }"
          @pointerdown="onPointerDown"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @pointermove="onPointerMove"
          @pointerleave="onPointerLeave"
        >
          <!-- The crumple filter for a deleted stamp (its displacement is ramped by onDiscBeforeLeave) -->
          <svg class="sc-filters" width="0" height="0" aria-hidden="true" focusable="false">
            <filter :id="`${uid}-crumple`" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="noise" />
              <feDisplacementMap ref="crumpleMap" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>

          <TransitionGroup tag="div" class="sc-discs" name="disc" :duration="discDuration" @before-leave="onDiscBeforeLeave">
            <button
              v-for="(trip, i) in list"
              :key="trip.id"
              type="button"
              class="sc-disc"
              :data-trip-id="trip.id"
              tabindex="-1"
              :aria-label="`Show trip ${i + 1} of ${n}: ${stopName(trip)}`"
              :aria-current="i === index ? 'true' : undefined"
              :data-active="i === index ? '' : undefined"
              :style="{
                transform: poses[i].transform,
                zIndex: poses[i].zIndex,
                opacity: poses[i].opacity,
                visibility: poses[i].hidden ? 'hidden' : undefined,
                '--sc-roll': poses[i].roll,
                '--sc-glint': poses[i].glint,
                '--sc-deal': dealDelay(i)
              }"
              @click="onDiscClick(i)"
            >
              <span class="sc-deal">
                <span class="sc-tilt">
                  <span class="sc-shade"><Scallop /></span>
                  <span class="sc-edge"><Scallop /></span>
                  <span class="sc-face">
                    <span class="sc-roll"><StampFace :trip="trip" /></span>
                    <span class="sc-sheen"></span>
                  </span>
                </span>
              </span>
            </button>
          </TransitionGroup>

          <!-- Nothing left after the filters (the passport's own no-trips state lives in the page) -->
          <div v-if="noMatch" class="sc-no-match">
            <p class="sc-no-match-title">No trips match these filters</p>
            <p class="sc-no-match-body">Try another trip length or way of getting there.</p>
            <button type="button" class="btn-wb-primary btn-sm" @click="clearFilters">Clear filters</button>
          </div>

          <!-- Controls -->
          <div v-if="n" class="sc-controls">
            <button
              v-if="canScatter"
              type="button"
              class="btn-wb-secondary btn-sm sc-phase"
              @click="toggleLined"
            >
              <i :class="['bi', lined ? 'bi-grid-3x3-gap' : 'bi-distribute-horizontal']" aria-hidden="true"></i>
              {{ lined ? 'Scatter them' : 'Line them up' }}
            </button>
            <button type="button" class="btn-wb-secondary sc-icon-btn" aria-label="Previous trip" :disabled="index <= 0" @click="prev">
              <i class="bi bi-arrow-left" aria-hidden="true"></i>
            </button>
            <span class="sc-count num" aria-hidden="true"><b>{{ pad2(index + 1) }}</b> / {{ pad2(n) }}</span>
            <button type="button" class="btn-wb-secondary sc-icon-btn" aria-label="Next trip" :disabled="index >= n - 1" @click="next">
              <i class="bi bi-arrow-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <!-- The chosen trip's details (the slide) -->
        <Transition :name="cardTransition" mode="out-in" :css="!reducedMotion" @after-leave="onCardAfterLeave" @after-enter="cardTransition = 'sc-next'">
          <article
            v-if="showDetails"
            :key="active.id"
            class="sc-details"
            role="group"
            aria-roledescription="slide"
            :aria-label="`${index + 1} of ${n}: ${stopName(active)}`"
          >
            <header class="sc-details-head">
              <h2 class="sc-title">{{ stopName(active) }}</h2>
              <button type="button" class="btn-wb-ghost sc-icon-btn sc-close" aria-label="Close trip details" @click="closeDetails">
                <i class="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            </header>

            <dl v-if="facts.length" class="sc-facts">
              <div v-for="f in facts" :key="f.label" class="sc-fact">
                <dt>{{ f.label }}</dt>
                <dd :class="{ num: f.num }">{{ f.value }}</dd>
              </div>
            </dl>

            <div v-if="active.entry_notes" class="sc-note-wrap">
              <p
                :id="`${uid}-note`"
                ref="noteEl"
                class="sc-note"
                :class="{ 'is-open': expanded[active.id] }"
              >{{ active.entry_notes }}</p>
              <button
                v-if="overflowing || expanded[active.id]"
                type="button"
                class="btn-wb-ghost btn-sm sc-more"
                :aria-expanded="expanded[active.id] ? 'true' : 'false'"
                :aria-controls="`${uid}-note`"
                @click="expanded[active.id] = !expanded[active.id]"
              >
                {{ expanded[active.id] ? 'Show less' : 'Read more' }}
              </button>
            </div>

            <!-- See what's around the end stop: straight to its stop page, or pick one when an old trip's name matches several -->
            <NuxtLink
              v-if="aroundStops.length === 1"
              :to="`/stop/${aroundStops[0].code}`"
              class="btn-wb-secondary btn-sm sc-around-link"
            >
              <i class="bi bi-geo-alt" aria-hidden="true"></i>
              <span>See what’s around {{ stopName(active) }}</span>
            </NuxtLink>
            <div v-else-if="aroundStops.length > 1" class="sc-around">
              <button
                :id="`${uid}-around-toggle`"
                type="button"
                class="btn-wb-secondary btn-sm sc-around-link"
                :aria-expanded="aroundOpen ? 'true' : 'false'"
                :aria-controls="`${uid}-around-menu`"
                @click="aroundOpen = !aroundOpen"
              >
                <i class="bi bi-geo-alt" aria-hidden="true"></i>
                <span>See what’s around {{ stopName(active) }}</span>
                <i class="bi sc-around-chevron" :class="aroundOpen ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
              </button>
              <ul v-show="aroundOpen" :id="`${uid}-around-menu`" class="sc-around-menu" :aria-label="`Stops named ${stopName(active)}`">
                <li v-for="stop in aroundStops" :key="stop.code">
                  <NuxtLink :to="`/stop/${stop.code}`" class="sc-around-item">
                    {{ stop.description }}<template v-if="stop.road">, {{ stop.road }}</template>
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <slot name="editor" :item="active" :index="index" />
            <slot name="actions" :item="active" :index="index" />
          </article>
        </Transition>
      </div>
    </div>

    <p class="visually-hidden" aria-live="polite" aria-atomic="true">
      <template v-if="phase === 'scatter'">{{ n }} trip stamps on the wall.</template>
      <template v-else-if="active">Trip {{ index + 1 }} of {{ n }}: {{ stopName(active) }}<template v-if="formatDate(active)">, {{ formatDate(active) }}</template></template>
    </p>
  </section>
</template>

<style scoped>
.stamp-carousel {
  --sc-h: clamp(420px, calc(100dvh - var(--header-h) - var(--sp-4)), 1000px);
  container-type: inline-size;
  min-width: 0;
}

/* ── The pinned stage and its scroll track ── */
.sc-track {
  position: relative;
}
.sc-track.is-scroll-morph {
  height: calc(var(--sc-h) + 90dvh);
}
.sc-stage {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, clamp(280px, 36%, 420px)) minmax(0, 1fr);
  align-items: start;
  min-height: var(--sc-h);
  overflow: hidden;
  border-radius: var(--r-card);
  background: var(--wb-surface-2);
}
.is-scroll-morph > .sc-stage {
  position: sticky;
  top: calc(var(--header-h) + var(--sp-2));
}

.sc-scene {
  position: absolute;
  inset: 0;
  z-index: 0;
  perspective: calc(var(--sc-s) * 3.2);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.sc-scene:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: -6px;
  border-radius: var(--r-card);
}
.sc-discs {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}

/* ── One stamp ── */
.sc-disc {
  position: absolute;
  left: calc(50% - var(--sc-s) / 2);
  top: calc(50% - var(--sc-s) / 2);
  width: var(--sc-s);
  height: var(--sc-s);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--wb-green);
  cursor: pointer;
  transform-style: preserve-3d;
  transition: transform var(--t-reveal) var(--ease), opacity var(--t-ui) var(--ease);
  -webkit-tap-highlight-color: transparent;
}
.is-springing .sc-disc {
  transition: none;
}
.is-zoom .sc-disc[data-active] {
  cursor: default;
}
.sc-deal,
.sc-tilt,
.sc-shade,
.sc-edge,
.sc-face,
.sc-roll,
.sc-sheen {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
.sc-deal,
.sc-tilt {
  transform-style: preserve-3d;
}
.sc-deal {
  animation: sc-deal var(--t-reveal) var(--ease) var(--sc-deal, 0ms) both;
}

/* the chosen stamp leans toward the pointer (fine pointers only) */
.sc-tilt {
  transition: transform 500ms var(--ease);
}
.can-track .sc-stage:not(.is-scatter) .sc-disc[data-active] .sc-tilt {
  transform: rotateX(calc(var(--sc-py, 0) * -12deg)) rotateY(calc(var(--sc-px, 0) * 12deg));
}

/* soft ground shade and the back-set edge rim */
.sc-shade {
  color: var(--wb-ink);
  opacity: .2;
  filter: blur(calc(var(--sc-s) * .035));
  transform: translate3d(0, 7%, -18px) scale(.96);
  pointer-events: none;
}
.sc-edge {
  color: color-mix(in srgb, var(--wb-ink) 82%, var(--wb-green));
  transform: translate3d(0, 2.5%, -4px);
}
.sc-shade :deep(svg),
.sc-edge :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.sc-roll {
  transform: rotate(var(--sc-roll, 0deg));
  transition: transform var(--t-reveal) var(--ease);
}
.is-springing .sc-roll {
  transition: none;
}
.sc-roll :deep(svg) {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
.sc-roll :deep(.sc-art) {
  position: absolute;
  inset: 18%;
  overflow: hidden;
  border-radius: 50%;
  background: var(--wb-surface-2);
}
.sc-roll :deep(.sc-art img),
.sc-roll :deep(.sc-art svg) {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
}
.sc-roll :deep(.sc-ink) {
  color: var(--wb-green);
  opacity: .9;
  mix-blend-mode: multiply;
}

/* the conic glint, driven by the pointer and the stamp's yaw */
.sc-sheen {
  inset: 3%;
  opacity: .55;
  mix-blend-mode: screen;
  pointer-events: none;
  background: conic-gradient(from calc(var(--sc-glint, 0deg) + var(--sc-px, 0) * 70deg), /* taste-skill-ignore: glossy stamp finish the boss asked for, a material sheen */
    transparent 0deg,
    color-mix(in srgb, var(--wb-surface) 55%, transparent) 16deg,
    transparent 38deg,
    transparent 140deg,
    color-mix(in srgb, var(--wb-green-tint) 50%, transparent) 168deg,
    color-mix(in srgb, var(--cat-art-tint) 45%, transparent) 186deg,
    color-mix(in srgb, var(--wb-amber-tint) 40%, transparent) 200deg,
    transparent 224deg,
    transparent 360deg);
}

/* Gold foil (shop look perk-stamp-gold, .stamp-gold on the root): legendary-tint paper, a flat
   legendary gold rim and the ink in amber-ink (6.2:1 on the tint), plus one still sheen in place of
   the moving glint. */
.stamp-gold .sc-disc {
  --sc-paper: var(--wb-rarity-legendary-tint);
  color: var(--wb-amber-ink);
}
.stamp-gold .sc-edge {
  color: var(--wb-rarity-legendary);
}
.stamp-gold .sc-roll :deep(.sc-ink) {
  color: var(--wb-amber-ink);
  opacity: 1;
}
.stamp-gold .sc-sheen {
  opacity: .5;
  background: linear-gradient(135deg, /* taste-skill-ignore: a still foil sheen on the gold stamp look */
    transparent 30%,
    color-mix(in srgb, var(--wb-surface) 70%, transparent) 46%,
    transparent 60%);
}

/* Stamp type, set inside the SVG */
.stamp-carousel :deep(.ink-rim) {
  font-family: var(--font-ui);
  font-weight: 600;
  letter-spacing: .12em;
}

@keyframes sc-deal {
  from { opacity: 0; transform: translateY(40px) rotate(-4deg); }
  to   { opacity: 1; transform: none; }
}
@keyframes sc-fall {
  from { opacity: 1; transform: none; }
  to   { opacity: 0; transform: translateY(40px) rotate(6deg) scale(.9); }
}

/* A deleted trip's stamp crumples (about 450ms of the 760ms: squash, twist and the filter's
   crinkle), then falls out of the line; the others close the gap. */
@keyframes sc-crumple {
  0%   { opacity: 1; transform: none; animation-timing-function: cubic-bezier(.3, 0, .4, 1); }
  18%  { transform: scale(.94, .86) rotate(-5deg); animation-timing-function: cubic-bezier(.3, 0, .4, 1); }
  38%  { transform: scale(.78, .84) rotate(6deg); animation-timing-function: cubic-bezier(.3, 0, .4, 1); }
  59%  { opacity: 1; transform: scale(.6, .56) rotate(-9deg); animation-timing-function: cubic-bezier(.5, 0, .9, .6); }
  100% { opacity: 0; transform: translateY(70px) rotate(18deg) scale(.5); }
}
@keyframes sc-fade {
  from { opacity: 1; }
  to   { opacity: 0; }
}
.sc-filters {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}
.disc-leave-active {
  pointer-events: none;
}
.disc-leave-active .sc-deal {
  animation: sc-crumple 760ms linear both;
}

/* ── Filter row, above the wall ── */
.sc-filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--sp-3) var(--sp-5);
  margin-bottom: var(--sp-4);
}
.sc-seg {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.sc-seg-label {
  float: none;
  width: auto;
  margin: 0 0 var(--sp-1);
  padding: 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  font-weight: 500;
  line-height: 1.4;
}
.sc-seg-opts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
  padding: var(--sp-1);
  border-radius: var(--r-pill);
  background: var(--wb-surface-2);
}
.sc-seg-opt {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 44px;
  padding: 0 var(--sp-3);
  border-radius: var(--r-pill);
  color: var(--wb-ink);
  font-size: var(--fs-small);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--t-micro) var(--ease), color var(--t-micro) var(--ease);
}
.sc-seg-opt:hover {
  background: var(--wb-surface);
}
.sc-seg-opt.is-on {
  background: var(--wb-ink);
  color: var(--wb-on-ink);
}
.sc-seg-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.sc-seg-opt:has(.sc-seg-input:focus-visible) {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}
.sc-seg-range {
  color: var(--wb-text-2);
  font-weight: 400;
}
.sc-seg-opt.is-on .sc-seg-range {
  color: var(--wb-on-ink-2);
}
.sc-swatch {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.sc-swatch.is-short { background: var(--wb-green); }
.sc-swatch.is-medium { background: var(--wb-amber); }
.sc-swatch.is-long { background: var(--wb-ink); }
/* the ink swatch keeps an outline so it still shows on the ink pill */
.sc-seg-opt.is-on .sc-swatch.is-long { outline: 2px solid var(--wb-on-ink); outline-offset: -1px; }
.sc-filter-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 44px;
  margin-left: auto;
}
.sc-result-count {
  margin: 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}
.sc-result-count .num {
  color: var(--wb-ink);
  font-weight: 600;
}

/* ── No trip matches the filters ── */
.sc-no-match {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-5);
  text-align: center;
}
.sc-no-match-title {
  margin: 0;
  color: var(--wb-ink);
  font-size: var(--fs-lead);
  font-weight: 600;
}
.sc-no-match-body {
  margin: 0 0 var(--sp-2);
  color: var(--wb-text-2);
}

/* a stamp the filters took out leaves at once (only a real delete crumples) */
.sc-disc.is-filtered-out {
  display: none;
}

/* ── Controls, bottom right ── */
.sc-controls {
  position: absolute;
  right: var(--sp-4);
  bottom: var(--sp-4);
  z-index: 300;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-2);
  max-width: calc(100% - var(--sp-4) * 2);
  padding: var(--sp-1);
  border-radius: var(--r-pill);
  background: var(--wb-surface);
}
.sc-icon-btn {
  width: 44px;
  min-width: 44px;
  padding: 0;
  font-size: var(--fs-lead);
}
.sc-count {
  min-width: 64px;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  text-align: center;
}
.sc-count b {
  color: var(--wb-ink);
  font-weight: 600;
}

/* ── Details, top left ── */
.sc-details {
  position: relative;
  z-index: 2;
  grid-column: 1;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
  margin: var(--sp-4);
  padding: var(--sp-5);
  border-radius: var(--r-card);
  background: var(--wb-surface);
}
.sc-details-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-2);
}
.sc-title {
  margin: 0;
  font-size: clamp(1.75rem, 1.1rem + 2.4cqi, 2.75rem);
  line-height: 1;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
.sc-close {
  flex: none;
  margin: calc(var(--sp-2) * -1) calc(var(--sp-2) * -1) 0 0;
}

.sc-facts {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}
.sc-fact {
  display: grid;
  grid-template-columns: minmax(84px, auto) minmax(0, 1fr);
  align-items: baseline;
  gap: var(--sp-3);
}
.sc-fact dt {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  font-weight: 400;
}
.sc-fact dd {
  margin: 0;
  color: var(--wb-ink);
  font-weight: 500;
  text-align: right;
  overflow-wrap: anywhere;
}

.sc-note-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-1);
}
.sc-note {
  display: -webkit-box;
  align-self: stretch;
  margin: 0;
  overflow: hidden;
  color: var(--wb-ink);
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  white-space: pre-line;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}
.sc-note.is-open {
  display: block;
  -webkit-line-clamp: unset;
  line-clamp: none;
}
.sc-more {
  margin-left: calc(var(--sp-3) * -1);
}

/* ── "See what's around <stop>" ── */
.sc-around {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-2);
  min-width: 0;
}
.sc-around-link {
  align-self: flex-start;
  max-width: 100%;
  text-align: left;
}
.sc-around-link span {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.25;
}
.sc-around-chevron {
  flex: none;
}
.sc-around-menu {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  align-self: stretch;
  margin: 0;
  padding: var(--sp-1);
  list-style: none;
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}
.sc-around-item {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: var(--sp-2) var(--sp-3);
  border-radius: calc(var(--r-control) - var(--sp-1));
  color: var(--wb-ink);
  font-size: var(--fs-small);
  font-weight: 500;
  text-decoration: none;
  overflow-wrap: anywhere;
  transition: background-color var(--t-micro) var(--ease);
}
.sc-around-item:hover {
  background: var(--wb-surface);
}
.sc-around-item:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

/* ── Phones: the details sit below the zoomed stamp, in the stage's flow ── */
@container (max-width: 639px) {
  .sc-stage {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  .sc-scene {
    position: relative;
    inset: auto;
    flex: 1 0 auto;
    min-height: var(--sc-h);
  }
  .has-details .sc-scene {
    flex: none;
    min-height: 0;
    height: clamp(300px, 56dvh, 480px);
  }
  .sc-controls {
    right: var(--sp-3);
    bottom: var(--sp-3);
    max-width: calc(100% - var(--sp-3) * 2);
  }
  .sc-details {
    margin: 0 var(--sp-3) var(--sp-3);
    padding: var(--sp-4);
  }
}

/* ── Details changes: slide along, or fall away after a delete ── */
.sc-next-enter-active, .sc-prev-enter-active, .sc-fall-enter-active {
  transition: opacity var(--t-ui) var(--ease), transform var(--t-reveal) var(--ease);
}
.sc-next-leave-active, .sc-prev-leave-active {
  transition: opacity var(--t-micro) var(--ease), transform var(--t-micro) var(--ease);
}
.sc-next-enter-from { opacity: 0; transform: translateX(-24px); }
.sc-next-leave-to   { opacity: 0; transform: translateX(-16px); }
.sc-prev-enter-from { opacity: 0; transform: translateX(-24px); }
.sc-prev-leave-to   { opacity: 0; transform: translateX(16px); }
.sc-fall-leave-active { animation: sc-fall var(--t-reveal) var(--ease) both; }
.sc-fall-enter-from { opacity: 0; transform: translateY(40px) rotate(-4deg); }

/* ── Reduced motion: no deal-in, roll or lean; every change lands at once ── */
.is-reduced .sc-disc,
.is-reduced .sc-roll,
.is-reduced .sc-tilt {
  transition: none;
}
.is-reduced .sc-deal {
  animation: none;
}
/* a deleted stamp only fades */
.is-reduced .disc-leave-active .sc-deal {
  animation: sc-fade var(--t-ui) linear both;
}
.is-reduced .sc-seg-opt {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .sc-disc, .sc-roll, .sc-tilt, .sc-seg-opt { transition: none; }
  .sc-deal { animation: none; }
  .disc-leave-active .sc-deal { animation: sc-fade var(--t-ui) linear both; filter: none !important; }
}
</style>
