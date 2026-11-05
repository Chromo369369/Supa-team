<script setup>
import { ref, computed, watch } from 'vue'

// 1. Define props first
const props = defineProps({
    stopId: {
        type: String,
        required: true
    }
})

// 2. Your existing sample data
const challenges = ref([])

const newTitle = ref('')
const newDescription = ref('')

// 3. Supabase connection
const { $supabase } = useNuxtApp()

// 4. Fetch challenges
async function fetchChallenges() {
    // Get challenges for the current bus stop
    const { data: challengeData, error: challengeError } = await $supabase
        .from('challenges')
        .select('*')
        .eq('stop_id', props.stopId)
        .order('created_at', { ascending: false })

    if (challengeError) {
        console.error('Error fetching challenges:', challengeError.message)
        return
    }

    // Get the currently logged-in user
    const { data: { user }, error: userError } =
        await $supabase.auth.getUser()

    if (userError) {
        console.error('Error getting user:', userError.message)
        return
    }

    // Find which challenges this user has completed
    let completedIds = []

    if (user) {
        const { data: completionData, error: completionError } =
            await $supabase
                .from('challenge_completions')
                .select('challenge_id')
                .eq('user_id', user.id)

        if (completionError) {
            console.error('Error fetching completions:', completionError.message)
            return
        }

        completedIds = completionData.map(item => item.challenge_id)
    }

    // Combine challenges with the user's completion status
    challenges.value = challengeData.map(challenge => ({
        id: challenge.id,
        stopId: challenge.stop_id,
        username: 'User',
        title: challenge.title,
        description: challenge.description,
        completed: completedIds.includes(challenge.id)
    }))
}

// 5. Watch for changes in the bus stop
watch(
    () => props.stopId,
    () => {
        fetchChallenges()
    },
    { immediate: true }
)

const filteredChallenges = computed(() => {
    return challenges.value.filter(
        challenge => challenge.stopId === props.stopId
    )
})

async function addChallenge() {
    if (!newTitle.value.trim() || !newDescription.value.trim()) {
        return
    }

    // Get the currently logged-in user
    const { data: { user }, error: userError } =
        await $supabase.auth.getUser()

    if (userError || !user) {
        alert('Please log in to create a challenge!')
        return
    }

    // Save challenge to Supabase
    const { error } = await $supabase
        .from('challenges')
        .insert({
            user_id: user.id,
            stop_id: props.stopId,
            title: newTitle.value.trim(),
            description: newDescription.value.trim()
        })

    if (error) {
        console.error('Error creating challenge:', error.message)
        alert('Failed to create challenge!')
        return
    }

    // Refresh the challenges list
    await fetchChallenges()

    // Clear the form
    newTitle.value = ''
    newDescription.value = ''

    alert('Challenge created successfully!')
}

async function completeChallenge(challenge) {
    // Get the logged-in user
    const { data: { user }, error: userError } =
        await $supabase.auth.getUser()

    if (userError || !user) {
        alert('Please log in to complete challenges!')
        return
    }

    // Save completion to Supabase
    const { error } = await $supabase
        .from('challenge_completions')
        .insert({
            challenge_id: challenge.id,
            user_id: user.id
        })

    if (error) {
        console.error('Error completing challenge:', error.message)
        alert('Failed to complete challenge!')
        return
    }

    // Update the button
    challenge.completed = true

    alert('Challenge completed!')
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
                            @click="completeChallenge(challenge)"
                        >
                            {{ challenge.completed ? 'Completed ✓' : 'Mark as Completed' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>