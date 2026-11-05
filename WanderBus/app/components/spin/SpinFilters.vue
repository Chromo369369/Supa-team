<!--
  Spin filters: starting location, time available and what you’re in the mood for.
  A sidebar from the lg breakpoint up; on phones a bottom sheet (Bootstrap offcanvas) opened from a dock
  that keeps a summary and the Spin button in reach. Category chips are real checkboxes (.btn-check),
  so their checked state is announced natively.
  The start location is a WAI-ARIA combobox. Time and categories are mirrored in the URL
  (?mins=60&cats=cafe,park); the start location stays in memory only.
-->
<script setup>
import { categoryInfo } from '~/utils/spinCategories'
import TimeDial from '~/components/spin/TimeDial.vue'

const travelTime = defineModel('travelTime')
const startingLocation = defineModel('startingLocation')
const selectedPlace = defineModel('selectedPlace')
const preferences = defineModel('preferences')

const props = defineProps({
    places: Array,
    categories: Array,
    /** A spin is in progress. */
    busy: { type: Boolean, default: false },
    /** The user has spun at least once (button says "Spin again"). */
    hasSpun: { type: Boolean, default: false },
    group: Boolean
})

const emit = defineEmits(['submit'])

const MIN_TIME = 10
const MAX_TIME = 120

const canSpin = computed(() => !!selectedPlace.value && !!travelTime.value && !props.busy && !props.group)
// A disabled Spin button explains itself (design.md §2.4).
const spinHint = computed(() => {
    if (props.group) return 'You are already in a group, please spin there or exit your group first'
    if (!props.busy && !selectedPlace.value) return 'Pick a starting point to spin'
    return ''
})
// const spinHint3 = computed(()=> (solo? 'You currently have an active ticket, please end that journey first':''))
const spinLabel = computed(() => (props.busy ? 'Spinning…' : props.hasSpun ? 'Spin again' : 'Spin'))

const summary = computed(() => {
    const moods = preferences.value?.length ? preferences.value.map((c) => categoryInfo(c).label).join(', ') : 'Anything'
    return `Up to ${travelTime.value} min, ${moods}`
})

// Starting-location combobox (WAI-ARIA combobox with a listbox popup)
const listboxId = 'start-suggestions'
const activeIndex = ref(-1)
const dismissed = ref(false)
const typed = computed(() => !!startingLocation.value && !selectedPlace.value)
const suggestions = computed(() => (typed.value ? (props.places ?? []).slice(0, 5) : []))
const listOpen = computed(() => suggestions.value.length > 0 && !dismissed.value)
const activeId = computed(() => (listOpen.value && activeIndex.value >= 0 ? `${listboxId}-${activeIndex.value}` : undefined))
const resultCount = computed(() => {
    if (!typed.value || dismissed.value) return ''
    const n = suggestions.value.length
    if (!n) return startingLocation.value.length >= 3 ? 'No matching places' : ''
    return `${n} ${n === 1 ? 'place' : 'places'} found. Use the up and down arrows to choose.`
})

watch(suggestions, () => {
    activeIndex.value = -1
})

function onLocationInput() {
    selectedPlace.value = ''
    dismissed.value = false
}

function choosePlace(place) {
    selectedPlace.value = place
    startingLocation.value = place.ADDRESS
    activeIndex.value = -1
}

function onLocationKey(e) {
    const n = suggestions.value.length
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!n) return
        e.preventDefault()
        dismissed.value = false
        const step = e.key === 'ArrowDown' ? 1 : -1
        activeIndex.value = activeIndex.value < 0 ? (step > 0 ? 0 : n - 1) : (activeIndex.value + step + n) % n
    } else if (e.key === 'Enter') {
        if (listOpen.value && activeIndex.value >= 0) {
            e.preventDefault()
            choosePlace(suggestions.value[activeIndex.value])
        }
    } else if (e.key === 'Escape') {
        if (listOpen.value) {
            e.preventDefault()
            dismissed.value = true
            activeIndex.value = -1
        }
    }
}

// Time and categories live in the URL so a spin setup can be shared or restored.
const route = useRoute()
const router = useRouter()

onMounted(() => {
    const mins = Number(route.query.mins)
    if (route.query.mins && Number.isFinite(mins)) {
        travelTime.value = Math.min(MAX_TIME, Math.max(MIN_TIME, Math.round(mins / 5) * 5))
    }
    if (typeof route.query.cats === 'string' && route.query.cats) {
        const known = props.categories ?? []
        const cats = route.query.cats.split(',').filter((c) => known.includes(c))
        if (cats.length) preferences.value = cats
    }
})

watch(
    () => [travelTime.value, (preferences.value ?? []).join(',')],
    ([mins, cats]) => {
        const query = { ...route.query, mins: String(mins) }
        if (cats) query.cats = cats
        else delete query.cats
        if (query.mins === route.query.mins && query.cats === route.query.cats) return
        router.replace({ query })
    }
)

function submit() {
    if (canSpin.value) emit('submit')
}
</script>

<template>
    <div>
        <div id="filters-sheet" class="offcanvas-lg offcanvas-bottom filters-sheet" tabindex="-1" aria-labelledby="filters-title">
            <div class="offcanvas-header filters-sheet-header">
                <h2 id="filters-title" class="filters-title m-0">Your filters</h2>
                <button type="button" class="btn-close" data-bs-dismiss="offcanvas" data-bs-target="#filters-sheet" aria-label="Close filters"></button>
            </div>

            <div class="offcanvas-body">
                <section class="filters">
                    <h2 class="filters-title d-none d-lg-block">Your filters</h2>

                    <fieldset class="filter-fields" :disabled="busy">
                        <div class="filter-group">
                            <label class="filter-legend" for="start-location">Starting location</label>
                            <input
                                id="start-location"
                                v-model="startingLocation"
                                type="text"
                                class="form-control search-input"
                                :class="{ 'is-chosen': selectedPlace }"
                                placeholder="Search for a place or address…"
                                autocomplete="off"
                                spellcheck="false"
                                role="combobox"
                                aria-autocomplete="list"
                                :aria-expanded="listOpen ? 'true' : 'false'"
                                :aria-controls="listboxId"
                                :aria-activedescendant="activeId"
                                @input="onLocationInput"
                                @keydown="onLocationKey"
                            >
                            <ul v-show="listOpen" :id="listboxId" class="suggestions" role="listbox" aria-label="Matching places">
                                <li
                                    v-for="(place, i) of suggestions"
                                    :id="`${listboxId}-${i}`"
                                    :key="place.ADDRESS"
                                    class="suggestion"
                                    :class="{ 'is-active': i === activeIndex }"
                                    role="option"
                                    :aria-selected="i === activeIndex ? 'true' : 'false'"
                                    @mousedown.prevent
                                    @click="choosePlace(place)"
                                >
                                    <i class="bi bi-geo-alt-fill" aria-hidden="true"></i>
                                    <span>{{ place.ADDRESS }}</span>
                                </li>
                            </ul>
                            <p class="visually-hidden" aria-live="polite">{{ resultCount }}</p>
                        </div>

                        <div class="filter-group">
                            <label class="filter-legend" for="travel-time">How long do you have?</label>
                            <TimeDial
                                id="travel-time"
                                v-model="travelTime"
                                :min="MIN_TIME"
                                :max="MAX_TIME"
                                :step="5"
                                describedby="travel-time-help"
                            />
                            <ul class="dial-legend" aria-hidden="true">
                                <li><span class="dial-swatch dial-swatch--short"></span>Short <span class="num">&le; 20</span></li>
                                <li><span class="dial-swatch dial-swatch--medium"></span>Medium <span class="num">21&ndash;40</span></li>
                                <li><span class="dial-swatch dial-swatch--long"></span>Long <span class="num">&gt; 40</span></li>
                            </ul>
                            <p id="travel-time-help" class="form-text m-0">Drag the dial or use the arrow keys. Walking to the stop, waiting and the ride all count.</p>
                        </div>

                        <fieldset class="filter-group">
                            <legend class="filter-legend">What are you in the mood for?</legend>
                            <div class="chips">
                                <template v-for="cat of categories" :key="cat">
                                    <input :id="`cat-${cat}`" v-model="preferences" type="checkbox" class="btn-check" :value="cat">
                                    <label class="btn btn-chip" :for="`cat-${cat}`">
                                        <i :class="['bi', categoryInfo(cat).icon, 'chip-icon']" aria-hidden="true"></i>
                                        <i class="bi bi-check-lg chip-check" aria-hidden="true"></i>
                                        {{ categoryInfo(cat).label }}
                                    </label>
                                </template>
                            </div>
                            <p class="form-text mb-0 mt-2">Pick none and any stop can come up.</p>
                        </fieldset>
                    </fieldset>

                    <div class="spin-bar">
                        <button
                            type="button"
                            class="btn btn-wb-primary btn-lg w-100"
                            :disabled="!canSpin"
                            :aria-busy="busy ? 'true' : undefined"
                            :aria-describedby="spinHint ? 'spin-hint' : undefined"
                            data-bs-dismiss="offcanvas"
                            data-bs-target="#filters-sheet"
                            @click="submit()"
                        >
                            {{ spinLabel }}
                        </button>
                        <p v-if="spinHint" id="spin-hint" class="spin-hint">{{ spinHint }}</p>
                    </div>
                </section>
            </div>
        </div>

        <!-- Phones: filters summary and Spin stay in reach at the bottom of the screen -->
        <div class="dock d-lg-none">
            <p v-if="spinHint" id="dock-spin-hint" class="spin-hint dock-hint">{{ spinHint }}</p>
            <div class="dock-row">
                <button type="button" class="dock-filters" data-bs-toggle="offcanvas" data-bs-target="#filters-sheet" aria-controls="filters-sheet">
                    <i class="bi bi-sliders" aria-hidden="true"></i>
                    <span class="dock-text">
                        <span class="dock-label">Filters</span>
                        <span class="dock-summary num">{{ summary }}</span>
                    </span>
                </button>
                <button
                    type="button"
                    class="btn btn-wb-primary btn-lg"
                    :disabled="!canSpin"
                    :aria-busy="busy ? 'true' : undefined"
                    :aria-describedby="spinHint ? 'dock-spin-hint' : undefined"
                    @click="submit()"
                >
                    {{ busy ? 'Spinning…' : hasSpun ? 'Spin again' : 'Spin' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.filters {
  background: var(--wb-surface);
  border-radius: var(--r-card);
  padding: var(--sp-5);
}

.filters-title {
  margin-bottom: 20px;
  font-family: var(--font-ui);
  font-size: var(--fs-lead);
  font-weight: 600;
  color: var(--wb-ink);
}

.filter-fields {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
  border: 0;
}

.filter-group {
  min-width: 0;
  border: 0;
}

.filter-legend {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--sp-2);
  width: 100%;
  float: none;
  margin-bottom: var(--sp-3);
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--wb-ink);
}

.form-text {
  color: var(--wb-muted);
  font-size: var(--fs-small);
}

/* Starting location search (border, radius and focus ring come from main.css) */
.search-input {
  padding: 10px 12px;
}

.search-input.is-chosen {
  border-color: var(--wb-green);
  background: var(--wb-green-tint);
}

/* Suggestions sit in the flow on a tone step: no border, no elevation */
.suggestions {
  list-style: none;
  margin: 6px 0 0;
  padding: var(--sp-1);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}

.suggestion {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 44px;
  padding: var(--sp-2) var(--sp-3);
  border-radius: 8px;
  color: var(--wb-ink);
  font-size: var(--fs-small);
  cursor: pointer;
}

.suggestion .bi {
  flex-shrink: 0;
  color: var(--wb-text-2);
}

.suggestion:hover,
.suggestion.is-active {
  background: var(--wb-surface);
}

.suggestion.is-active {
  outline: 2px solid var(--wb-green);
  outline-offset: -2px;
}

/* Time dial legend: the same bands and colours as the ticket belt */
.dial-legend {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-1) 14px;
  margin: var(--sp-3) 0 var(--sp-2);
  padding: 0;
  font-size: var(--fs-small);
  color: var(--wb-text-2);
}

.dial-legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dial-swatch {
  width: 14px;
  height: 8px;
  border-radius: 3px;
}

.dial-swatch--short { background: var(--wb-green); }
.dial-swatch--medium { background: var(--wb-amber); }
.dial-swatch--long { background: var(--wb-ink); }

/* Category chips: tone at rest; green tint, green text and a check when selected (design.md §4.3) */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.btn-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 6px var(--sp-4);
  border: 0;
  border-radius: var(--r-pill);
  background: var(--wb-surface-2);
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  font-weight: 500;
}

.btn-chip:hover {
  background: var(--wb-line);
  color: var(--wb-ink);
}

.chip-check {
  display: none;
}

.btn-check:checked + .btn-chip {
  background: var(--wb-green-tint);
  color: var(--wb-green);
}

.btn-check:checked + .btn-chip .chip-icon {
  display: none;
}

.btn-check:checked + .btn-chip .chip-check {
  display: inline;
}

.btn-check:focus-visible + .btn-chip {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
  box-shadow:none; /* clears Bootstrap focus glow */
}

/* Spin button, sticky at the bottom of the panel: opaque, separated by space rather than a line */
.spin-bar {
  position: sticky;
  bottom: 0;
  margin: var(--sp-5) calc(-1 * var(--sp-5)) calc(-1 * var(--sp-5));
  padding: var(--sp-3) var(--sp-5) calc(var(--sp-3) + env(safe-area-inset-bottom));
  background: var(--wb-surface);
  border-radius: 0 0 var(--r-card) var(--r-card);
}

.spin-hint {
  margin: var(--sp-2) 0 0;
  color: var(--wb-muted);
  font-size: var(--fs-small);
  text-align: center;
}

@media (min-width: 992px) {
  .filters-sheet-header {
    display: none;
  }

  .filters-sheet {
    position: sticky;
    top: 90px;
  }

  .filters {
    width: 100%;
  }
}

/* Bottom sheet on phones: a floating surface, so it keeps --wb-float */
@media (max-width: 991.98px) {
  .filters-sheet.offcanvas-lg {
    height: auto;
    max-height: 88dvh;
    border: 0;
    border-radius: 20px 20px 0 0;
    background: var(--wb-surface);
    box-shadow: var(--wb-float); /* taste-skill-ignore: the bottom sheet floats over the page */
  }

  .filters-sheet .offcanvas-body {
    padding: 0;
  }

  .filters-sheet .filters {
    border-radius: 0;
  }

  .filters-sheet .spin-bar {
    border-radius: 0;
  }
}

/* Phone dock: opaque and floating (design.md §4.3) */
.dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1030;
  padding: var(--sp-3) var(--sp-4) calc(var(--sp-3) + env(safe-area-inset-bottom));
  background: var(--wb-surface);
  box-shadow: var(--wb-float); /* taste-skill-ignore: the fixed dock floats over the content */
}

.dock-row {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
}

.dock-hint {
  margin: 0 0 var(--sp-2);
}

.dock .btn {
  flex-shrink: 0;
}

.dock-filters {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 52px;
  padding: var(--sp-2) var(--sp-3);
  border: 0;
  border-radius: 14px;
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  text-align: left;
}

.dock-filters:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.dock-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dock-label {
  font-weight: 600;
  font-size: var(--fs-small);
}

.dock-summary {
  font-size: var(--fs-meta);
  color: var(--wb-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
