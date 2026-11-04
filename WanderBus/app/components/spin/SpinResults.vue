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

const board = computed(() => {
    if (!props.submitted) return { badge: '??', messages: [['READY WHEN', 'YOU ARE'], ['SOMEWHERE NEW', 'ANY BUS, ANY STOP']] }
    if (props.errorMessage) return { badge: '??', messages: [['NO TRIPS', 'TRY AGAIN']] }
    if (!props.chosenStop) return { badge: '??', messages: [['FINDING YOUR', 'NEXT STOP']] }
    if (!torn.value) return { badge: '??', messages: [['YOUR TICKET', 'IS READY'], ['TEAR THE STUB', 'TO SEE WHERE']] }
    const destination = props.stopDetails.Description.toUpperCase()
    const road = props.stopDetails.RoadName.toUpperCase()
    // Like the front of a real bus: service number on the left, destination on the right.
    return trip.value.bus
        ? { badge: trip.value.bus, messages: [[destination, road]] }
        : { badge: '>>', messages: [['WALK TO', destination]] }
})
</script>

<template>
    <section class="results">
        <LedBoard :badge="board.badge" :messages="board.messages" class="results-board" />

        <div class="results-body">
            <div v-if="!submitted" class="idle">
                <div class="ghost" aria-hidden="true"></div>
                <p class="results-note">Set your filters and spin. Your ticket shows a ride time; tear it to find out where you're going.</p>
            </div>

            <div v-else-if="errorMessage" class="idle" role="alert">
                <p class="results-error">{{ errorMessage }}</p>
            </div>

            <div v-else-if="!chosenStop" class="idle" aria-live="polite">
                <div class="ghost ghost--loading" aria-hidden="true"></div>
                <p class="results-note">Checking live buses near you…</p>
            </div>

            <template v-else>
                <p class="reveal-head" aria-live="polite">
                    <template v-if="!torn">Your ticket is ready. Drag the stub to tear it, or focus it and press Enter.</template>
                    <template v-else>Here's your side quest. Head out, or spin again for a new ticket.</template>
                </p>

                <div class="reveal" :class="{ 'is-torn': torn }">
                    <SpinTicket
                        :key="ticketKey"
                        icon="🚌"
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
                                <span class="leg-icon" aria-hidden="true">🚶</span>
                                <div v-if="trip.bus">
                                    <p class="leg">Walk {{ walkM }} m to {{ startDetails.Description }}</p>
                                    <p class="leg-sub">
                                        Stop {{ trip.boardAt }}, {{ startDetails.RoadName }}. About {{ walkMin }} min.
                                        <a :href="walkingLink" target="_blank" rel="noopener noreferrer">Walking directions<span class="visually-hidden"> (opens Google Maps)</span></a>
                                    </p>
                                </div>
                                <div v-else>
                                    <p class="leg">Walk about {{ walkMin }} min</p>
                                    <p class="leg-sub">No bus needed, this one is close by.</p>
                                </div>
                            </li>
                            <template v-if="trip.bus">
                                <li>
                                    <span class="leg-icon" aria-hidden="true">🚌</span>
                                    <div><p class="leg">Board bus {{ trip.bus }}</p></div>
                                </li>
                                <li>
                                    <span class="leg-icon" aria-hidden="true">🛣️</span>
                                    <div><p class="leg">Ride {{ trip.stops }} stops</p></div>
                                </li>
                            </template>
                            <li>
                                <span class="leg-icon" aria-hidden="true">🏁</span>
                                <div>
                                    <p class="leg">{{ trip.bus ? 'Get off at' : 'Arrive at' }} {{ stopDetails.Description }}</p>
                                    <p class="leg-sub">Stop {{ chosenStop.destination }}, {{ stopDetails.RoadName }}</p>
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
                                <span aria-hidden="true">{{ categoryInfo(place.category).emoji }}</span>
                                {{ place.name }}
                                <span class="visually-hidden">({{ categoryInfo(place.category).label }})</span>
                            </li>
                        </ul>
                    </div>

                    <p class="quest-time">Total travel time: about <strong>{{ totalMin }} min</strong></p>

                    <div class="actions">
                        <NuxtLink
                            :to="{ path: `/stop/${chosenStop.destination}`, query: { prefer: preferences.join(',') } }"
                            class="btn btn-explore"
                        >
                            Explore places around this stop
                        </NuxtLink>
                        <button type="button" class="btn btn-wb-outline" @click="$emit('reroll')">Spin again</button>
                        <SpinSubmit :submitted="true" @save-trip="$emit('saveTrip')" />
                    </div>
                </template>
            </template>
        </div>
    </section>
</template>

<style scoped>
.results {
  background: #fff;
  border: 1px solid #e3e5ec;
  border-radius: 16px;
  overflow: hidden;
}

.results .results-board {
  border-radius: 0;
}

.results-body {
  min-height: 22rem;
  padding: 24px;
  background-color: #f9f9fb;
  background-image: radial-gradient(#e3e5ec 1px, transparent 1px);
  background-size: 22px 22px;
}

@media (min-width: 992px) {
  .results-body {
    min-height: 34rem;
    padding: 32px;
  }
}

.results-note {
  max-width: 28rem;
  color: #4a5068;
}

.results-error {
  color: #b42318;
  font-weight: 600;
}

/* Before a spin: a dashed outline where the ticket will appear */
.idle {
  display: grid;
  justify-items: center;
  gap: 20px;
  padding-block: 32px;
  text-align: center;
}

.ghost {
  width: 96px;
  height: 140px;
  border: 2px dashed #c9ccd6;
  border-radius: 14px;
  background: linear-gradient(180deg, transparent 72%, #e3e5ec 72% 73%, transparent 73%);
}

.ghost--loading {
  animation: ghost-bob 1.2s ease-in-out infinite;
}

@keyframes ghost-bob {
  50% { transform: translateY(-8px); border-color: #0b7a4b; }
}

@media (prefers-reduced-motion: reduce) {
  .ghost--loading { animation: none; }
}

.reveal-head {
  margin-bottom: 20px;
  color: #4a5068;
  text-align: center;
}

/* One ticket centred; once torn it moves left and the trip steps appear beside it */
.reveal {
  display: grid;
  gap: 24px;
  justify-items: center;
}

@media (min-width: 992px) {
  .reveal.is-torn {
    grid-template-columns: 272px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
    justify-items: stretch;
  }
}

.preview {
  display: grid;
  gap: 16px;
  width: 100%;
  animation: preview-in 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes preview-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}

.quest-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: #141a33;
}

/* Trip steps joined by a line */
.legs {
  list-style: none;
  display: grid;
}

.legs li {
  position: relative;
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 12px;
  padding-bottom: 12px;
}

.legs li:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 17px;
  top: 36px;
  bottom: 0;
  width: 2px;
  background: #c9ccd6;
}

.leg-icon {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid #e3e5ec;
  border-radius: 50%;
  background: #fff;
  font-size: 1rem;
}

.leg {
  padding-top: 6px;
  font-weight: 700;
  color: #141a33;
}

.leg-sub {
  font-size: 0.875rem;
  color: #4a5068;
}

.leg-sub a {
  color: #0b7a4b;
}

.nearby-block {
  margin-top: 24px;
}

.nearby-title {
  margin-bottom: 8px;
  font-size: 0.875rem;
  font-weight: 700;
  color: #4a5068;
}

.nearby {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.nearby li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 50px;
  background: #e3f2ea;
  color: #141a33;
  font-size: 0.875rem;
  font-weight: 600;
}

.quest-time {
  margin-top: 20px;
  background: #fdf3d7;
  color: #7a5200;
  border-radius: 10px;
  padding: 12px 16px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
}

.btn-wb-outline {
  background: #fff;
  border: 1px solid #c9ccd6;
  color: #141a33;
  border-radius: 50px;
  padding: 12px 28px;
  font-weight: 600;
}

.btn-wb-outline:hover {
  background: #f1f2f6;
}

.btn-explore {
  background: #0b7a4b;
  color: #fff;
  border-radius: 50px;
  padding: 12px 28px;
  font-weight: 600;
}

.btn-explore:hover {
  background: #096640;
  color: #fff;
}
</style>
