<script setup>
import { ref, computed } from 'vue'

const challenges = ref([
    {
        id: 1,
        stopId: '64009',
        username: 'Explorer123',
        title: 'Photo Hunt',
        description: 'Take a photo of something red near this bus stop!',
        completed: false
    },
    {
        id: 2,
        stopId: '99999',
        username: 'BusAdventurer',
        title: 'Hidden Gem',
        description: 'Find a café or interesting shop nearby!',
        completed: false
    }
])

const newTitle = ref('')
const newDescription = ref('')
const props = defineProps({
    stopId: {
        type: String,
        required: true
    }
})
const filteredChallenges = computed(() => {
    return challenges.value.filter(
        challenge => challenge.stopId === props.stopId
    )
})

function addChallenge() {
    if (!newTitle.value.trim() || !newDescription.value.trim()) {
        return
    }

    challenges.value.unshift({
        id: Date.now(),
        stopId: props.stopId,
        username: 'You',
        title: newTitle.value.trim(),
        description: newDescription.value.trim(),
        completed: false
    })

    newTitle.value = ''
    newDescription.value = ''
}

</script>

<template>
    <div>
        <h3 class="mb-4">Mini-Challenges</h3>
        <p>Complete challenges left by other explorers!</p>

        <form class="card p-4 mb-4" @submit.prevent="addChallenge">
            <h4>Create a Mini-Challenge</h4>

            <div class="mb-3">
                <label for="challengeTitle" class="form-label">
                    Challenge Title
                </label>

                <input
                    id="challengeTitle"
                    type="text"
                    class="form-control"
                    v-model="newTitle"
                    placeholder="e.g. Photo Hunt"
                    required
                >
            </div>

            <div class="mb-3">
                <label for="challengeDescription" class="form-label">
                    Challenge Description
                </label>

                <textarea
                    id="challengeDescription"
                    class="form-control"
                    v-model="newDescription"
                    placeholder="What should the next explorer do?"
                    rows="3"
                    required
                ></textarea>
            </div>

            <button type="submit" class="btn btn-success">
                Create Challenge
            </button>
        </form>

        <div class="row g-3">
            <div
                v-for="challenge in filteredChallenges"
                :key="challenge.id"
                class="col-12 col-md-6"
            >
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">{{ challenge.title }}</h5>

                        <p class="text-muted">
                            Created by {{ challenge.username }}
                        </p>

                        <p class="card-text">
                            {{ challenge.description }}
                        </p>

                        <button
                            class="btn btn-success"
                            :disabled="challenge.completed"
                            @click="challenge.completed = true"
                        >
                            {{ challenge.completed ? 'Completed ✓' : 'Mark as Completed' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>