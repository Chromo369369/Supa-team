<!--
  Spin filters: starting location, time available and what you're in the mood for.
  A sidebar from the lg breakpoint up; on phones a bottom sheet (Bootstrap offcanvas) opened from a dock
  that keeps a summary and the Spin button in reach. Category chips are real checkboxes (.btn-check).
-->
<script setup>
import { categoryInfo } from '~/utils/spinCategories'

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
    hasSpun: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])

const canSpin = computed(() => !!selectedPlace.value && !!travelTime.value && !props.busy)
const suggestions = computed(() => (startingLocation.value && !selectedPlace.value ? (props.places ?? []).slice(0, 5) : []))
const spinLabel = computed(() => (props.busy ? 'Drawing your ticket…' : props.hasSpun ? 'Spin again' : 'Spin'))

const summary = computed(() => {
    const moods = preferences.value?.length ? preferences.value.map((c) => categoryInfo(c).label).join(', ') : 'Anything'
    return `Up to ${travelTime.value} min, ${moods}`
})

function choosePlace(place) {
    selectedPlace.value = place
    startingLocation.value = place.ADDRESS
}

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
                                placeholder="Search for a place or address"
                                autocomplete="off"
                                @input="selectedPlace = ''"
                            >
                            <ul v-if="suggestions.length" class="suggestions" aria-label="Matching places">
                                <li v-for="place of suggestions" :key="place.ADDRESS">
                                    <button type="button" class="suggestion" @click="choosePlace(place)">{{ place.ADDRESS }}</button>
                                </li>
                            </ul>
                        </div>

                        <div class="filter-group">
                            <label class="filter-legend" for="travel-time">
                                How long do you have? <span class="filter-value">up to {{ travelTime }} min</span>
                            </label>
                            <input
                                id="travel-time"
                                v-model.number="travelTime"
                                type="range"
                                class="form-range"
                                min="10"
                                max="120"
                                step="5"
                            >
                            <p class="form-text m-0">Walking to the stop, waiting and the ride all count.</p>
                        </div>

                        <fieldset class="filter-group">
                            <legend class="filter-legend">What are you in the mood for?</legend>
                            <div class="chips">
                                <template v-for="cat of categories" :key="cat">
                                    <input :id="`cat-${cat}`" v-model="preferences" type="checkbox" class="btn-check" :value="cat">
                                    <label class="btn btn-chip" :for="`cat-${cat}`">{{ categoryInfo(cat).label }}</label>
                                </template>
                            </div>
                            <p class="form-text mb-0 mt-2">Pick none for any stop at all.</p>
                        </fieldset>
                    </fieldset>

                    <div class="spin-bar">
                        <button
                            type="button"
                            class="btn btn-wb-green btn-lg w-100"
                            :disabled="!canSpin"
                            data-bs-dismiss="offcanvas"
                            data-bs-target="#filters-sheet"
                            @click="submit()"
                        >
                            {{ spinLabel }}
                        </button>
                    </div>
                </section>
            </div>
        </div>

        <!-- Phones: filters summary and Spin stay in reach at the bottom of the screen -->
        <div class="dock d-lg-none">
            <button type="button" class="dock-filters" data-bs-toggle="offcanvas" data-bs-target="#filters-sheet" aria-controls="filters-sheet">
                <span class="dock-text">
                    <span class="dock-label">Filters</span>
                    <span class="dock-summary">{{ summary }}</span>
                </span>
            </button>
            <button type="button" class="btn btn-wb-green btn-lg" :disabled="!canSpin" @click="submit()">
                {{ busy ? '…' : hasSpun ? 'Spin again' : 'Spin' }}
            </button>
        </div>
    </div>
</template>

<style scoped>
.filters {
  background: #fff;
  border: 1px solid #e3e5ec;
  border-radius: 16px;
  padding: 24px;
}

.filters-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #141a33;
  margin-bottom: 20px;
}

.filter-fields {
  display: grid;
  gap: 24px;
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
  gap: 8px;
  width: 100%;
  float: none;
  font-size: 1rem;
  font-weight: 700;
  color: #141a33;
  margin-bottom: 12px;
}

.filter-value {
  font-weight: 600;
  font-size: 0.9rem;
  color: #0b7a4b;
  white-space: nowrap;
}

/* Starting location search */
.search-input {
  padding: 10px 12px;
  border: 1px solid #c9ccd6;
  border-radius: 12px;
}

.search-input:focus {
  border-color: #0b7a4b;
  box-shadow: 0 0 0 3px rgba(11, 122, 75, 0.2);
}

.search-input.is-chosen {
  border-color: #0b7a4b;
  background: #f1f8f4;
}

.suggestions {
  list-style: none;
  margin-top: 6px;
  border: 1px solid #e3e5ec;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 8px 24px rgba(20, 26, 51, 0.08);
}

.suggestion {
  display: block;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid #f1f2f6;
  background: #fff;
  color: #141a33;
  font-size: 0.875rem;
  text-align: left;
}

.suggestions li:last-child .suggestion {
  border-bottom: 0;
}

.suggestion:hover,
.suggestion:focus-visible {
  background: #f1f8f4;
}

/* Range */
.form-range::-webkit-slider-thumb {
  background: #0b7a4b;
}

.form-range::-moz-range-thumb {
  background: #0b7a4b;
}

.form-range:focus::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgba(11, 122, 75, 0.25);
}

/* Category chips */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 6px 14px;
  border: 1px solid #c9ccd6;
  border-radius: 50px;
  background: #fff;
  color: #141a33;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-chip:hover {
  background: #f1f2f6;
  border-color: #c9ccd6;
  color: #141a33;
}

.btn-check:checked + .btn-chip {
  background: #e3f2ea;
  border-color: #0b7a4b;
  color: #0b7a4b;
}

.btn-check:focus-visible + .btn-chip {
  box-shadow: 0 0 0 3px rgba(11, 122, 75, 0.25);
}

/* Spin button, sticky at the bottom of the panel */
.spin-bar {
  position: sticky;
  bottom: 0;
  margin: 24px -24px -24px;
  padding: 12px 24px calc(12px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(8px);
  border-top: 1px solid #e3e5ec;
  border-radius: 0 0 16px 16px;
}

.btn-wb-green {
  background: #0b7a4b;
  color: #fff;
  border-radius: 50px;
  font-weight: 700;
}

.btn-wb-green:hover {
  background: #096640;
  color: #fff;
}

.btn-wb-green:disabled {
  background: #9cc9b5;
  border-color: #9cc9b5;
  color: #fff;
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

/* Bottom sheet on phones */
@media (max-width: 991.98px) {
  .filters-sheet.offcanvas-lg {
    height: auto;
    max-height: 88vh;
    border-radius: 20px 20px 0 0;
  }

  .filters-sheet-header {
    border-bottom: 1px solid #e3e5ec;
  }

  .filters-sheet .offcanvas-body {
    padding: 0;
  }

  .filters-sheet .filters {
    border: 0;
    border-radius: 0;
  }

  .filters-sheet .spin-bar {
    border-radius: 0;
  }
}

/* Phone dock */
.dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1030;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
  border-top: 1px solid #e3e5ec;
  box-shadow: 0 -8px 24px -16px rgba(20, 26, 51, 0.35);
}

.dock .btn {
  flex-shrink: 0;
}

.dock-filters {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 8px 12px;
  border: 1px solid #c9ccd6;
  border-radius: 14px;
  background: #fff;
  color: #141a33;
  text-align: left;
}

.dock-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dock-label {
  font-weight: 700;
  font-size: 0.875rem;
}

.dock-summary {
  font-size: 0.75rem;
  color: #6b7085;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
