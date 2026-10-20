<script setup>
import { ref, onUnmounted, computed } from 'vue'

const logs = ref([
    {
        id: 1,
        stopId: '64009',
        username: 'Explorer123',
        rating: 5,
        note: 'Found a really nice café nearby!'
    },
    {
        id: 2,
        stopId: '99999',
        username: 'BusAdventurer',
        rating: 4,
        note: 'Nice neighbourhood to explore.'
    }
])

const newNote = ref('')
const newRating = ref(0)
const newPhoto = ref(null)
const photoPreview = ref('')
const photoInput = ref(null)
const props = defineProps({
    stopId: {
        type: String,
        required: true
    }
})

const filteredLogs = computed(() => {
    return logs.value.filter(log => log.stopId === props.stopId)
})

function addLog() {
    if (!newNote.value.trim()) return

    if (newRating.value === 0) {
        alert('Please select a rating!')
        return
    }

    logs.value.unshift({
        id: Date.now(),
        stopId: props.stopId,
        username: 'You',
        rating: newRating.value,
        note: newNote.value.trim(),
        photo: photoPreview.value
    })

    newNote.value = ''
    newRating.value = 0

    newPhoto.value = null
    photoPreview.value = ''

    if (photoInput.value) {
        photoInput.value.value = ''
    }
}

function handlePhotoChange(event) {
    const file = event.target.files?.[0]

    if (photoPreview.value) {
        URL.revokeObjectURL(photoPreview.value)
        photoPreview.value = ''
    }

    if (!file) {
        newPhoto.value = null
        return
    }

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.')
        event.target.value = ''
        newPhoto.value = null
        return
    }

    newPhoto.value = file
    photoPreview.value = URL.createObjectURL(file)
}

//helps prevent unused temporary image URLs from remaining in memory
onUnmounted(() => {
    if (photoPreview.value) {
        URL.revokeObjectURL(photoPreview.value)
    }

    logs.value.forEach(log => {
        if (log.photo) {
            URL.revokeObjectURL(log.photo)
        }
    })
})

</script>

<template>
    <div class="container py-5">
        <h3 class="mb-4">Stop Logs</h3>
        <p>Explore what others have shared at this stop!</p>

        <form class="card p-4 mb-4" @submit.prevent="addLog">
            <h4>Share Your Experience</h4>

            <div class="mb-3">
                <label for="note" class="form-label">Your Note</label>
                <textarea
                    id="note"
                    class="form-control"
                    v-model="newNote"
                    placeholder="What did you discover at this stop?"
                    rows="3"
                    required
                ></textarea>
            </div>

            <div class="mb-3">
                <label class="form-label">Your Rating</label>

                <div class="d-flex gap-1">
                    <button
                        v-for="star in 5"
                        :key="star"
                        type="button"
                        class="btn p-0 border-0"
                        :aria-label="`Rate ${star} out of 5 stars`"
                        :aria-pressed="newRating === star"
                        @click="newRating = star"
                    >
                        <span
                            class="rating-star"
                            :class="{ selected: star <= newRating }"
                        >
                            {{ star <= newRating ? '★' : '☆' }}
                        </span>
                    </button>
                </div>

                <small class="text-muted">
                    {{ newRating === 0 ? 'Select a rating' : `${newRating}/5 stars` }}
                </small>
            </div>

            <div class="mb-3">
                <label for="photo" class="form-label">Add a Photo (Optional)</label>
                <input
                    ref="photoInput"
                    id="photo"
                    type="file"
                    class="form-control"
                    accept="image/*"
                    @change="handlePhotoChange"
                >
                <img
                    v-if="photoPreview"
                    :src="photoPreview"
                    alt="Selected photo preview"
                    class="img-fluid rounded mt-3"
                    style="max-height: 250px;"
                >
            </div>

            <button type="submit" class="btn btn-success">Post Log</button>
        </form>


        <div class="row g-3">
        <div v-for="log in filteredLogs" :key="log.id" class="col-12 col-md-6">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">{{ log.username }}</h5>
                    <div>
                        <span
                            v-for="star in 5"
                            :key="star"
                            class="rating-star"
                            :class="{ selected: star <= log.rating }"
                        >
                            {{ star <= log.rating ? '★' : '☆' }}
                        </span>
                    </div>
                    <p class="card-text">{{ log.note }}</p>

                    <img
                        v-if="log.photo"
                        :src="log.photo"
                        alt="Explorer's uploaded photo"
                        class="img-fluid rounded mt-2"
                        style="max-height: 250px;"
                    >
                </div>
            </div>
        </div>
        </div>
    </div>
    
</template>

<style scoped>
.rating-star {
    font-size: 32px;
    color: #aaa;
    transition: color 0.2s, transform 0.2s;
}

button .rating-star {
    cursor: pointer;
}

button .rating-star:hover {
    transform: scale(1.2);
}

.rating-star.selected {
    color: #f5b301;
}
</style>
