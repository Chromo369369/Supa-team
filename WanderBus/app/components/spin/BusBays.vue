<!--
  BusBays: up to three small buses pull into bays A, B and C one after another, and the user picks
  one to board (design.md §3.3, §4.3). Original WanderBus layout, no ported source.

  Props
    bays     [{ letter, bus, area, minutes }]; bus is '' / null for a walking trip
    stagger  ms between each bus arriving                                     (default 320)

  Emits
    choose(index)  on click, Enter or Space

  Keyboard: the bays are one radiogroup with a roving tabindex. Arrow keys (and Home / End) move
  between bays, Enter or Space boards the focused one. The LED on a small bus is unreadable, so each
  bay also has real-text labels under the bus. Under reduced motion BusDriveBy shows the end state.
-->
<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import BusDriveBy from '~/components/ui/BusDriveBy.vue'

const props = defineProps({
    bays: { type: Array, required: true },
    stagger: { type: Number, default: 320 }
})

const emit = defineEmits(['choose'])

// `focusIndex` owns the single tab stop; `checked` is the bay the arrows last landed on.
const focusIndex = ref(0)
const checked = ref(-1)
const bayEls = []
const setBay = (el, i) => { bayEls[i] = el }

watch(() => props.bays.length, () => {
    focusIndex.value = 0
    checked.value = -1
})

const count = computed(() => props.bays.length)

function bayLabel(bay) {
    const ride = bay.bus ? `bus ${bay.bus}` : 'walk'
    const to = bay.area ? ` to ${bay.area}` : ''
    return `Bay ${bay.letter}, ${ride}${to}, about ${bay.minutes} min`
}

function move(i) {
    focusIndex.value = i
    checked.value = i
    nextTick(() => bayEls[i]?.focus())
}

function choose(i) {
    focusIndex.value = i
    checked.value = i
    emit('choose', i)
}

function onKey(e, i) {
    const n = count.value
    switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            e.preventDefault()
            move((i + 1) % n)
            break
        case 'ArrowLeft':
        case 'ArrowUp':
            e.preventDefault()
            move((i - 1 + n) % n)
            break
        case 'Home':
            e.preventDefault()
            move(0)
            break
        case 'End':
            e.preventDefault()
            move(n - 1)
            break
        case 'Enter':
        case ' ':
            e.preventDefault()
            choose(i)
            break
    }
}

// The Spin button is disabled while searching, which drops focus to the page. Pick it up here.
onMounted(() => {
    const active = document.activeElement
    if (!active || active === document.body) bayEls[0]?.focus({ preventScroll: true })
})
</script>

<template>
    <div class="bays" role="radiogroup" aria-label="Pick your bus" :style="{ '--bay-count': count }">
        <div
            v-for="(bay, i) in bays"
            :key="bay.letter"
            :ref="(el) => setBay(el, i)"
            class="bay"
            role="radio"
            :aria-checked="checked === i ? 'true' : 'false'"
            :aria-label="bayLabel(bay)"
            :tabindex="focusIndex === i ? 0 : -1"
            @click="choose(i)"
            @keydown="onKey($event, i)"
            @focus="focusIndex = i"
        >
            <span class="bay-letter" aria-hidden="true">{{ bay.letter }}</span>
            <BusDriveBy
                class="bay-bus"
                mode="arrive"
                size="sm"
                :delay="i * stagger"
                :badge="bay.bus ? String(bay.bus) : ''"
                :label="bay.bus ? 'BOARD' : 'WALK'"
            />
            <div class="bay-info" aria-hidden="true">
                <span class="bay-service">
                    <i :class="['bi', bay.bus ? 'bi-bus-front' : 'bi-person-walking']" aria-hidden="true"></i>
                    <span v-if="bay.bus" class="num">{{ bay.bus }}</span>
                    <template v-else>Walk</template>
                </span>
                <span v-if="bay.area" class="bay-area">{{ bay.area }}</span>
                <span class="bay-time"><span class="num">{{ bay.minutes }}</span> min</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.bays {
  display: grid;
  grid-template-columns: repeat(var(--bay-count, 3), minmax(0, 1fr));
  gap: var(--sp-2);
  width: 100%;
  max-width: calc(var(--bay-count, 3) * 200px);
  margin-inline: auto;
}

/* A painted bay: lines on both sides, the letter on the kerb */
.bay {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--sp-2);
  min-width: 0;
  min-height: 44px;
  padding: var(--sp-3) var(--sp-2);
  border: 2px solid transparent;
  border-inline-color: var(--wb-line);
  border-radius: var(--r-control);
  color: var(--wb-ink);
  cursor: pointer;
  transition: transform var(--t-micro) var(--ease);
  -webkit-tap-highlight-color: transparent;
}

.bay:hover {
  background: var(--wb-surface-2);
}

.bay:active {
  transform: scale(0.98);
}

.bay[aria-checked='true'] {
  border-color: var(--wb-green);
  background: var(--wb-green-tint);
}

.bay:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.bay-letter {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--wb-ink);
  color: var(--wb-on-ink);
  font-family: var(--font-display);
  font-size: var(--fs-small);
  font-weight: 600;
  line-height: 1;
}

.bay-bus {
  width: 100%;
}

.bay-info {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
  text-align: center;
}

.bay-service {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-display);
  font-size: var(--fs-lead);
  font-weight: 600;
  line-height: 1.1;
}

.bay-service .bi {
  font-size: var(--fs-body);
  color: var(--wb-green);
}

.bay-area {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  max-width: 100%;
  font-size: var(--fs-meta);
  line-height: 1.3;
  color: var(--wb-text-2);
  overflow-wrap: anywhere;
}

.bay-time {
  font-size: var(--fs-small);
  font-weight: 500;
  color: var(--wb-text-2);
}

@media (prefers-reduced-motion: reduce) {
  .bay { transition: none; }
  .bay:active { transform: none; }
}
</style>
