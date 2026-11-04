<script setup>
// a signpost or a challenge (feature 3). Same header for both, the body depends on activity.kind
const props = defineProps({
    activity: Object,
    selected: Boolean,
    busy: Boolean      // saving a vote / completion right now
})

const emit = defineEmits(['select', 'edit', 'delete', 'helpful', 'complete'])

const style = computed(() => activityStyles[props.activity.kind])
const fileInput = ref(null)

const author = computed(() => props.activity.isMine ? 'You' : props.activity.author_name)
const posted = computed(() => new Date(props.activity.created_at).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }))

// avatar colour picked from the name, so the same person always gets the same colour
const avatarColours = ['#d1432f', '#1e8a4c', '#3b46b8', '#b5307a', '#c27c0e', '#0b7a8a']
const avatarColour = computed(() => {
    let name = props.activity.author_name
    let total = 0
    for (let letter of name) total += letter.charCodeAt(0)
    return avatarColours[total % avatarColours.length]
})

function onProofPicked(event) {
    emit('complete', props.activity, event.target.files[0])
    event.target.value = ''
}
</script>

<template>
    <article
        :id="`place-${activity.key}`"
        class="activity-card"
        :class="{ 'is-selected': selected }"
        :style="{ '--accent': style.colour }"
        @click="$emit('select', activity.key)"
    >
        <header class="activity-head">
            <span class="avatar" :style="{ background: avatarColour }">{{ activity.author_name.charAt(0).toUpperCase() }}</span>
            <div>
                <p class="activity-author">{{ author }} <span class="activity-kind">{{ style.icon }} {{ style.label }}</span></p>
                <p class="activity-meta">{{ posted }} · {{ activity.distanceM }} m from the stop</p>
            </div>
        </header>

        <template v-if="activity.kind == 'signpost'">
            <p class="stars" :aria-label="`${activity.rating} out of 5 stars`">
                <span v-for="star in 5" :key="star" :class="{ filled: star <= activity.rating }">{{ star <= activity.rating ? '★' : '☆' }}</span>
            </p>
            <p class="activity-text">{{ activity.note }}</p>
            <img v-if="activity.photoUrl" :src="activity.photoUrl" alt="Photo from this signpost" class="activity-photo" loading="lazy" />
            <p v-if="activity.spent !== null" class="activity-small">Spent S${{ Number(activity.spent) }}</p>
        </template>

        <template v-else>
            <h3 class="activity-title">{{ activity.title }}</h3>
            <p class="activity-text">{{ activity.description }}</p>
            <p v-if="activity.hint" class="activity-small">Hint: {{ activity.hint }}</p>
        </template>

        <footer class="activity-actions">
            <template v-if="activity.kind == 'signpost'">
                <span v-if="activity.isMine" class="activity-small mb-0">👍 {{ activity.helpfulCount }} found this helpful</span>
                <button v-else type="button" class="btn-outline-pill" :class="{ active: activity.votedByMe }" :disabled="busy" @click.stop="$emit('helpful', activity)">
                    👍 {{ activity.votedByMe ? 'Helpful' : 'Mark helpful' }} <span class="count">{{ activity.helpfulCount }}</span>
                </button>
            </template>

            <template v-else>
                <span v-if="activity.completedByMe" class="done-pill">Completed ✓</span>
                <button v-else-if="!activity.isMine" type="button" class="btn-complete" :disabled="busy" @click.stop="fileInput.click()">
                    {{ busy ? 'Uploading...' : '📷 Complete it' }}
                </button>
                <span class="activity-small mb-0">{{ activity.completedCount }} completed</span>
                <input ref="fileInput" type="file" accept="image/*" class="d-none" @click.stop @change="onProofPicked" />
            </template>

            <span v-if="activity.isMine" class="owner-actions">
                <button type="button" class="link-btn" @click.stop="$emit('edit', activity)">✏️ Edit</button>
                <button type="button" class="link-btn danger" @click.stop="$emit('delete', activity)">🗑️ Delete</button>
            </span>
        </footer>
    </article>
</template>

<style scoped>
.activity-card {
  flex-shrink: 0;   /* same as PlaceCard, so the scrolling list doesn't squash it */
  background: #fff;
  border: 1px solid #e3e5ec;
  border-left: 4px solid var(--accent);
  border-radius: 14px;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.activity-card.is-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}

.activity-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
}

.activity-author {
  font-weight: 700;
  color: #141a33;
  margin: 0;
}

.activity-kind {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #4a5068;
  margin-left: 4px;
}

.activity-meta {
  font-size: 0.8rem;
  color: #6b7085;
  margin: 0;
}

.stars {
  color: #f5a623;
  margin-bottom: 6px;
}

.stars span:not(.filled) {
  color: #c9ccd6;
}

.activity-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #141a33;
  margin-bottom: 6px;
}

.activity-text {
  color: #141a33;
  margin-bottom: 8px;
}

.activity-small {
  font-size: 0.85rem;
  color: #4a5068;
  margin-bottom: 8px;
}

.activity-photo {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 8px;
}

.activity-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.owner-actions {
  margin-left: auto;
  display: flex;
  gap: 14px;
}

.btn-outline-pill {
  background: #fff;
  border: 1px solid #c9ccd6;
  color: #141a33;
  border-radius: 50px;
  padding: 5px 14px;
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-outline-pill.active {
  background: #fdf3d7;
  border-color: #f5a623;
}

.count {
  background: #f1f2f6;
  border-radius: 50px;
  padding: 0 7px;
  margin-left: 4px;
  font-size: 0.75rem;
}

.btn-complete {
  background: #0b7a4b;
  border: none;
  color: #fff;
  border-radius: 50px;
  padding: 6px 16px;
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-complete:disabled,
.btn-outline-pill:disabled {
  opacity: 0.6;
}

.done-pill {
  background: #e6f4ec;
  color: #0b7a4b;
  border-radius: 50px;
  padding: 5px 14px;
  font-size: 0.85rem;
  font-weight: 700;
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #0b7a4b;
  text-decoration: underline;
}

.link-btn.danger {
  color: #b3261e;
}
</style>
