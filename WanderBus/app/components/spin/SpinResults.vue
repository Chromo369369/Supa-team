<!--
  Spin results: the LED board, one face-down ticket, and (only once the stub is torn) the trip steps,
  what's near the stop and the next actions. Nothing about the bus or destination shows before the tear.
-->
<script setup>
import LedBoard from '~/components/ui/LedBoard.vue';
import SpinTicket from '~/components/ui/SpinTicket.vue';
import SpinSubmit from '~/components/spin/SpinSubmit.vue';
import { categoryInfo } from '~/utils/spinCategories';

const props = defineProps({
    submitted: Boolean,
    saving: Boolean,
    saved: Boolean,
    errorMessage: String,
    chosenStop: [Object, String],
    stopDetails: [Object, String],
    startDetails: [Object, String],
    startingStops: [Object, String],
    preferences: { type: Array, default: () => [] },
    /** /api/allAmenities: { stopCode: { category: [names] } } */
    amenities: { type: Object, default: () => ({}) }
})

defineEmits(['reroll', 'saveTrip'])

const torn = ref(false)
// A new ticket every spin, even if the same stop comes up twice.
const ticketKey = ref(0)
watch(() => props.chosenStop, () => {
    torn.value = false
    ticketKey.value += 1
})

const isDesktop = ref(false)
let desktopQuery = null
const onBreakpoint = (e) => { isDesktop.value = e.matches }
onMounted(() => {
    desktopQuery = window.matchMedia('(min-width: 992px)')
    isDesktop.value = desktopQuery.matches
    desktopQuery.addEventListener('change', onBreakpoint)
})
onBeforeUnmount(() => desktopQuery?.removeEventListener('change', onBreakpoint))

const trip = computed(() => props.chosenStop?.chosen ?? null)
const walkMin = computed(() => (trip.value ? Math.ceil(props.startingStops[trip.value.boardAt]) : 0))
const walkM = computed(() => (trip.value ? Math.round(props.startingStops[trip.value.boardAt] / 12 * 1000) : 0))
const totalMin = computed(() => (trip.value ? Math.ceil(trip.value.totalTime) : 0))
const walkingLink = computed(() => {
    const stop = props.startDetails
    return stop ? `https://www.google.com/maps/dir/?api=1&destination=${stop.Latitude},${stop.Longitude}&travelmode=walking` : ''
})

// Up to 6 named places within 1 km, the user's preferred categories first.
const nearby = computed(() => {
    const byCategory = props.amenities?.[props.chosenStop?.destination] ?? {}
    const order = Object.keys(byCategory).sort((a, b) => props.preferences.includes(b) - props.preferences.includes(a))
    const places = []
    for (const category of order) {
        for (const name of byCategory[category].slice(0, 2)) places.push({ name, category })
    }
    return places.slice(0, 6)
})

// `label` is the plain-text sign; LedBoard announces it only when the state changes, not on every flip.
const board = computed(() => {
    if (!props.submitted) return { badge: '??', label: 'Ready when you are', messages: [['READY WHEN', 'YOU ARE'], ['SOMEWHERE NEW', 'ANY BUS, ANY STOP']] }
    if (props.errorMessage) return { badge: '??', label: 'No trips found', messages: [['NO TRIPS', 'TRY AGAIN']] }
    if (!props.chosenStop) return { badge: '??', label: 'Finding your next stop', messages: [['FINDING YOUR', 'NEXT STOP']] }
    if (!torn.value) return { badge: '??', label: 'Your ticket is ready', messages: [['YOUR TICKET', 'IS READY'], ['TEAR THE STUB', 'TO SEE WHERE']] }
    const destination = props.stopDetails.Description.toUpperCase()
    const road = props.stopDetails.RoadName.toUpperCase()
    // Like the front of a real bus: service number on the left, destination on the right.
    return trip.value.bus
        ? { badge: trip.value.bus, label: `Bus ${trip.value.bus} to ${props.stopDetails.Description}, ${props.stopDetails.RoadName}`, messages: [[destination, road]] }
        : { badge: '>>', label: `Walk to ${props.stopDetails.Description}`, messages: [['WALK TO', destination]] }
})
</script>

<template>
    <section class="results">
        <LedBoard :badge="board.badge" :messages="board.messages" :label="board.label" class="results-board" />

        <div class="results-body">
            <div v-if="!submitted" class="idle">
                <div class="ghost" aria-hidden="true"><i class="bi bi-ticket-perforated"></i></div>
                <p class="results-note">Set your filters and spin. Your ticket shows a ride time; tear it to find out where you’re going.</p>
            </div>

            <div v-else-if="errorMessage" class="idle" role="alert">
                <p class="results-error"><i class="bi bi-exclamation-circle" aria-hidden="true"></i> {{ errorMessage }}</p>
            </div>

            <div v-else-if="!chosenStop" class="idle" aria-live="polite">
                <div class="ghost ghost--loading" aria-hidden="true"><i class="bi bi-bus-front"></i></div>
                <p class="results-note">Checking live buses near you…</p>
            </div>

            <template v-else>
                <p class="reveal-head" aria-live="polite">
                    <template v-if="!torn">Your ticket is ready. Drag the stub to tear it, or focus it and press Enter.</template>
                    <template v-else>Here’s your side quest. Head out, or spin again for a new ticket.</template>
                </p>

                <div class="reveal" :class="{ 'is-torn': torn }">
                    <SpinTicket
                        :key="ticketKey"
                        icon="bi-bus-front"
                        :heading-level="2"
                        title="Mystery stop"
                        subtitle="A random stop within your travel time"
                        :travel-time="totalMin"
                        :bus="trip.bus"
                        :board-at="startDetails.Description"
                        :walk="`${walkM} m walk`"
                        :get-off-at="stopDetails.Description"
                        :area="stopDetails.RoadName"
                        :stops="trip.stops"
                        :orientation="isDesktop ? 'vertical' : 'horizontal'"
                        :resettable="false"
                        @tear="torn = true"
                    />

                    <section v-if="torn" class="preview" aria-labelledby="quest-title">
                        <h2 id="quest-title" class="quest-title">Your side quest</h2>

                        <ol class="legs">
                            <li>
                                <span class="leg-icon" aria-hidden="true"><i class="bi bi-person-walking"></i></span>
                                <div v-if="trip.bus">
                                    <p class="leg">Walk <span class="num">{{ walkM }}</span> m to {{ startDetails.Description }}</p>
                                    <p class="leg-sub">
                                        Stop <span class="num">{{ trip.boardAt }}</span>, {{ startDetails.RoadName }}. About <span class="num">{{ walkMin }}</span> min.
                                        <a :href="walkingLink" target="_blank" rel="noopener noreferrer">Walking directions<span class="visually-hidden"> (opens Google Maps)</span></a>
                                    </p>
                                </div>
                                <div v-else>
                                    <p class="leg">Walk about <span class="num">{{ walkMin }}</span> min</p>
                                    <p class="leg-sub">No bus needed. It’s close enough to walk.</p>
                                </div>
                            </li>
                            <template v-if="trip.bus">
                                <li>
                                    <span class="leg-icon" aria-hidden="true"><i class="bi bi-bus-front"></i></span>
                                    <div><p class="leg">Board bus <span class="num">{{ trip.bus }}</span></p></div>
                                </li>
                                <li>
                                    <span class="leg-icon" aria-hidden="true"><i class="bi bi-arrow-down"></i></span>
                                    <div><p class="leg">Ride <span class="num">{{ trip.stops }}</span> stops</p></div>
                                </li>
                            </template>
                            <li>
                                <span class="leg-icon leg-icon--arrive" aria-hidden="true"><i class="bi bi-flag-fill"></i></span>
                                <div>
                                    <p class="leg">{{ trip.bus ? 'Get off at' : 'Arrive at' }} {{ stopDetails.Description }}</p>
                                    <p class="leg-sub">Stop <span class="num">{{ chosenStop.destination }}</span>, {{ stopDetails.RoadName }}</p>
                                </div>
                            </li>
                        </ol>

                    </section>
                </div>

                <template v-if="torn">
                    <div v-if="nearby.length" class="nearby-block">
                        <h3 class="nearby-title">Within 1 km of the stop</h3>
                        <ul class="nearby">
                            <li v-for="place in nearby" :key="place.name">
                                <i :class="['bi', categoryInfo(place.category).icon]" aria-hidden="true"></i>
                                {{ place.name }}
                                <span class="visually-hidden">({{ categoryInfo(place.category).label }})</span>
                            </li>
                        </ul>
                    </div>

                    <p class="quest-time"><i class="bi bi-stopwatch" aria-hidden="true"></i> Total travel time: about <strong class="num">{{ totalMin }} min</strong></p>

                    <div class="actions">
                        <NuxtLink
                            :to="{ path: `/stop/${chosenStop.destination}`, query: { prefer: preferences.join(',') } }"
                            class="btn btn-wb-primary"
                        >
                            Explore this stop
                        </NuxtLink>
                        <button type="button" class="btn btn-wb-secondary" @click="$emit('reroll')">
                            <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
                            Spin again
                        </button>
                        <SpinSubmit :submitted="true" :saving="saving" :saved="saved" @save-trip="$emit('saveTrip')" />
                    </div>
                </template>
            </template>
        </div>
    </section>
</template>

<style scoped>
/* The stage is one flat surface; no outline, no dotted grid (design.md §1). */
.results {
  background: var(--wb-surface);
  border-radius: var(--r-card);
  overflow: hidden;
}

.results .results-board {
  border-radius: 0;
}

.results-body {
  min-height: 22rem;
  padding: var(--sp-5);
}

@media (min-width: 992px) {
  .results-body {
    min-height: 34rem;
    padding: var(--sp-6);
  }
}

.results-note {
  max-width: 28rem;
  margin: 0;
  color: var(--wb-text-2);
}

.results-error {
  display: inline-flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: 0;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-danger-bg);
  color: var(--wb-danger);
  font-weight: 500;
}

/* Before a spin: a placeholder ticket where the real one will appear (Tier 1 swaps in the parked bus) */
.idle {
  display: grid;
  justify-items: center;
  gap: 20px;
  padding-block: var(--sp-6);
  text-align: center;
}

.ghost {
  display: grid;
  place-items: center;
  width: 96px;
  height: 140px;
  border-radius: 14px;
  background: var(--wb-surface-2);
  color: var(--wb-muted);
  font-size: 1.5rem; /* 24px empty-state icon (design.md §2.6) */
}

/* Searching: a gentle bob, transform and opacity only */
.ghost--loading {
  animation: ghost-bob 1.2s var(--ease) infinite;
}

@keyframes ghost-bob {
  50% { transform: translateY(-8px); opacity: 0.7; }
}

@media (prefers-reduced-motion: reduce) {
  .ghost--loading { animation: none; }
}

.reveal-head {
  margin: 0 0 20px;
  color: var(--wb-text-2);
  text-align: center;
}

/* One ticket centred; once torn it moves left and the trip steps appear beside it */
.reveal {
  display: grid;
  gap: var(--sp-5);
  justify-items: center;
}

@media (min-width: 992px) {
  .reveal.is-torn {
    grid-template-columns: 272px minmax(0, 1fr);
    gap: var(--sp-6);
    align-items: start;
    justify-items: stretch;
  }
}

.preview {
  display: grid;
  gap: var(--sp-4);
  width: 100%;
  animation: preview-in var(--t-reveal) var(--ease);
}

@keyframes preview-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .preview { animation: none; }
}

.quest-title {
  margin: 0;
  font-size: var(--fs-title);
  line-height: 1.1;
  letter-spacing: -0.01em;
}

/* Trip steps joined by a line (the route, not a divider) */
.legs {
  list-style: none;
  display: grid;
  margin: 0;
  padding: 0;
}

.legs li {
  position: relative;
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: var(--sp-3);
  padding-bottom: var(--sp-3);
}

.legs li:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 17px;
  top: 36px;
  bottom: 0;
  width: 2px;
  background: var(--wb-line);
}

.leg-icon {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  font-size: var(--fs-body);
}

.leg-icon--arrive {
  background: var(--wb-ink);
  color: var(--wb-on-ink);
}

.leg {
  margin: 0;
  padding-top: 6px;
  font-weight: 600;
  color: var(--wb-ink);
}

.leg-sub {
  margin: 0;
  font-size: var(--fs-small);
  color: var(--wb-text-2);
}

.leg-sub a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--wb-green);
}

.nearby-block {
  margin-top: var(--sp-5);
}

.nearby-title {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--wb-ink);
}

.nearby {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
}

.nearby li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px var(--sp-3);
  border-radius: var(--r-pill);
  background: var(--wb-surface-2);
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  font-weight: 500;
}

.quest-time {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 20px 0 0;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-amber-tint);
  color: var(--wb-amber-ink);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-3);
  margin-top: 28px;
}
</style>
