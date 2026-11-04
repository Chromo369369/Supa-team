<!-- The photos around a stop as one curved, endlessly streaming row (the boss's tilted-grid-hero reference):
     a concave row like the inside of a cylinder. Tiles near the middle are small and flat, tiles toward the ends
     grow and turn so their outer edge comes toward you, and both ends fade into the page.
     Each tile's turn comes from where it is on screen right now, so the curve stays put while the photos stream through it.
     Usage: <PhotoStrip :photos="[{ id, url, placeName }]" @open="index => viewer.open(index)" />
     Hover or focus pauses it. Reduced motion: a still row you scroll yourself. -->
<script setup>
const props = defineProps({
    photos: { type: Array, default: () => [] }   // { id, url, placeName }
})

const emit = defineEmits(['open'])

const SPEED = 28        // px per second
const MAX_TURN = 35     // degrees at the ends
const GROW = 0.38       // how much bigger the end tiles get, the stand-in for the bowed edges

const root = ref(null)
const track = ref(null)
const still = ref(false)    // prefers-reduced-motion: no stream, no clones, a plain scrolling row
const copies = ref(0)       // aria-hidden clones of the row, enough to cover the width while it loops

let offset = 0
let loopWidth = 0           // one row's width including its trailing gap
let half = 0                // half the strip's width
let tiles = []              // { el, centre } for every tile, real and cloned
let raf = 0
let last = 0
let hovered = false
let focused = false
let onScreen = true
let motionQuery = null
let resizeObserver = null
let visibilityObserver = null

const paused = () => hovered || focused || !onScreen || document.hidden

function measure() {
    if (!root.value || !track.value) return
    half = root.value.clientWidth / 2
    const rows = track.value.querySelectorAll('.strip-row')
    const second = rows[1]
    loopWidth = second ? second.offsetLeft - rows[0].offsetLeft : rows[0]?.offsetWidth ?? 0
    // offsetLeft ignores transforms, so these are the tiles' resting spots on the track
    // (the track is the tiles' offsetParent)
    tiles = [...track.value.querySelectorAll('.strip-tile')].map(el => ({ el, centre: el.offsetLeft + el.offsetWidth / 2 }))
}

// enough clones that the row plus its copies always covers the strip while it slides one row along
function planCopies() {
    if (still.value || !root.value || !track.value) { copies.value = 0; return }
    const row = track.value.querySelector('.strip-row')
    const rowWidth = row?.offsetWidth || 1
    copies.value = Math.max(1, Math.ceil(root.value.clientWidth / rowWidth))
}

function paint() {
    if (!track.value) return
    if (still.value) {
        track.value.style.transform = ''
        for (const tile of tiles) tile.el.style.transform = ''
        return
    }
    track.value.style.transform = `translate3d(${-offset}px, 0, 0)`
    for (const tile of tiles) {
        // -1 at the left edge, 0 in the middle, 1 at the right edge
        const t = Math.max(-1, Math.min(1, (tile.centre - offset - half) / (half || 1)))
        // a negative turn on the right swings the right (outer) edge toward the viewer, and the other way on the left
        tile.el.style.transform = `perspective(700px) rotateY(${(-t * MAX_TURN).toFixed(2)}deg) scale(${(1 + GROW * t * t).toFixed(3)})`
    }
}

function frame(now) {
    const dt = Math.min(now - last, 64)   // a tab coming back from the background doesn't leap ahead
    last = now
    if (loopWidth > 0) offset = (offset + SPEED * dt / 1000) % loopWidth
    paint()
    raf = paused() ? 0 : requestAnimationFrame(frame)
}

function play() {
    if (still.value || raf || paused()) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
}

function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
}

async function relayout() {
    planCopies()
    await nextTick()
    measure()
    if (loopWidth > 0) offset %= loopWidth
    paint()
    play()
}

// only a real mouse hover pauses it; a tap on a phone would otherwise leave it paused for good
function onEnter(event) {
    if (event.pointerType !== 'mouse') return
    hovered = true
    stop()
}
function onLeave() {
    hovered = false
    play()
}

// focus pauses it, and the focused tile slides to the middle of the curve so it's never hidden in the fade
function onFocusIn(event) {
    focused = true
    stop()
    if (still.value) return
    const tile = tiles.find(item => item.el === event.target)
    if (tile && loopWidth > 0) {
        offset = (((tile.centre - half) % loopWidth) + loopWidth) % loopWidth
        paint()
    }
}

function onFocusOut(event) {
    if (root.value?.contains(event.relatedTarget)) return
    focused = false
    play()
}

function onVisibility() {
    if (document.hidden) stop()
    else play()
}

function onMotionChange() {
    still.value = motionQuery.matches
    stop()
    offset = 0
    relayout()
}

onMounted(() => {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    still.value = motionQuery.matches
    motionQuery.addEventListener('change', onMotionChange)
    document.addEventListener('visibilitychange', onVisibility)
    resizeObserver = new ResizeObserver(() => relayout())
    resizeObserver.observe(root.value)
    // off screen (scrolled away, or on another tab of the page) it stops drawing
    visibilityObserver = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting
        if (onScreen) play()
        else stop()
    })
    visibilityObserver.observe(root.value)
    relayout()
})

onBeforeUnmount(() => {
    stop()
    motionQuery?.removeEventListener('change', onMotionChange)
    document.removeEventListener('visibilitychange', onVisibility)
    resizeObserver?.disconnect()
    visibilityObserver?.disconnect()
})

watch(() => props.photos.map(photo => photo.id).join(','), () => relayout())
</script>

<template>
    <section class="photo-strip" :class="{ 'is-still': still }" aria-label="Photos around this stop"
        @pointerenter="onEnter" @pointerleave="onLeave" @focusin="onFocusIn" @focusout="onFocusOut">
        <div ref="track" class="strip-track">
            <ul class="strip-row" role="list">
                <li v-for="(photo, i) in photos" :key="photo.id">
                    <button type="button" class="strip-tile" @click="emit('open', i)">
                        <img :src="photo.url" :alt="`Photo of ${photo.placeName}`" width="320" height="200" loading="lazy" decoding="async" draggable="false" />
                    </button>
                </li>
            </ul>
            <!-- the copies that make the loop seamless: hidden from screen readers and out of the tab order -->
            <ul v-for="copy in copies" :key="`copy-${copy}`" class="strip-row" aria-hidden="true">
                <li v-for="(photo, i) in photos" :key="photo.id">
                    <button type="button" class="strip-tile" tabindex="-1" @click="emit('open', i)">
                        <img :src="photo.url" alt="" width="320" height="200" loading="lazy" decoding="async" draggable="false" />
                    </button>
                </li>
            </ul>
        </div>
    </section>
</template>

<style scoped>
.photo-strip {
  --tile: clamp(150px, 24vw, 260px);
  --gap: var(--sp-4);
  position: relative;
  max-width: 100%;
  overflow: hidden;   /* the track is far wider than the page, this keeps it from scrolling sideways */
  /* room above and below for the end tiles, which grow by about 40% */
  padding-block: calc(var(--tile) * 0.625 * 0.22 + var(--sp-2));
  margin-bottom: var(--sp-4);
  -webkit-mask-image: linear-gradient(to right, transparent, #000 14%, #000 86%, transparent); /* taste-skill-ignore: edge fade mask */
  mask-image: linear-gradient(to right, transparent, #000 14%, #000 86%, transparent); /* taste-skill-ignore: edge fade mask */
}

.strip-track {
  position: relative;
  display: flex;
  width: max-content;
  will-change: transform;
}

.strip-row {
  display: flex;
  gap: var(--gap);
  margin: 0;
  padding: 0 var(--gap) 0 0;   /* the trailing gap, so the next copy is spaced like any other tile */
  list-style: none;
}

.strip-tile {
  display: block;
  width: var(--tile);
  aspect-ratio: 16 / 10;
  padding: 0;
  border: 0;
  border-radius: var(--r-control);
  overflow: hidden;
  background: var(--wb-surface-2);
  cursor: zoom-in;
  backface-visibility: hidden;
}

.strip-tile:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.strip-tile img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* reduced motion: a still, flat row you scroll yourself, no fade so every photo is fully visible */
.photo-strip.is-still {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  padding-block: var(--sp-1);
  -webkit-mask-image: none;
  mask-image: none;
}

.photo-strip.is-still .strip-track {
  will-change: auto;
}

.photo-strip.is-still .strip-row li {
  scroll-snap-align: start;
}
</style>
