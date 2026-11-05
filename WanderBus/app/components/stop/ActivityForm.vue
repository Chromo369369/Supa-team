<script setup>
// leave a signpost / set a challenge (feature 3). The pin is already on the map, this fills in the rest
const props = defineProps({
    kind: String,       // 'signpost' | 'challenge'
    draft: Object,      // { lat, lon } of the pin, dragging it on the map updates this
    stop: Object,
    existing: Object,   // the signpost/challenge being edited, or null for a new one
    saving: Boolean,
    error: { type: String, default: '' }   // why the last save failed, shown above the buttons
})

// place-at-stop = put the pin back on the stop's own spot (the page moves the draft)
const emit = defineEmits(['save', 'cancel', 'place-at-stop'])
const { confirm } = useConfirm()

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
let firstStar = null   // the first radio, focused when the rating is missing

// what the form started as, so Cancel only asks when something was actually changed
const startingForm = JSON.stringify(form)
const changed = computed(() => JSON.stringify(form) !== startingForm || photo.value !== null)

const formId = computed(() => `${props.kind}-form`)
const formEl = ref(null)
const atStop = computed(() => distance.value === 0)

// Enter on the draft pin confirms where it goes, and the page sends focus here to fill in the rest
function focusFirst() {
    formEl.value?.querySelector('textarea, input[type="text"]')?.focus()
}

defineExpose({ focusFirst })

function submit() {
    if (props.kind == 'signpost' && form.rating == 0) {
        ratingMissing.value = true
        firstStar?.focus()
        return
    }
    emit('save', { ...form, lat: props.draft.lat, lon: props.draft.lon }, photo.value)
}

async function cancel() {
    if (changed.value) {
        const discard = await confirm({
            title: 'Discard your changes?',
            body: `Your ${style.value.label.toLowerCase()} hasn’t been saved yet.`,
            confirmLabel: 'Discard changes',
            cancelLabel: 'Keep editing'
        })
        if (!discard) return
    }
    emit('cancel')
}
</script>

<template>
    <form ref="formEl" class="activity-form" :aria-labelledby="`${formId}-title`" @submit.prevent="submit">
        <h3 :id="`${formId}-title`" class="form-title">
            <span class="form-icon" :style="{ background: style.colour, color: style.glyph }"><i class="bi" :class="style.icon" aria-hidden="true"></i></span>
            {{ existing ? 'Edit your' : kind == 'signpost' ? 'Leave a' : 'Set a' }} {{ style.label.toLowerCase() }}
        </h3>
        <div class="pin-row">
            <p class="pin-note">
                <i class="bi bi-geo-alt-fill" aria-hidden="true"></i>
                Your pin is <span class="num">{{ distance }} m</span> from the stop. Drag it on the map, or focus it and use the arrow keys, to move it.
            </p>
            <button type="button" class="btn-wb-ghost btn-sm pin-reset" :disabled="saving || atStop" @click="emit('place-at-stop')">
                <i class="bi bi-bus-front" aria-hidden="true"></i> Place at the stop
            </button>
        </div>

        <template v-if="kind == 'signpost'">
            <label for="signpostNote" class="form-label">Your note</label>
            <textarea id="signpostNote" v-model.trim="form.note" class="form-control mb-3" rows="3" minlength="3" maxlength="280" required
                placeholder="What did you find near this stop?"></textarea>

            <fieldset class="rating-field" aria-describedby="signpostRatingHelp">
                <legend class="form-label">Your rating</legend>
                <div class="rating-stars">
                    <template v-for="star in 5" :key="star">
                        <input
                            :id="`signpostRating${star}`"
                            :ref="el => { if (star === 1) firstStar = el }"
                            v-model="form.rating"
                            type="radio"
                            name="signpostRating"
                            class="rating-input visually-hidden"
                            :value="star"
                            :aria-invalid="ratingMissing ? 'true' : undefined"
                            @change="ratingMissing = false"
                        />
                        <label :for="`signpostRating${star}`" class="star-label" :class="{ filled: star <= form.rating }">
                            <i class="bi" :class="star <= form.rating ? 'bi-star-fill' : 'bi-star'" aria-hidden="true"></i>
                            <span class="visually-hidden">{{ star }} out of 5</span>
                        </label>
                    </template>
                </div>
                <p id="signpostRatingHelp" :class="ratingMissing ? 'wb-field-error' : 'rating-help'" :role="ratingMissing ? 'alert' : undefined">
                    <template v-if="form.rating == 0">{{ ratingMissing ? 'Pick a rating before you post.' : 'Pick a rating' }}</template>
                    <span v-else class="num">{{ form.rating }}/5 stars</span>
                </p>
            </fieldset>

            <div class="row g-2 mt-2 mb-3">
                <div class="col-sm-5">
                    <label for="signpostSpent" class="form-label">Amount spent (optional)</label>
                    <div class="input-group">
                        <span class="input-group-text">S$</span>
                        <input id="signpostSpent" v-model="form.spent" type="number" inputmode="decimal" min="0" max="500" step="0.5" class="form-control num" />
                    </div>
                </div>
                <div class="col-sm-7">
                    <label for="signpostPhoto" class="form-label">{{ existing && existing.photo_path ? 'Replace photo (optional)' : 'Add a photo (optional)' }}</label>
                    <input id="signpostPhoto" type="file" accept="image/*" class="form-control" @change="event => photo = event.target.files[0] || null" />
                </div>
            </div>
        </template>

        <template v-else>
            <label for="challengeTitle" class="form-label">Challenge title</label>
            <input id="challengeTitle" v-model.trim="form.title" type="text" class="form-control mb-3" minlength="3" maxlength="80" required
                placeholder="e.g. Photo hunt" />

            <label for="challengeDescription" class="form-label">Challenge description</label>
            <textarea id="challengeDescription" v-model.trim="form.description" class="form-control mb-3" rows="3" minlength="3" maxlength="280" required
                placeholder="What should the next explorer do?"></textarea>

            <label for="challengeHint" class="form-label">Hint (optional)</label>
            <input id="challengeHint" v-model.trim="form.hint" type="text" class="form-control mb-3" maxlength="120"
                placeholder="e.g. Look near the corner coffee shop" />
        </template>

        <p v-if="error" class="form-error" role="alert">
            <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
            Couldn’t save your {{ style.label.toLowerCase() }}. {{ error }}
        </p>

        <div class="form-buttons">
            <button type="submit" class="btn-wb-primary" :disabled="saving" :aria-busy="saving ? 'true' : undefined">
                {{ saving ? 'Saving…' : existing ? 'Save changes' : `Post ${style.label.toLowerCase()}` }}
            </button>
            <button type="button" class="btn-wb-secondary" :disabled="saving" @click="cancel">Cancel</button>
        </div>
    </form>
</template>

<style scoped>
.activity-form {
  flex-shrink: 0;
  background: var(--wb-surface-2);
  border-radius: var(--r-card);
  padding: var(--sp-5);
  animation: form-in var(--t-ui) var(--ease) both;
}

/* the pin has landed, the form slides in beside it */
@keyframes form-in {
  from { opacity: 0; transform: translateY(12px); }
}

.form-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-family: var(--font-ui);
  font-size: var(--fs-lead);
  font-weight: 600;
  color: var(--wb-ink);
  margin: 0 0 var(--sp-2);
}

.form-icon {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: calc(var(--r-control) - 4px);
  font-size: var(--fs-body);
  flex-shrink: 0;
}

.pin-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-1) var(--sp-3);
  margin: 0 0 var(--sp-4);
}

.pin-note {
  flex: 1 1 220px;
  font-size: var(--fs-small);
  color: var(--wb-text-2);
  margin: 0;
}

.pin-reset {
  flex-shrink: 0;
}

.form-label {
  font-weight: 500;
}

/* bootstrap's reboot gives legends a big font and a float */
.rating-field legend {
  float: none;
  font-size: var(--fs-body);
  margin-bottom: var(--sp-1);
}

.rating-stars {
  display: flex;
  gap: 0;
}

/* each star is a 44px radio target */
.star-label {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r-control);
  font-size: var(--fs-lead);
  color: var(--wb-control);
  cursor: pointer;
}

.star-label:hover {
  background: var(--wb-surface);
}

.star-label.filled {
  color: var(--wb-amber);
}

.rating-input:focus-visible + .star-label {
  outline: 3px solid var(--wb-green);
  outline-offset: -3px;
}

.rating-help {
  font-size: var(--fs-small);
  color: var(--wb-text-2);
  margin: var(--sp-1) 0 0;
}

.form-error {
  background: var(--wb-danger-bg);
  color: var(--wb-danger);
  border-radius: var(--r-control);
  padding: var(--sp-3) var(--sp-4);
  font-size: var(--fs-small);
  margin: 0 0 var(--sp-3);
}

.form-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
</style>
