<script setup>
// a signpost or a challenge (feature 3). Same header for both, the body depends on activity.kind
const props = defineProps({
    activity: Object,
    selected: Boolean,
    busy: Boolean      // saving a vote / completion right now
})

const emit = defineEmits(['select', 'edit', 'delete', 'helpful', 'complete'])

const style = computed(() => activityStyles[props.activity.kind])
const noun = computed(() => style.value.label.toLowerCase())   // 'signpost' | 'challenge'
const fileInput = ref(null)

const author = computed(() => props.activity.isMine ? 'You' : props.activity.author_name)
const posted = computed(() => new Date(props.activity.created_at).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }))

// the heading is the button that picks the pin: a challenge's title, or whose signpost it is
const heading = computed(() => {
    if (props.activity.kind == 'challenge') return props.activity.title
    return props.activity.isMine ? 'Your signpost' : `${props.activity.author_name}’s signpost`
})

const avatarColour = computed(() => userColor(props.activity.author_name))

const money = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' })

function onProofPicked(event) {
    if (event.target.files[0]) emit('complete', props.activity, event.target.files[0])
    event.target.value = ''
}
</script>

<template>
    <!-- the card itself isn't clickable: the heading is the button that picks the pin, the other controls sit beside it -->
    <article :id="`place-${activity.key}`" class="activity-card" :class="{ 'is-selected': selected }">
        <header class="activity-head">
            <span class="avatar" :style="{ background: avatarColour }" aria-hidden="true">{{ activity.author_name.charAt(0).toUpperCase() }}</span>
            <div class="head-text">
                <span class="activity-kind" :style="{ background: style.tint, color: style.text }">
                    <i class="bi" :class="style.icon" aria-hidden="true"></i> {{ style.label }}
                </span>
                <h3 class="activity-title">
                    <button type="button" class="title-btn" :aria-current="selected ? 'true' : undefined" @click="emit('select', activity.key)">
                        {{ heading }}
                    </button>
                </h3>
                <p class="activity-meta">
                    <template v-if="activity.kind == 'challenge'">Set by {{ activity.isMine ? 'you' : author }} · </template>{{ posted }} · <span class="num">{{ activity.distanceM }} m</span> from the stop
                </p>
            </div>
        </header>

        <template v-if="activity.kind == 'signpost'">
            <p class="stars">
                <span role="img" :aria-label="`${activity.rating} out of 5`">
                    <i v-for="star in 5" :key="star" class="bi" :class="star <= activity.rating ? 'bi-star-fill filled' : 'bi-star'" aria-hidden="true"></i>
                </span>
                <span class="rating-text num" aria-hidden="true">{{ activity.rating }}/5</span>
            </p>
            <p class="activity-text">{{ activity.note }}</p>
            <img v-if="activity.photoUrl" :src="activity.photoUrl" :alt="`Photo from ${heading.charAt(0).toLowerCase() + heading.slice(1)}`"
                width="280" height="280" class="activity-photo" loading="lazy" decoding="async" />
            <p v-if="activity.spent !== null" class="activity-small">Spent <span class="num">{{ money.format(Number(activity.spent)) }}</span></p>
        </template>

        <template v-else>
            <p class="activity-text">{{ activity.description }}</p>
            <p v-if="activity.hint" class="activity-small">Hint: {{ activity.hint }}</p>
        </template>

        <footer class="activity-actions">
            <template v-if="activity.kind == 'signpost'">
                <span v-if="activity.isMine" class="activity-small mb-0">
                    <i class="bi bi-hand-thumbs-up" aria-hidden="true"></i> <span class="num">{{ activity.helpfulCount }}</span> found this helpful
                </span>
                <button v-else type="button" class="btn-wb btn-wb-secondary btn-sm" :class="{ 'is-on': activity.votedByMe }"
                    :aria-pressed="activity.votedByMe ? 'true' : 'false'" :disabled="busy" :aria-busy="busy ? 'true' : undefined" @click="emit('helpful', activity)">
                    <i v-if="!busy" class="bi" :class="activity.votedByMe ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-up'" aria-hidden="true"></i>
                    {{ activity.votedByMe ? 'Helpful' : 'Mark helpful' }}
                    <span class="count num">{{ activity.helpfulCount }}</span>
                </button>
            </template>

            <template v-else>
                <span v-if="activity.completedByMe" class="done-pill"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> Completed</span>
                <button v-else-if="!activity.isMine" type="button" class="btn-wb btn-wb-primary btn-sm" :disabled="busy" :aria-busy="busy ? 'true' : undefined" @click="fileInput.click()">
                    <i v-if="!busy" class="bi bi-camera" aria-hidden="true"></i>
                    {{ busy ? 'Uploading…' : 'Complete with a photo' }}
                </button>
                <span class="activity-small mb-0"><span class="num">{{ activity.completedCount }}</span> completed</span>
                <input ref="fileInput" type="file" accept="image/*" class="d-none" tabindex="-1" aria-hidden="true" @change="onProofPicked" />
            </template>

            <span v-if="activity.isMine" class="owner-actions">
                <button type="button" class="btn-wb-ghost btn-sm" :aria-label="`Edit your ${noun}`" @click="emit('edit', activity)">
                    <i class="bi bi-pencil" aria-hidden="true"></i> Edit
                </button>
                <button type="button" class="btn-wb-ghost btn-sm danger" :aria-label="`Delete your ${noun}`" @click="emit('delete', activity)">
                    <i class="bi bi-trash3" aria-hidden="true"></i> Delete
                </button>
            </span>
        </footer>
    </article>
</template>

<style scoped>
.activity-card {
  flex-shrink: 0;   /* same as PlaceCard, so the scrolling list doesn't squash it */
  background: var(--wb-surface-2);
  border-radius: var(--r-card);
  padding: var(--sp-4) var(--sp-5);
}

.activity-card.is-selected {
  outline: 3px solid var(--wb-green);
  outline-offset: 0;
}

.activity-head {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  margin-bottom: var(--sp-2);
}

.head-text {
  min-width: 0;
  flex: 1;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--wb-on-ink);
  font-weight: 600;
  flex-shrink: 0;
}

.activity-kind {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-meta);
  font-weight: 500;
  border-radius: var(--r-pill);
  padding: 2px 10px;
}

.activity-title {
  font-family: var(--font-ui);
  font-size: var(--fs-lead);
  font-weight: 600;
  line-height: 1.25;
  margin: var(--sp-1) 0 0;
}

/* the heading is the button that picks the pin on the map */
.title-btn {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: var(--sp-1) 0;
  background: none;
  border: none;
  border-radius: var(--r-control);
  color: var(--wb-ink);
  font: inherit;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.title-btn:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.title-btn:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.activity-meta {
  font-size: var(--fs-small);
  color: var(--wb-text-2);
  margin: 0;
}

.stars {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--wb-control);
  margin: 0 0 var(--sp-2);
}

.stars .filled {
  color: var(--wb-amber);
}

.rating-text {
  font-size: var(--fs-small);
  color: var(--wb-text-2);
}

.activity-text {
  color: var(--wb-ink);
  margin: 0 0 var(--sp-2);
  overflow-wrap: anywhere;
}

.activity-small {
  font-size: var(--fs-small);
  color: var(--wb-text-2);
  margin: 0 0 var(--sp-2);
}

.activity-photo {
  display: block;
  width: 100%;
  max-width: 280px;
  height: auto;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--r-control);
  margin-bottom: var(--sp-2);
}

.activity-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
  margin-top: var(--sp-1);
}

.owner-actions {
  margin-left: auto;
  display: flex;
  gap: var(--sp-1);
}

/* the ghost button's hover tone is the card's own tone, so step to the surface instead */
.owner-actions .btn-wb-ghost:hover {
  background: var(--wb-surface);
}

.btn-wb-ghost.danger {
  color: var(--wb-danger);
}

.btn-wb-secondary.is-on {
  background: var(--wb-amber-tint);
  color: var(--wb-amber-ink);
  border-color: var(--wb-amber-ink);
}

.count {
  background: var(--wb-surface);
  color: var(--wb-ink);
  border-radius: var(--r-pill);
  padding: 2px var(--sp-2);
  font-size: var(--fs-meta);
}

.done-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  min-height: 32px;
  background: var(--wb-green-tint);
  color: var(--wb-green);
  border-radius: var(--r-pill);
  padding: var(--sp-1) var(--sp-3);
  font-size: var(--fs-small);
  font-weight: 600;
}
</style>
