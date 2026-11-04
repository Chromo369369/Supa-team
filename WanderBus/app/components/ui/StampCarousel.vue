<!--
  StampCarousel: the passport as a line of ink-stamped discs (design.md §4.5). Each saved trip is
  one paper disc printed with its stamp. The chosen disc sits in the middle; earlier trips shrink
  away down to the left and the next one leans in from the top right. Moving along, every disc
  rolls like a wheel and swings into its new pose, and the chosen trip slides out below as a
  memory card: photo, stop name and date, the compact ticket strip, the stamp and the note.

  Ported to Vue 3 from "3D CD Disc Carousel" (Disc Cascade Carousel) by kedhareswer, 21st.dev
  (component id 35505): https://21st.dev/kedhareswer/disc-cascade-carousel. Used as part of this
  application only. Changes for WanderBus: Vue port with no React and no Tailwind; the pose maths
  (slanted line, rise, depth, yaw, fan, tilt and roll per step) is kept, but the two-spring rAF
  engine is replaced by CSS transitions on --ease; generated disc labels become paper discs
  printed with an SVG ink stamp in --wb-green; the editorial credits and press quotes become the
  memory card; no wordmark, nav, index menu, sheen or frame; tokens from main.css only.

  Props
    items   passport_entries rows (id, end_stop, entry_time, bus_taken, starting_stop,
            starting_location, time_taken, entry_notes, photo_url)
    label   accessible name of the carousel
  Slots (scoped, { item, index })
    actions   buttons under the memory card (edit / delete live in the page)
    editor    the in-place editor for that trip

  Accessibility: APG carousel pattern. The root is aria-roledescription="carousel"; the memory
  card is the slide ("2 of 5: Blk 55"). Left / Right / Home / End move between trips while focus
  is in the carousel (never from inside a form field). Previous / Next buttons are 44px. The
  only thing that plays on its own is the slow spin of the chosen stamp, and the pause button
  stops it. Changes are announced through a polite status line. Under prefers-reduced-motion
  there is no deal-in, roll, swing, fall or spin: every change is instant.
-->
<script setup>
import { computed, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue'
import SpinTicket from '~/components/ui/SpinTicket.vue'
import { useMotionPrefs } from '~/composables/usePointer'

const props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: 'Your trips' }
})

const uid = `sc${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
const { reducedMotion } = useMotionPrefs()

/* ── pose maths, from the source's poseOf() ── */
const POSE = { spacing: 1.02, rise: 0.24, depth: 0.42, yaw: 22, fan: -10, tilt: -6, roll: 110 }

function poseOf(d) {
  const near = Math.min(d, 2.2)
  return {
    transform:
      `translate3d(calc(${(d * POSE.spacing).toFixed(4)} * var(--sc-s)), calc(${(-d * POSE.rise).toFixed(4)} * var(--sc-s)), ` +
      `calc(${(near * POSE.depth).toFixed(4)} * var(--sc-s))) rotateZ(${POSE.tilt}deg) rotateY(${(POSE.yaw + d * POSE.fan).toFixed(2)}deg) rotateX(8deg)`,
    zIndex: 100 + Math.round(d * 10),
    opacity: d < -2.5 ? Math.max(0, 1 - (-d - 2.5) / 1.2) : 1,
    hidden: d < -4 || d > 2.8,
    roll: `${(d * POSE.roll).toFixed(1)}deg`
  }
}

/* ── which trip is chosen (tracked by id, so a reload keeps your place) ── */
const index = ref(0)
const currentId = ref(props.items[0]?.id)
const rail = ref(null)
const n = computed(() => props.items.length)
const active = computed(() => props.items[index.value] ?? null)
const cardTransition = ref('sc-next')

function go(i) {
  if (!n.value) return
  const next = Math.min(Math.max(i, 0), n.value - 1)
  if (next === index.value) return
  cardTransition.value = next > index.value ? 'sc-next' : 'sc-prev'
  index.value = next
  currentId.value = props.items[next]?.id
}
const prev = () => go(index.value - 1)
const next = () => go(index.value + 1)

watch(
  () => props.items.map((t) => t.id),
  (ids, old) => {
    const pos = ids.indexOf(currentId.value)
    if (pos >= 0) {
      index.value = pos
    } else {
      // The chosen trip is gone (deleted after the confirm): its card falls and the next one deals in.
      if (old?.includes(currentId.value)) cardTransition.value = 'sc-fall'
      index.value = Math.min(index.value, Math.max(ids.length - 1, 0))
    }
    currentId.value = ids[index.value]
  }
)

// A deleted card takes its Delete button with it: keep focus in the carousel instead of dropping it.
function onCardAfterLeave() {
  const el = document.activeElement
  if (!el || el === document.body) rail.value?.focus({ preventScroll: true })
}

function onKey(e) {
  if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
  const keys = { ArrowLeft: prev, ArrowRight: next, Home: () => go(0), End: () => go(n.value - 1) }
  const run = keys[e.key]
  if (!run) return
  e.preventDefault()
  run()
}

/* ── swipe on the disc line (taps fall through to the disc buttons) ── */
let swipe = null
let swallowClick = false
function onPointerDown(e) {
  if (e.button !== 0) return
  swipe = { x: e.clientX, y: e.clientY }
}
function onPointerUp(e) {
  if (!swipe) return
  const dx = e.clientX - swipe.x
  const dy = e.clientY - swipe.y
  swipe = null
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    // Swallow the click this release would fire on a disc, and only that one.
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
  go(i)
}

/* ── idle spin of the chosen stamp: the one thing that plays by itself ── */
const paused = ref(false)
const spinning = computed(() => !paused.value && !reducedMotion.value)

/* ── memory card bits ── */
const isBus = (t) => !!t?.bus_taken && t.bus_taken !== 'Walk'
const stopName = (t) => t?.end_stop || 'Your destination'
const dateOf = (t) => (t?.entry_time ? new Date(t.entry_time) : null)
const formatDate = (t) =>
  dateOf(t)?.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' }) ?? ''
const formatTime = (t) =>
  dateOf(t)?.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) ?? ''

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
function watchNote(el) {
  noteObserver?.disconnect()
  if (el && typeof ResizeObserver !== 'undefined') {
    noteObserver = new ResizeObserver(measureNote)
    noteObserver.observe(el)
  }
}
watch(noteEl, (el) => {
  watchNote(el)
  nextTick(measureNote)
})
watch(() => [active.value?.id, active.value?.entry_notes], () => nextTick(measureNote))
onMounted(() => {
  nextTick(measureNote)
  document.fonts?.ready.then(measureNote)
})
onBeforeUnmount(() => noteObserver?.disconnect())

/* ── deal-in order: left to right along the visible part of the line ── */
const poses = computed(() => props.items.map((_, i) => poseOf(i - index.value)))
const dealDelay = (i) => `${Math.min(Math.max(i - index.value + 4, 0), 7) * 70}ms`

/* ── the ink stamp: stop name round the rim, date in the middle ── */
let stampSeq = 0
const InkStamp = {
  name: 'InkStamp',
  props: { trip: { type: Object, required: true }, rough: { type: Boolean, default: true } },
  setup(p) {
    const id = `${uid}-stamp-${++stampSeq}`
    return () => {
      const t = p.trip
      const d = dateOf(t)
      const day = d ? d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }).toUpperCase() : 'SOMEDAY'
      const year = d ? String(d.getFullYear()) : ''
      const name = stopName(t).toUpperCase()
      const rim = `${name}  ·  WANDERBUS  · `
      // Rim text sits on a 72-unit circle; squeeze long names so they never overlap themselves.
      const room = 2 * Math.PI * 72 * 0.94
      const natural = rim.length * 13 * 0.62
      const head = isBus(t) ? `BUS ${t.bus_taken}` : 'ON FOOT'
      return h('svg', { class: 'ink-stamp', viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false' }, [
        h('defs', [
          h('path', { id: `${id}-rim`, d: 'M 100 100 m -72 0 a 72 72 0 1 1 144 0 a 72 72 0 1 1 -144 0' }),
          p.rough
            ? h('filter', { id: `${id}-ink`, x: '-5%', y: '-5%', width: '110%', height: '110%' }, [
                h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', seed: String((t.id ?? 1) % 97), result: 'n' }),
                h('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '2.4' })
              ])
            : null
        ]),
        h('g', { filter: p.rough ? `url(#${id}-ink)` : undefined, fill: 'none', stroke: 'currentColor' }, [
          h('circle', { cx: 100, cy: 100, r: 92, 'stroke-width': 5 }),
          h('circle', { cx: 100, cy: 100, r: 84, 'stroke-width': 1.5 }),
          h('circle', { cx: 100, cy: 100, r: 56, 'stroke-width': 2.5, 'stroke-dasharray': '2 4' }),
          h('path', { d: 'M 62 92 H 138 M 62 128 H 138', 'stroke-width': 1.5 }),
          h('text', { class: 'ink-rim', fill: 'currentColor', stroke: 'none', 'font-size': 13 }, [
            h('textPath', {
              href: `#${id}-rim`,
              startOffset: '25%',
              'text-anchor': 'middle',
              ...(natural > room ? { textLength: room.toFixed(0), lengthAdjust: 'spacingAndGlyphs' } : {})
            }, rim)
          ]),
          h('text', { class: 'ink-head', x: 100, y: 84, 'text-anchor': 'middle', fill: 'currentColor', stroke: 'none', 'font-size': 12 }, head),
          h('text', { class: 'ink-day', x: 100, y: 120, 'text-anchor': 'middle', fill: 'currentColor', stroke: 'none', 'font-size': 26 }, day),
          h('text', { class: 'ink-year', x: 100, y: 146, 'text-anchor': 'middle', fill: 'currentColor', stroke: 'none', 'font-size': 13 }, year)
        ])
      ])
    }
  }
}
</script>

<template>
  <section
    class="stamp-carousel"
    :class="{ 'is-reduced': reducedMotion }"
    aria-roledescription="carousel"
    :aria-label="label"
    @keydown="onKey"
  >
    <!-- The disc line: click a disc, swipe, or focus it and use the arrow keys -->
    <div
      ref="rail"
      class="sc-rail"
      tabindex="0"
      role="group"
      :aria-label="`Trip stamps. Use the Left and Right arrow keys to move between ${n} trips.`"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <TransitionGroup tag="div" class="sc-stage" name="disc" :css="!reducedMotion" :duration="420">
        <button
          v-for="(trip, i) in items"
          :key="trip.id"
          type="button"
          class="sc-disc"
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
            '--sc-deal': dealDelay(i)
          }"
          @click="onDiscClick(i)"
        >
          <span class="sc-disc-deal">
            <span class="sc-disc-paper">
              <span class="sc-disc-roll">
                <span class="sc-disc-spin" :class="{ 'is-spinning': i === index && spinning }">
                  <InkStamp :trip="trip" :rough="false" />
                </span>
              </span>
            </span>
          </span>
        </button>
      </TransitionGroup>
    </div>

    <!-- Controls -->
    <div class="sc-controls">
      <button type="button" class="btn-wb-secondary sc-icon-btn" aria-label="Previous trip" :disabled="index <= 0" @click="prev">
        <i class="bi bi-arrow-left" aria-hidden="true"></i>
      </button>
      <span class="sc-count num" aria-hidden="true"><b>{{ index + 1 }}</b> / {{ n }}</span>
      <button type="button" class="btn-wb-secondary sc-icon-btn" aria-label="Next trip" :disabled="index >= n - 1" @click="next">
        <i class="bi bi-arrow-right" aria-hidden="true"></i>
      </button>
      <button
        v-if="!reducedMotion"
        type="button"
        class="btn-wb-ghost sc-icon-btn sc-pause"
        :aria-label="paused ? 'Spin the stamp' : 'Pause the stamp spin'"
        :aria-pressed="paused ? 'true' : 'false'"
        @click="paused = !paused"
      >
        <i :class="['bi', paused ? 'bi-play-fill' : 'bi-pause-fill']" aria-hidden="true"></i>
      </button>
    </div>

    <p class="visually-hidden" aria-live="polite" aria-atomic="true">
      <template v-if="active">Trip {{ index + 1 }} of {{ n }}: {{ stopName(active) }}<template v-if="formatDate(active)">, {{ formatDate(active) }}</template></template>
    </p>

    <!-- The chosen trip's memory card (the slide) -->
    <Transition :name="cardTransition" mode="out-in" :css="!reducedMotion" appear
      appear-from-class="sc-deal-from"
      appear-active-class="sc-deal-active"
      appear-to-class="sc-deal-to"
      @after-leave="onCardAfterLeave"
      @after-enter="cardTransition = 'sc-next'">
      <article
        v-if="active"
        :key="active.id"
        class="sc-card"
        role="group"
        aria-roledescription="slide"
        :aria-label="`${index + 1} of ${n}: ${stopName(active)}`"
      >
        <div class="sc-card-grid">
          <figure class="sc-photo" :class="{ 'sc-photo--empty': !hasPhoto(active) }">
            <img
              v-if="hasPhoto(active)"
              :src="active.photo_url"
              :alt="`Your photo from ${active.end_stop || 'this trip'}`"
              width="600"
              height="800"
              decoding="async"
              @error="failed[photoKey(active)] = true"
            />
            <figcaption v-else class="sc-photo-note">No photo yet. Add one with Edit.</figcaption>
            <span class="sc-stamp" aria-hidden="true"><InkStamp :trip="active" /></span>
          </figure>

          <div class="sc-body">
            <header class="sc-title-row">
              <h2 class="sc-title">{{ stopName(active) }}</h2>
              <time v-if="active.entry_time" class="sc-date num" :datetime="active.entry_time">{{ formatDate(active) }}</time>
            </header>
            <p v-if="active.starting_location || active.entry_time" class="sc-from">
              <template v-if="active.starting_location">From {{ active.starting_location }}</template>
              <template v-if="active.starting_location && active.entry_time"> · </template>
              <template v-if="active.entry_time">set off at <span class="num">{{ formatTime(active) }}</span></template>
            </p>

            <SpinTicket
              compact
              :bus="isBus(active) ? String(active.bus_taken) : ''"
              :board-at="active.starting_stop || 'Your bus stop'"
              :get-off-at="stopName(active)"
              area=""
              :stops="null"
              :travel-time="active.time_taken ?? null"
            />

            <div v-if="active.entry_notes" class="sc-note-wrap">
              <p class="sc-note-label">Your notes</p>
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

            <slot name="editor" :item="active" :index="index" />
            <slot name="actions" :item="active" :index="index" />
          </div>
        </div>
      </article>
    </Transition>
  </section>
</template>

<style scoped>
.stamp-carousel {
  --sc-s: clamp(128px, 36vw, 196px);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
}

/* ── Disc line ── */
.sc-rail {
  position: relative;
  height: calc(var(--sc-s) * 1.6);
  overflow: hidden;
  border-radius: var(--r-card);
  background: var(--wb-surface-2);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.sc-rail:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 3px;
}
.sc-stage {
  position: absolute;
  left: 50%;
  top: 54%;
  width: var(--sc-s);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  perspective: calc(var(--sc-s) * 3.2);
}
.sc-disc {
  position: absolute;
  inset: 0;
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
.sc-disc[data-active] {
  cursor: default;
}
.sc-disc-deal,
.sc-disc-paper,
.sc-disc-roll,
.sc-disc-spin {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
.sc-disc-deal {
  animation: sc-deal var(--t-reveal) var(--ease) var(--sc-deal, 0ms) both;
}
.sc-disc-paper {
  overflow: hidden;
  border: 2px solid var(--wb-ink);
  background: var(--wb-surface);
}
.sc-disc[data-active] .sc-disc-paper {
  border-width: 3px;
}
.sc-disc-roll {
  transform: rotate(var(--sc-roll, 0deg));
  transition: transform var(--t-reveal) var(--ease);
}
.sc-disc-spin {
  padding: 8%;
}
.sc-disc-spin.is-spinning {
  animation: sc-spin 24s linear infinite;
}
.sc-disc .ink-stamp {
  width: 100%;
  height: 100%;
  opacity: .85;
  mix-blend-mode: multiply;
}

@keyframes sc-deal {
  from { opacity: 0; transform: translateY(40px) rotate(-4deg); }
  to   { opacity: 1; transform: none; }
}
@keyframes sc-spin {
  to { transform: rotate(360deg); }
}
@keyframes sc-fall {
  from { opacity: 1; transform: none; }
  to   { opacity: 0; transform: translateY(40px) rotate(6deg) scale(.9); }
}

/* a deleted trip's disc falls out of the line; the others close the gap */
.disc-leave-active .sc-disc-deal {
  animation: sc-fall var(--t-reveal) var(--ease) both;
}

/* ── Controls ── */
.sc-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
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
.sc-pause {
  margin-left: var(--sp-2);
}

/* ── Memory card ── */
.sc-card {
  container-type: inline-size;
  border-radius: var(--r-card);
  background: var(--wb-surface);
}
.sc-card-grid {
  display: grid;
  gap: var(--sp-5);
  padding: var(--sp-4);
}
@container (min-width: 600px) {
  .sc-card-grid {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    align-items: start;
    padding: var(--sp-5);
  }
}

.sc-photo {
  position: relative;
  margin: 0;
  aspect-ratio: 4 / 5;
  background: var(--wb-surface-2);
}
@media (min-width: 768px) {
  .sc-photo { aspect-ratio: 3 / 4; }
}
.sc-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sc-photo--empty {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--sp-4);
}
.sc-photo-note {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  text-align: center;
}
.sc-stamp {
  position: absolute;
  right: calc(var(--sp-3) * -1);
  bottom: calc(var(--sp-4) * -1);
  width: 104px;
  height: 104px;
  color: var(--wb-green);
  opacity: .85;
  mix-blend-mode: multiply;
  transform: rotate(-8deg);
  pointer-events: none;
}
.sc-photo--empty .sc-stamp {
  inset: 14% 14% auto;
  width: auto;
  height: auto;
  aspect-ratio: 1;
}
.sc-stamp .ink-stamp {
  display: block;
  width: 100%;
  height: 100%;
}

.sc-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
}
.sc-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-1) var(--sp-3);
}
.sc-title {
  margin: 0;
  font-size: var(--fs-lead);
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.sc-date {
  color: var(--wb-muted);
  font-size: var(--fs-small);
}
.sc-from {
  margin: calc(var(--sp-3) * -1) 0 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  overflow-wrap: anywhere;
}

.sc-note-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-1);
}
.sc-note-label {
  margin: 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}
.sc-note {
  display: -webkit-box;
  align-self: stretch;
  margin: 0;
  padding: var(--sp-3) var(--sp-4);
  overflow: hidden;
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  font-family: var(--font-hand);
  font-size: 1.375rem;
  font-weight: 500;
  line-height: 1.25;
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

/* Stamp type, set inside the SVG */
.stamp-carousel :deep(.ink-rim),
.stamp-carousel :deep(.ink-head),
.stamp-carousel :deep(.ink-year) {
  font-family: var(--font-ui);
  font-weight: 600;
  letter-spacing: .12em;
}
.stamp-carousel :deep(.ink-day) {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: .02em;
}

/* ── Card changes: slide along, or fall away after a delete ── */
.sc-next-enter-active, .sc-prev-enter-active, .sc-fall-enter-active {
  transition: opacity var(--t-ui) var(--ease), transform var(--t-reveal) var(--ease);
}
.sc-next-leave-active, .sc-prev-leave-active {
  transition: opacity var(--t-micro) var(--ease), transform var(--t-micro) var(--ease);
}
.sc-next-enter-from { opacity: 0; transform: translateX(32px); }
.sc-next-leave-to   { opacity: 0; transform: translateX(-24px); }
.sc-prev-enter-from { opacity: 0; transform: translateX(-32px); }
.sc-prev-leave-to   { opacity: 0; transform: translateX(24px); }

.sc-fall-leave-active { animation: sc-fall var(--t-reveal) var(--ease) both; }
.sc-fall-enter-from,
.sc-deal-from { opacity: 0; transform: translateY(40px) rotate(-4deg); }
.sc-deal-active {
  transition: opacity var(--t-reveal) var(--ease) 280ms, transform var(--t-reveal) var(--ease) 280ms;
}

/* ── Reduced motion: everything lands at once ── */
.is-reduced .sc-disc,
.is-reduced .sc-disc-roll {
  transition: none;
}
.is-reduced .sc-disc-deal,
.is-reduced .sc-disc-spin {
  animation: none;
}
.is-reduced .sc-disc-roll {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .sc-disc, .sc-disc-roll { transition: none; }
  .sc-disc-deal, .sc-disc-spin.is-spinning { animation: none; }
}
</style>
