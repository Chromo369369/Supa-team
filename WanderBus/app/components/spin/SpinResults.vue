<script setup>
import LedBoard from '~/components/ui/LedBoard.vue';
import SpinTicket from '~/components/ui/SpinTicket.vue';

const props = defineProps({
    submitted: Boolean,
    errorMessage: String,
    chosenStop: [Object, String],
    stopDetails: [Object, String],
    startDetails: [Object, String],
    startingStops: [Object, String],
    preferences: { type: Array, default: () => [] }
})

defineEmits(['reroll'])

const boardLines = computed(() => {
    if (!props.submitted) return ['READY WHEN', 'YOU ARE']
    if (props.errorMessage) return ['NO TRIPS', 'TRY AGAIN']
    if (!props.chosenStop) return ['FINDING YOUR', 'NEXT STOP']
    return [
        props.chosenStop.chosen.bus ? `BUS ${props.chosenStop.chosen.bus}` : 'WALK THERE',
        props.stopDetails.Description.toUpperCase()
    ]
})
</script>

<template>
    <section class="results">
        <LedBoard :line1="boardLines[0]" :line2="boardLines[1]" class="results-board" />

        <div class="results-body">
            <div v-if="!submitted" class="text-center py-5">
                <p class="results-note">Set your filters and submit your preferences. Your ticket will appear here.</p>
            </div>

            <div v-else-if="errorMessage" class="text-center py-5">
                <p class="results-note">{{ errorMessage }}</p>
            </div>

            <div v-else-if="!chosenStop" class="text-center py-5">
                <p class="results-note">Preparing your adventure...</p>
            </div>

            <div v-else class="row g-4 align-items-start">
                <div class="col-12">
                    <SpinTicket
                        :key="chosenStop.destination"
                        icon="🚌"
                        title="Mystery stop"
                        subtitle="A random stop within your travel time"
                        :travel-time="Math.ceil(chosenStop.chosen.totalTime)"
                        :bus="chosenStop.chosen.bus"
                        :board-at="startDetails.Description"
                        :walk="`${Math.round(startingStops[chosenStop.chosen.boardAt] / 12 * 1000)} m walk`"
                        :get-off-at="stopDetails.Description"
                        :area="stopDetails.RoadName"
                        :stops="chosenStop.chosen.stops"
                    />

                    <NuxtLink
                        :to="{ path: `/stop/${chosenStop.destination}`, query: { prefer: preferences.join(',') } }"
                        class="btn btn-explore mt-3"
                    >
                        📍 See places around this stop
                    </NuxtLink>
                </div>

                <div class="col-12">
                    <h2 class="quest-title">Your side quest</h2>
                    <p class="results-note">
                        Your chosen stop is {{ stopDetails.Description }} ({{ chosenStop.destination }}), near {{ stopDetails.RoadName }}.
                    </p>

                    <ol class="quest-steps">
                        <li v-if="chosenStop.chosen.bus">
                            Walk {{ Math.ceil(startingStops[chosenStop.chosen.boardAt]) }} min to {{ startDetails.Description }} ({{ chosenStop.chosen.boardAt }}), {{ startDetails.RoadName }}
                        </li>
                        <li v-else>
                            Walk for {{ Math.ceil(startingStops[chosenStop.chosen.boardAt]) }} min
                        </li>
                        <li v-if="chosenStop.chosen.bus">
                            Take bus {{ chosenStop.chosen.bus }} for {{ chosenStop.chosen.stops }} stops to reach {{ stopDetails.Description }} ({{ chosenStop.destination }}), {{ stopDetails.RoadName }}
                        </li>
                        <li v-else>
                            You have reached {{ chosenStop.destination }}, {{ stopDetails.RoadName }} !!
                        </li>
                    </ol>

                    <p class="quest-time">
                        Total travel time: about {{ Math.ceil(chosenStop.chosen.totalTime) }} min
                    </p>

                    <button class="btn btn-wb-outline mt-3" @click="$emit('reroll')">Spin again</button>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.results {
  background-color: #f9f9fb;
  background-image: radial-gradient(#e3e5ec 1px, transparent 1px);
  background-size: 20px 20px;
  border: 1px solid #e3e5ec;
  border-radius: 16px;
  overflow: hidden;
}

.results .results-board {
  border-radius: 0;
}

.results-body {
  padding: 24px;
}

.results-note {
  color: #4a5068;
}

.quest-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: #141a33;
}

.quest-steps {
  padding-left: 20px;
  margin-top: 16px;
  color: #141a33;
  font-weight: 500;
}

.quest-steps li {
  margin-bottom: 12px;
}

.quest-time {
  background: #fdf3d7;
  color: #7a5200;
  border-radius: 10px;
  padding: 10px 14px;
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
