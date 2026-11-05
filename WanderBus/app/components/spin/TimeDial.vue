<script setup lang="ts">
import { computed, ref } from 'vue'
import { bandFor, type Band } from '~/components/spin/TicketBelt.vue'

const value = defineModel<number>({ required: true })

const props = withDefaults(defineProps<{
    min?: number
    max?: number
    step?: number
    id?: string
    describedby?: string
}>(), { min: 10, max: 120, step: 5, id: undefined, describedby: undefined })

// The dial runs clockwise from 12 o'clock, leaving a gap before the top so the two ends never meet.
const SWEEP = 324
const C = 100
const R_TRACK = 74
const R_BAND = 92

const BAND_COLOUR: Record<Band, { fill: string; text: string; label: string }> = {
    short: { fill: 'var(--wb-green)', text: 'var(--wb-green)', label: 'Short trip' },
    medium: { fill: 'var(--wb-amber)', text: 'var(--wb-amber-ink)', label: 'Medium trip' },
    long: { fill: 'var(--wb-ink)', text: 'var(--wb-ink)', label: 'Long trip' }
}

const inputEl = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

const safeValue = computed(() => Math.min(props.max, Math.max(props.min, Number(value.value) || props.min)))
const band = computed(() => bandFor(safeValue.value))
const colour = computed(() => BAND_COLOUR[band.value])

const angleFor = (v: number) => ((v - props.min) / (props.max - props.min)) * SWEEP

function point(angle: number, r: number) {
    const rad = (angle * Math.PI) / 180
    return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) }
}

function arc(a0: number, a1: number, r: number) {
    const p0 = point(a0, r)
    const p1 = point(a1, r)
    const large = a1 - a0 > 180 ? 1 : 0
    return `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)}A${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
}

const trackPath = computed(() => arc(0, SWEEP, R_TRACK))
const valueAngle = computed(() => angleFor(safeValue.value))
const valuePath = computed(() => (valueAngle.value > 0.5 ? arc(0, valueAngle.value, R_TRACK) : ''))
const thumb = computed(() => point(valueAngle.value, R_TRACK))

// Band arcs on the outer ring, with a small gap where one band hands over to the next.
const bandArcs = computed(() => {
    const edges: [Band, number, number][] = [
        ['short', props.min, 20],
        ['medium', 20, 40],
        ['long', 40, props.max]
    ]
    return edges
        .filter(([, from, to]) => to > from)
        .map(([b, from, to], i, all) => {
            const a0 = angleFor(from) + (i > 0 ? 1.5 : 0)
            const a1 = angleFor(to) - (i < all.length - 1 ? 1.5 : 0)
            return { band: b, d: arc(a0, a1, R_BAND), fill: BAND_COLOUR[b].fill }
        })
})

// Hour-style marks every 10 minutes, inside the track.
const ticks = computed(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = []
    for (let m = Math.ceil(props.min / 10) * 10; m <= props.max; m += 10) {
        const a = angleFor(m)
        const major = m % 30 === 0
        const p0 = point(a, R_TRACK - 16)
        const p1 = point(a, R_TRACK - (major ? 24 : 20))
        out.push({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, major })
    }
    return out
})

function snap(v: number) {
    const stepped = Math.round((v - props.min) / props.step) * props.step + props.min
    return Math.min(props.max, Math.max(props.min, stepped))
}

function setValue(v: number) {
    const next = snap(v)
    if (next !== value.value) value.value = next
}

const isDisabled = () => !!inputEl.value?.matches(':disabled')

function valueFromPointer(e: PointerEvent, svg: SVGSVGElement) {
    const box = svg.getBoundingClientRect()
    const dx = e.clientX - (box.left + box.width / 2)
    const dy = e.clientY - (box.top + box.height / 2)
    // Too close to the centre the angle jumps about, so ignore it there.
    if (Math.hypot(dx, dy) < box.width * 0.12) return null
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (angle < 0) angle += 360
    if (angle > SWEEP) {
        // In the gap: stay on whichever end you came from.
        return safeValue.value > (props.min + props.max) / 2 ? props.max : props.min
    }
    return props.min + (angle / SWEEP) * (props.max - props.min)
}

function onPointerDown(e: PointerEvent) {
    if (isDisabled() || (e.pointerType === 'mouse' && e.button !== 0)) return
    const svg = e.currentTarget as SVGSVGElement
    const v = valueFromPointer(e, svg)
    inputEl.value?.focus({ preventScroll: true })
    if (v === null) return
    e.preventDefault()
    svg.setPointerCapture(e.pointerId)
    dragging.value = true
    setValue(v)
}

function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return
    const v = valueFromPointer(e, e.currentTarget as SVGSVGElement)
    if (v !== null) setValue(v)
}

function onPointerUp(e: PointerEvent) {
    if (!dragging.value) return
    dragging.value = false
    const svg = e.currentTarget as SVGSVGElement
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId)
}

function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return
    e.preventDefault()
    setValue(safeValue.value + (e.key === 'PageUp' ? 3 : -3) * props.step)
}

function onInput(e: Event) {
    setValue(Number((e.target as HTMLInputElement).value))
}
</script>

<template>
    <div class="time-dial" :class="{ 'is-dragging': dragging }" :style="{ '--dial-band': colour.fill, '--dial-text': colour.text }">
        <!-- The native range stays the real control: hidden (Bootstrap .visually-hidden) but focusable. -->
        <input
            :id="id"
            ref="inputEl"
            class="time-dial-input visually-hidden"
            type="range"
            :min="min"
            :max="max"
            :step="step"
            :value="safeValue"
            :aria-valuetext="`${safeValue} minutes`"
            :aria-describedby="describedby"
            @input="onInput"
            @keydown="onKeydown"
        >
        <svg
            class="time-dial-face"
            viewBox="0 0 200 200"
            aria-hidden="true"
            focusable="false"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @lostpointercapture="dragging = false"
        >
            <path v-for="b in bandArcs" :key="b.band" :d="b.d" class="time-dial-band" :style="{ stroke: b.fill }" />
            <path :d="trackPath" class="time-dial-track" />
            <path v-if="valuePath" :d="valuePath" class="time-dial-value" />
            <line
                v-for="(t, i) in ticks"
                :key="i"
                :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
                class="time-dial-tick"
                :class="{ 'is-major': t.major }"
            />
            <circle :cx="thumb.x" :cy="thumb.y" r="14" class="time-dial-thumb" />
        </svg>
        <div class="time-dial-readout" aria-hidden="true">
            <span class="time-dial-number num">{{ safeValue }}</span>
            <span class="time-dial-unit">min</span>
            <span class="time-dial-band-label">{{ colour.label }}</span>
        </div>
    </div>
</template>

<style scoped>
.time-dial {
  position: relative;
  width: min(100%, 200px);
  aspect-ratio: 1;
  margin-inline: auto;
}

.time-dial-face {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  touch-action: none;
  cursor: grab;
  user-select: none;
}

.time-dial.is-dragging .time-dial-face {
  cursor: grabbing;
}

/* Focus on the hidden input shows on the dial itself */
.time-dial-input:focus-visible + .time-dial-face {
  outline: 3px solid var(--wb-green);
  outline-offset: 4px;
}

.time-dial-input:disabled + .time-dial-face {
  cursor: not-allowed;
  opacity: 0.55;
}

.time-dial-band {
  fill: none;
  stroke-width: 6;
  stroke-linecap: butt;
}

.time-dial-track {
  fill: none;
  stroke: var(--wb-surface-2);
  stroke-width: 18;
  stroke-linecap: round;
}

.time-dial-value {
  fill: none;
  stroke: var(--dial-band);
  stroke-width: 18;
  stroke-linecap: round;
}

.time-dial-tick {
  stroke: var(--wb-control);
  stroke-width: 2;
  stroke-linecap: round;
}

.time-dial-tick.is-major {
  stroke: var(--wb-text-2);
  stroke-width: 3;
}

.time-dial-thumb {
  fill: var(--wb-surface);
  stroke: var(--dial-band);
  stroke-width: 5;
}

.time-dial-readout {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  pointer-events: none;
  text-align: center;
}

.time-dial-number {
  font-family: var(--font-display);
  font-size: 2.75rem;
  font-weight: 600;
  line-height: 1;
  color: var(--wb-ink);
}

.time-dial-unit {
  font-size: var(--fs-small);
  font-weight: 500;
  color: var(--wb-text-2);
}

.time-dial-band-label {
  margin-top: var(--sp-1);
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--dial-text);
}

@media (prefers-reduced-motion: no-preference) {
  .time-dial-face {
    transition: opacity var(--t-ui) var(--ease);
  }
}
</style>
