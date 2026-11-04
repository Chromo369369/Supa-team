<!-- Photo gallery in a native <dialog>, laid out as an inverted coverflow (the boss's skiper49 reference):
     square photos, the centre one flat and in front, up to two on each side turned on Y with their OUTER edge
     toward the viewer and tucked behind the centre one. Dots underneath (a tablist), prev/next, arrow keys, swipe.
     Usage: <PhotoViewer ref="viewer" :photos="[{ url, alt, isPioneer, createdAt, caption }]" title="Photos of Tiong Bahru Market" />
     then viewer.value.open(index). Esc, Close or a click on the backdrop closes it and focus goes back to the opener. -->
<script setup>
const props = defineProps({
    photos: { type: Array, default: () => [] },   // { url, alt?, isPioneer?, createdAt?, caption? }
    start: { type: Number, default: 0 },
    title: { type: String, default: 'Photos' }     // the dialog's accessible name
})

const REACH = 2          // neighbours shown on each side of the centre photo
const MAX_DOTS = 12      // past this the dots get too small to hit, the "2 of 30" counter does the job alone

const uid = useId()
const stageId = `${uid}-stage`
const dotId = i => `${uid}-dot-${i}`

const dialog = ref(null)
const index = ref(0)
const full = ref(false)          // "View full photo": the centre photo uncropped, the others hidden
const wrapped = ref(new Set())   // slides that wrapped round the ends on the last move (they're remounted, not slid across)
const generation = ref({})      // slide index -> how many times it wrapped, part of its key so it remounts
const loaded = reactive(new Set())   // only photos that have been on screen get a src
let opener = null
let swipeStartX = null

const count = computed(() => props.photos.length)
const current = computed(() => props.photos[index.value] ?? null)
const showDots = computed(() => count.value > 1 && count.value <= MAX_DOTS)
const dateText = computed(() => current.value?.createdAt
    ? new Date(current.value.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
    : '')

function clamp(value) {
    return Math.min(Math.max(value, 0), Math.max(count.value - 1, 0))
}

// how far slide i sits from the centre, going the short way round (the gallery loops)
function offsetOf(i, at = index.value) {
    const n = count.value
    let d = ((i - at) % n + n) % n
    if (d > n / 2) d -= n
    return d
}

// where each distance sits: x in slide widths, scale, opacity. Past REACH it waits off to the side, invisible
const SPOTS = [
    { x: 0, k: 1, o: 1 },
    { x: 0.84, k: 0.9, o: 1 },
    { x: 1.5, k: 0.78, o: 1 },
    { x: 2.1, k: 0.7, o: 0 }
]

const slides = computed(() => props.photos.map((photo, i) => {
    const d = offsetOf(i)
    const a = Math.min(Math.abs(d), REACH + 1)
    const side = Math.sign(d)
    const spot = SPOTS[a]
    return {
        photo,
        i,
        d,
        key: `${i}-${generation.value[i] ?? 0}`,
        style: {
            '--x': side * spot.x,
            '--ry': `${-side * 35}deg`,   // negative on the right swings the right (outer) edge toward the viewer
            '--k': spot.k,
            '--o': spot.o,
            zIndex: 10 - a
        }
    }
}))

function loadAround(at) {
    for (let i = 0; i < count.value; i++) {
        if (Math.abs(offsetOf(i, at)) <= REACH) loaded.add(i)
    }
}

function goTo(target) {
    const n = count.value
    if (n < 2) return
    target = ((target % n) + n) % n
    if (target === index.value) return
    const from = index.value
    const shift = offsetOf(target, from)
    // a slide that doesn't just move along by `shift` jumped across the ends; remount it so it doesn't fly over the centre
    const jumped = new Set()
    for (let i = 0; i < n; i++) {
        if (offsetOf(i, target) !== offsetOf(i, from) - shift) jumped.add(i)
    }
    const gens = { ...generation.value }
    for (const i of jumped) gens[i] = (gens[i] ?? 0) + 1
    generation.value = gens
    wrapped.value = jumped
    loadAround(target)
    index.value = target
}

function go(step) {
    goTo(index.value + step)
}

function open(at = props.start) {
    if (!dialog.value || !count.value) return
    opener = document.activeElement
    full.value = false
    wrapped.value = new Set()
    index.value = clamp(at)
    loadAround(index.value)
    if (!dialog.value.open) dialog.value.showModal()
}

function close() {
    if (dialog.value?.open) dialog.value.close()
}

// the native close event covers Esc, the Close button and the backdrop
function onClose() {
    if (opener && document.contains(opener)) opener.focus()
    opener = null
}

function onKey(event) {
    const inDots = event.target.closest?.('[role="tablist"]')
    let target = null
    if (event.key === 'ArrowRight') target = index.value + 1
    else if (event.key === 'ArrowLeft') target = index.value - 1
    else if (inDots && event.key === 'Home') target = 0
    else if (inDots && event.key === 'End') target = count.value - 1
    if (target === null) return
    event.preventDefault()
    goTo(target)
    // keyboard on the dots moves focus with the selection (roving tabindex)
    if (inDots) nextTick(() => document.getElementById(dotId(index.value))?.focus())
}

// the dialog box has no padding, so a click whose target is the dialog itself landed on the backdrop
function onClick(event) {
    if (event.target === dialog.value) close()
}

// swipe left/right on the photos; vertical drags still scroll (touch-action: pan-y)
function onPointerDown(event) {
    if (event.target.closest('button')) return
    swipeStartX = event.clientX
}

function onPointerUp(event) {
    if (swipeStartX === null) return
    const moved = event.clientX - swipeStartX
    swipeStartX = null
    if (Math.abs(moved) > 48) go(moved < 0 ? 1 : -1)
}

// the list can shrink while it's open (e.g. a photo removed), keep the index in range
watch(count, () => {
    index.value = clamp(index.value)
    loaded.clear()
    loadAround(index.value)
})

defineExpose({ open, close })
</script>

<template>
    <dialog ref="dialog" class="photo-viewer" :aria-label="title" @close="onClose" @click="onClick" @keydown="onKey">
        <div v-if="current" class="viewer-inner">
            <div class="viewer-head">
                <p class="viewer-meta">
                    <span v-if="count > 1" class="viewer-counter num" aria-live="polite">{{ index + 1 }} of {{ count }}</span>
                    <span v-if="current.caption" class="viewer-caption">{{ current.caption }}</span>
                    <span v-if="current.isPioneer" class="pioneer-tag"><i class="bi bi-award-fill" aria-hidden="true"></i> Pioneer photo</span>
                    <span v-if="dateText" class="viewer-date">{{ dateText }}</span>
                </p>
                <div class="viewer-tools">
                    <button type="button" class="viewer-btn viewer-toggle" aria-label="View full photo" :aria-pressed="full ? 'true' : 'false'" @click="full = !full">
                        <i class="bi" :class="full ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'" aria-hidden="true"></i>
                        <span class="toggle-text" aria-hidden="true">View full photo</span>
                    </button>
                    <button type="button" class="viewer-btn" aria-label="Close" @click="close">
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </div>
            </div>

            <div
                :id="stageId"
                class="viewer-stage"
                :class="{ 'is-full': full }"
                :role="showDots ? 'tabpanel' : undefined"
                :aria-labelledby="showDots ? dotId(index) : undefined"
                @pointerdown="onPointerDown"
                @pointerup="onPointerUp"
                @pointercancel="swipeStartX = null"
            >
                <div
                    v-for="slide in slides"
                    :key="slide.key"
                    class="viewer-slide"
                    :class="{ 'is-current': slide.d === 0, 'is-wrapped': wrapped.has(slide.i) }"
                    :style="slide.style"
                    :aria-hidden="slide.d !== 0 ? 'true' : undefined"
                >
                    <img
                        v-if="loaded.has(slide.i)"
                        :src="slide.photo.url"
                        :alt="slide.photo.alt || `Photo ${slide.i + 1} of ${count}`"
                        width="800"
                        height="800"
                        class="viewer-photo"
                        decoding="async"
                        draggable="false"
                    />
                </div>
            </div>

            <div v-if="count > 1" class="viewer-controls">
                <button type="button" class="viewer-btn" aria-label="Previous photo" @click="go(-1)">
                    <i class="bi bi-chevron-left" aria-hidden="true"></i>
                </button>
                <div v-if="showDots" class="viewer-dots" role="tablist" aria-label="Choose a photo">
                    <button
                        v-for="(photo, i) in photos"
                        :id="dotId(i)"
                        :key="i"
                        type="button"
                        role="tab"
                        class="viewer-dot"
                        :aria-selected="i === index ? 'true' : 'false'"
                        :aria-controls="stageId"
                        :aria-label="`Photo ${i + 1} of ${count}`"
                        :tabindex="i === index ? 0 : -1"
                        @click="goTo(i)"
                    >
                        <span class="dot-mark" aria-hidden="true"></span>
                    </button>
                </div>
                <button type="button" class="viewer-btn" aria-label="Next photo" @click="go(1)">
                    <i class="bi bi-chevron-right" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    </dialog>
</template>

<style scoped>
.photo-viewer {
  width: min(1040px, calc(100vw - 2 * var(--gutter)));
  max-width: none;
  max-height: calc(100dvh - 2 * var(--sp-4));
  padding: 0;
  border: 0;
  border-radius: var(--r-card);
  background: var(--wb-ground);
  color: var(--wb-ink);
  overscroll-behavior: contain;
  box-shadow: var(--wb-float); /* taste-skill-ignore: floating overlay */
}

.photo-viewer::backdrop {
  background: color-mix(in srgb, var(--wb-ink) 70%, transparent);
}

.viewer-inner {
  /* one slide's side: big on a laptop, a good share of a phone, never taller than the window allows */
  --s: min(400px, 58vw, 50dvh);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-2) var(--sp-4);
}

.viewer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding-left: var(--sp-3);
}

.viewer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1) var(--sp-3);
  min-width: 0;
  margin: 0;
  font-size: var(--fs-small);
}

.viewer-counter {
  font-weight: 600;
}

.viewer-caption {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.viewer-date {
  color: var(--wb-text-2);
}

.pioneer-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  background: var(--wb-amber-tint);
  color: var(--wb-amber-ink);
  border-radius: var(--r-pill);
  padding: 2px 10px;
  font-size: var(--fs-meta);
  font-weight: 600;
}

.viewer-tools {
  display: flex;
  flex-shrink: 0;
  gap: var(--sp-1);
}

.viewer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  flex-shrink: 0;
  min-width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--r-pill);
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  font: 500 var(--fs-small)/1 var(--font-ui);
  cursor: pointer;
  transition: background-color var(--t-micro) var(--ease);
}

.viewer-btn .bi {
  font-size: 18px;
}

.viewer-btn:hover {
  background: var(--wb-line);
}

.viewer-btn:focus-visible,
.viewer-dot:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.viewer-toggle {
  padding: 0 var(--sp-4);
}

.viewer-toggle[aria-pressed="true"] {
  background: var(--wb-ink);
  color: var(--wb-on-ink);
}

/* on a phone the toggle keeps its icon only (its aria-label still names it) */
@media (max-width: 479.98px) {
  .viewer-toggle { padding: 0; width: 44px; }
  .toggle-text { display: none; }
}

/* ---- the coverflow ---- */
.viewer-stage {
  position: relative;
  height: calc(var(--s) + 2 * var(--sp-5));
  perspective: 1100px;
  overflow: hidden;
  touch-action: pan-y;
  user-select: none;
}

.viewer-slide {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--s);
  height: var(--s);
  margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
  border-radius: var(--r-control);
  overflow: hidden;
  background: var(--wb-surface-2);
  opacity: var(--o);
  transform: translateX(calc(var(--x) * var(--s))) rotateY(var(--ry)) scale(var(--k));
  transition: transform var(--t-reveal) var(--ease), opacity var(--t-reveal) var(--ease);
}

.viewer-slide:not(.is-current) {
  pointer-events: none;
}

/* a slide that wrapped round the ends fades in at its new spot instead of sliding across */
.viewer-slide.is-wrapped {
  animation: slide-appear var(--t-reveal) var(--ease) both;
}

@keyframes slide-appear {
  from { opacity: 0; }
}

.viewer-photo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* "View full photo": the centre photo fills the stage uncropped, the rest step away */
.viewer-stage.is-full {
  height: min(70dvh, 680px);
}

.viewer-stage.is-full .viewer-slide {
  opacity: 0;
}

.viewer-stage.is-full .viewer-slide.is-current {
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 1;
  background: transparent;
  transform: none;
}

.viewer-stage.is-full .viewer-photo {
  object-fit: contain;
}

/* ---- prev, dots, next ---- */
.viewer-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
}

.viewer-dots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  min-width: 0;
}

/* the hit area is 28 × 44, the visible dot is 8px */
.viewer-dot {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--r-pill);
  background: none;
  cursor: pointer;
}

.dot-mark {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--wb-control);
  transition: background-color var(--t-micro) var(--ease), transform var(--t-micro) var(--ease);
}

.viewer-dot:hover .dot-mark {
  background: var(--wb-text-2);
}

.viewer-dot[aria-selected="true"] .dot-mark {
  background: var(--wb-ink);
  transform: scale(1.25);
}

/* reduced motion: no turning or sliding, the photos simply crossfade in place */
@media (prefers-reduced-motion: reduce) {
  .viewer-slide {
    transform: none;
    transition: opacity var(--t-reveal) linear;
    animation: none;
  }
  .viewer-slide:not(.is-current) { opacity: 0; }
  .dot-mark { transition: none; }
}
</style>
