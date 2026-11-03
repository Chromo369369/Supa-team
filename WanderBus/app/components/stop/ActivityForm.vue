<script setup>
// leave a signpost / set a challenge (feature 3). The pin is already on the map, this fills in the rest
const props = defineProps({
    kind: String,       // 'signpost' | 'challenge'
    draft: Object,      // { lat, lon } of the pin, dragging it on the map updates this
    stop: Object,
    existing: Object,   // the signpost/challenge being edited, or null for a new one
    saving: Boolean
})

const emit = defineEmits(['save', 'cancel'])

const style = computed(() => activityStyles[props.kind])
const distance = computed(() => Math.round(distanceInMetres(props.stop.lat, props.stop.lon, props.draft.lat, props.draft.lon)))

const form = reactive({
    note: props.existing ? props.existing.note : '',
    rating: props.existing ? props.existing.rating : 0,
    spent: props.existing && props.existing.spent !== null ? Number(props.existing.spent) : '',
    title: props.existing ? props.existing.title : '',
    description: props.existing ? props.existing.description : '',
    hint: props.existing && props.existing.hint ? props.existing.hint : ''
})
const photo = ref(null)
const ratingMissing = ref(false)

function submit() {
    if (props.kind == 'signpost' && form.rating == 0) {
        ratingMissing.value = true
        return
    }
    emit('save', { ...form, lat: props.draft.lat, lon: props.draft.lon }, photo.value)
}
</script>

<template>
    <form class="activity-form" :style="{ '--accent': style.colour }" @submit.prevent="submit">
        <h3 class="form-title">{{ style.icon }} {{ existing ? 'Edit your' : kind == 'signpost' ? 'Leave a' : 'Set a' }} {{ style.label.toLowerCase() }}</h3>
        <p class="pin-note">📍 Pin placed {{ distance }} m from the stop. Drag it on the map to adjust.</p>

        <template v-if="kind == 'signpost'">
            <label for="signpostNote" class="form-label">Your note</label>
            <textarea id="signpostNote" v-model.trim="form.note" class="form-control mb-3" rows="3" minlength="3" maxlength="280" required
                placeholder="What did you discover at this stop?"></textarea>

            <label class="form-label d-block">Your rating</label>
            <div class="d-flex gap-1">
                <button v-for="star in 5" :key="star" type="button" class="star-btn" :class="{ filled: star <= form.rating }"
                    :aria-label="`Rate ${star} out of 5 stars`" :aria-pressed="form.rating === star" @click="form.rating = star; ratingMissing = false">
                    {{ star <= form.rating ? '★' : '☆' }}
                </button>
            </div>
            <small :class="ratingMissing ? 'text-danger' : 'text-muted'">{{ form.rating == 0 ? 'Select a rating' : `${form.rating}/5 stars` }}</small>

            <div class="row g-2 mt-2 mb-3">
                <div class="col-sm-5">
                    <label for="signpostSpent" class="form-label">Spent (optional)</label>
                    <div class="input-group">
                        <span class="input-group-text">S$</span>
                        <input id="signpostSpent" v-model="form.spent" type="number" min="0" max="500" step="0.5" class="form-control" />
                    </div>
                </div>
                <div class="col-sm-7">
                    <label for="signpostPhoto" class="form-label">{{ existing && existing.photo_path ? 'Replace photo (optional)' : 'Add a photo (optional)' }}</label>
                    <input id="signpostPhoto" type="file" accept="image/*" class="form-control" @change="event => photo = event.target.files[0]" />
                </div>
            </div>
        </template>

        <template v-else>
            <label for="challengeTitle" class="form-label">Challenge title</label>
            <input id="challengeTitle" v-model.trim="form.title" type="text" class="form-control mb-3" minlength="3" maxlength="80" required
                placeholder="e.g. Photo Hunt" />

            <label for="challengeDescription" class="form-label">Challenge description</label>
            <textarea id="challengeDescription" v-model.trim="form.description" class="form-control mb-3" rows="3" minlength="3" maxlength="280" required
                placeholder="What should the next explorer do?"></textarea>

            <label for="challengeHint" class="form-label">Hint (optional)</label>
            <input id="challengeHint" v-model.trim="form.hint" type="text" class="form-control mb-3" maxlength="120"
                placeholder="e.g. Look near the corner coffee shop" />
        </template>

        <div class="d-flex gap-2">
            <button type="submit" class="btn-save" :disabled="saving">{{ saving ? 'Saving...' : existing ? 'Save changes' : 'Post it' }}</button>
            <button type="button" class="btn-cancel" :disabled="saving" @click="$emit('cancel')">Cancel</button>
        </div>
    </form>
</template>

<style scoped>
.activity-form {
  flex-shrink: 0;
  background: #fff;
  border: 2px solid var(--accent);
  border-radius: 14px;
  padding: 16px;
}

.form-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: #141a33;
  margin-bottom: 4px;
}

.pin-note {
  font-size: 0.85rem;
  color: #4a5068;
  margin-bottom: 12px;
}

.star-btn {
  background: none;
  border: none;
  padding: 0 2px;
  font-size: 1.5rem;
  line-height: 1;
  color: #c9ccd6;
}

.star-btn.filled {
  color: #f5a623;
}

.btn-save {
  background: #141a33;
  border: none;
  color: #fff;
  border-radius: 50px;
  padding: 8px 20px;
  font-weight: 600;
}

.btn-cancel {
  background: #fff;
  border: 1px solid #c9ccd6;
  color: #141a33;
  border-radius: 50px;
  padding: 8px 20px;
  font-weight: 600;
}

.btn-save:disabled,
.btn-cancel:disabled {
  opacity: 0.6;
}
</style>
