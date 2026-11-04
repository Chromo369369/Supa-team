<!--
  LedBoard: a dot-matrix destination sign like the one on the front of a bus.
  The badge (e.g. "??" or a bus number) sits on the left; messages flip in row by row every few
  seconds, and lines too long for the panel scroll. Screen readers get the plain text.
  Pass `messages` for a rotating sign, or just `line1` / `line2` for a single message.
  Accessibility: only the `label` prop is announced (politely, when it changes), never each flip.
  Rotation pauses on hover or focus and stops entirely under prefers-reduced-motion (first message).
-->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { ledDots, ledTextWidth } from '~/utils/ledFont'

const props = defineProps({
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    /** Each message is a string or [line1, line2]. Overrides line1 / line2. */
    messages: { type: Array, default: null },
    badge: { type: String, default: '??' },
    /** Size of one LED dot in px. Leave empty to use 4 px on phones and 5 px on larger screens. */
    pitch: { type: Number, default: null },
    interval: { type: Number, default: 4200 },
    /** Plain-text version of the sign. Announced to screen readers whenever it changes. */
    label: { type: String, default: '' }
})

const ROWS = 17
const uid = useId()
const wrap = ref(null)
const cols = ref(96)
const width = ref(480)
const pitchPx = computed(() => props.pitch ?? (width.value < 576 ? 4 : 5))
const index = ref(0)
const reduceMotion = ref(false)
const paused = ref(false)

const normalised = computed(() => {
    const list = props.messages?.length ? props.messages : [[props.line1, props.line2].filter(Boolean)]
    return list.map((m) => (Array.isArray(m) ? m.slice(0, 2).map(String) : [String(m)]))
})
const current = computed(() => normalised.value[index.value % Math.max(1, normalised.value.length)] ?? [''])
// Changes whenever the text changes, so new data flips in like a new message.
const flipKey = computed(() => `${index.value}:${current.value.join('|')}`)

// On narrow boards the badge is drawn single size, leaving room for the message.
const badgeScale = computed(() => (cols.value < 110 ? 1 : 2))
const badgeDots = computed(() => (props.badge ? ledDots(props.badge, badgeScale.value) : []))
const badgeCols = computed(() => (props.badge ? ledTextWidth(props.badge) * badgeScale.value : 0))
const badgeTop = computed(() => (badgeScale.value === 2 ? 2 : 5))
const zoneX = computed(() => (props.badge ? badgeCols.value + 3 + (badgeScale.value === 2 ? 6 : 4) : 3))
const zoneW = computed(() => Math.max(10, cols.value - zoneX.value - 3))

const lines = computed(() => {
    const list = current.value
    const tops = list.length === 1 ? [5] : [1, 9]
    const widths = list.map((text) => ledTextWidth(text))
    const overflows = widths.map((w) => w > zoneW.value && !reduceMotion.value)
    // Lines that don't fit scroll; if both scroll they share one loop so they stay in step.
    const loop = Math.max(...widths.filter((_, i) => overflows[i]), 0) + 14
    return list.map((text, i) => {
        const scroll = overflows[i]
        const offsetX = scroll || props.badge ? zoneX.value : zoneX.value + Math.max(0, Math.floor((zoneW.value - widths[i]) / 2))
        const base = ledDots(text).map(([x, y]) => [x + offsetX, y + tops[i]])
        const dots = scroll ? base.concat(base.map(([x, y]) => [x + loop, y])) : base
        return { text, dots, scroll, loop }
    })
})

// Without a label, screen readers get the first message as static (non-live) text.
const staticText = computed(() => [props.badge, ...(normalised.value[0] ?? [])].filter(Boolean).join(' '))

let timer = null
let resizeObserver = null
let motionQuery = null

function measure() {
    if (!wrap.value) return
    width.value = wrap.value.clientWidth
    cols.value = Math.max(24, Math.floor(width.value / pitchPx.value))
}

function schedule() {
    clearInterval(timer)
    timer = null
    if (reduceMotion.value) {
        index.value = 0
        return
    }
    if (normalised.value.length > 1 && !paused.value) {
        timer = setInterval(() => {
            index.value = (index.value + 1) % normalised.value.length
        }, props.interval)
    }
}

function pause() {
    paused.value = true
    schedule()
}

function resume(e) {
    // Stay paused while focus or the pointer is still inside the sign.
    if (e?.type === 'focusout' && wrap.value?.contains(e.relatedTarget)) return
    if (e?.type === 'mouseleave' && wrap.value?.contains(document.activeElement)) return
    paused.value = false
    schedule()
}

const onMotionChange = () => {
    reduceMotion.value = motionQuery.matches
    schedule()
}

onMounted(() => {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduceMotion.value = motionQuery.matches
    motionQuery.addEventListener('change', onMotionChange)
    measure()
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(wrap.value)
    schedule()
})

onBeforeUnmount(() => {
    clearInterval(timer)
    resizeObserver?.disconnect()
    motionQuery?.removeEventListener('change', onMotionChange)
})

// Restart from the first message when the content changes (e.g. a new spin result).
watch(
    () => JSON.stringify(normalised.value),
    () => {
        index.value = 0
        schedule()
    }
)
</script>

<template>
    <div
        ref="wrap"
        class="led-board"
        :style="{ height: `${ROWS * pitchPx}px` }"
        @mouseenter="pause"
        @mouseleave="resume"
        @focusin="pause"
        @focusout="resume"
    >
        <svg
            class="led-board__svg"
            :viewBox="`0 0 ${cols} ${ROWS}`"
            :width="cols * pitchPx"
            :height="ROWS * pitchPx"
            preserveAspectRatio="xMinYMin meet"
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                <pattern :id="`${uid}-off`" width="1" height="1" patternUnits="userSpaceOnUse">
                    <circle cx="0.5" cy="0.5" r="0.3" class="led-board__off" />
                </pattern>
                <clipPath :id="`${uid}-zone`">
                    <rect :x="zoneX" y="0" :width="zoneW" :height="ROWS" />
                </clipPath>
            </defs>
            <rect x="0" y="0" :width="cols" :height="ROWS" :fill="`url(#${uid}-off)`" />
            <g v-if="badge" class="led-board__on">
                <circle v-for="([x, y], i) in badgeDots" :key="`b${i}`" :cx="x + 3.5" :cy="y + badgeTop + 0.5" r="0.42" />
            </g>
            <g :clip-path="`url(#${uid}-zone)`">
                <Transition name="led-flip">
                    <g :key="flipKey" class="led-board__on">
                        <g
                            v-for="(line, li) in lines"
                            :key="li"
                            :class="{ 'led-board__scroll': line.scroll }"
                            :style="line.scroll ? { '--loop': `${-line.loop}px`, animationDuration: `${line.loop * 55}ms`, animationTimingFunction: `steps(${line.loop})` } : undefined"
                        >
                            <circle v-for="([x, y], i) in line.dots" :key="i" :cx="x + 0.5" :cy="y + 0.5" r="0.42" />
                        </g>
                    </g>
                </Transition>
            </g>
        </svg>
        <p v-if="label" class="visually-hidden" aria-live="polite">{{ label }}</p>
        <p v-else class="visually-hidden">{{ staticText }}</p>
    </div>
</template>

<style scoped>
.led-board {
  position: relative;
  overflow: hidden;
  background-color: var(--wb-ink);
  border-radius: var(--r-control);
}

.led-board__svg {
  display: block;
  max-width: none;
}

.led-board__off {
  /* unlit dots: one faint step up from the navy panel */
  fill: color-mix(in srgb, var(--wb-on-ink) 9%, var(--wb-ink));
}

/* Lit dots: the one legitimate use of amber as a glyph fill (design.md §2.1). */
.led-board__on {
  fill: var(--wb-amber);
}

.led-board__scroll {
  animation-name: led-scroll;
  animation-iteration-count: infinite;
}

@keyframes led-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(var(--loop)); }
}

.led-flip-enter-active,
.led-flip-leave-active {
  transition: transform 380ms steps(9);
}

.led-flip-enter-from {
  transform: translateY(9px);
}

.led-flip-leave-to {
  transform: translateY(-9px);
}

@media (prefers-reduced-motion: reduce) {
  .led-flip-enter-active,
  .led-flip-leave-active {
    transition: none;
  }
}
</style>
