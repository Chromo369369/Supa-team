<!--
  BusPassCard: the profile "bus pass" (design.md §5). One card shaped like a fare card: the
  WanderBus mark and the mascot "photo" on the left, the holder's name, Pioneer credits and four
  counts on the right. Laid out across on desktop, stacked on phones. Read-only.

  Props
    name     display name
    userId   the holder's id (the mascot colour comes from name, see passColors below)
    stats    { trips, signposts, challenges_done, pioneer_photos, credits } or null
    loading  shows the card in its own shape with grey bars where the values go (§11 of the
             app-screen rules: labels stay, values become flat bars at their real size)

  Rewards (useRewards): the mascot wears the captain's cap when that look is equipped, and the
  pass turns night-ink (.pass-night) with perk-pass-night. This is always your own pass.
  Badges (useBadges): the badges you've earned sit under your name (locked ones are hidden). On
  mount the pass calls claim() once, which toasts "New badge: X" for anything newly earned.
  Welcome bonus: the first time a credit figure shows here, a one-time "Welcome aboard" toast
  (remembered per browser under localStorage wb-welcome-seen).

  Also exports passColors(id), so the header avatar wears the same colour.
-->
<script>
import { userColor } from '~/utils/userColor'

// [colour, tint] for a person, from their display name: the same userColor as their signposts and
// their seat in the crew lobby, so a person keeps one colour everywhere
export function passColors(name) {
  const colour = userColor(name)
  return [colour, `color-mix(in srgb, ${colour} 14%, var(--wb-surface))`]
}
</script>

<script setup>
import { computed, onMounted, watch } from 'vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'

const props = defineProps({
  name: { type: String, default: '' },
  userId: { type: String, default: '' },
  stats: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const colors = computed(() => passColors(props.name))

const rewards = useRewards()
const hat = computed(() => (rewards.isOn('perk-mascot-captain') ? 'captain' : null))
const night = computed(() => rewards.isOn('perk-pass-night'))

const badges = useBadges()
onMounted(() => badges.claim())

// the welcome bonus (200 credits, given by the database): say so once, the first time credits show
const toast = useToast()
const WELCOME_KEY = 'wb-welcome-seen'
watch(() => props.stats?.credits, (credits) => {
  if (!import.meta.client || credits === null || credits === undefined) return
  try {
    if (localStorage.getItem(WELCOME_KEY)) return
    localStorage.setItem(WELCOME_KEY, '1')
  } catch {
    return   // storage blocked: skip the toast rather than repeat it on every visit
  }
  toast.success('Welcome aboard: 200 credits to start')
}, { immediate: true })

const counts = [
  { key: 'trips', label: 'Trips' },
  { key: 'signposts', label: 'Signposts' },
  { key: 'challenges_done', label: 'Challenges done' },
  { key: 'pioneer_photos', label: 'Pioneer photos' }
]

const numbers = new Intl.NumberFormat('en-SG')
// a real zero prints as 0; a missing value is a grey dash
function show(key) {
  const value = props.stats?.[key]
  return value === null || value === undefined ? '—' : numbers.format(value)
}
</script>

<template>
  <article class="bus-pass" :class="{ 'pass-night': night }" :aria-busy="loading ? 'true' : 'false'" aria-labelledby="pass-name">
    <p v-if="loading" class="visually-hidden" role="status">Loading your bus pass…</p>

    <!-- the "photo" window: the mascot in the holder's colour on its tint -->
    <div class="pass-photo" :style="loading ? null : { background: colors[1] }">
      <WanderMascot v-if="!loading" :color="colors[0]" :size="96" mood="happy" :hat="hat" />
    </div>

    <div class="pass-body">
      <div class="pass-top">
        <div class="pass-holder">
          <span class="pass-brand">WanderBus</span>
          <h2 id="pass-name" class="pass-name">
            <span v-if="loading" class="bar bar-name" aria-hidden="true"></span>
            <span :class="{ 'visually-hidden': loading }">{{ name || 'Your bus pass' }}</span>
          </h2>
          <!-- earned badges, best first; locked badges are not shown -->
          <ul v-if="!loading && badges.mine.value.length" class="pass-badges" aria-label="Badges earned">
            <li v-for="badge in badges.mine.value" :key="badge.id" class="pass-badge" :title="badge.description || undefined">
              <i class="bi" :class="badge.icon || 'bi-award'" aria-hidden="true"></i>
              <span>{{ badge.name }}</span>
            </li>
          </ul>
        </div>

        <div class="pass-credits">
          <span class="stat-label">Credits</span>
          <span v-if="loading" class="bar bar-credits" aria-hidden="true"></span>
          <span v-else class="credits-value num">{{ show('credits') }}</span>
        </div>
      </div>

      <dl class="pass-counts">
        <div v-for="item in counts" :key="item.key" class="count">
          <dt class="stat-label">{{ item.label }}</dt>
          <dd class="count-value">
            <span v-if="loading" class="bar bar-count" aria-hidden="true"></span>
            <span v-else class="num" :class="{ missing: show(item.key) === '—' }">{{ show(item.key) }}</span>
          </dd>
        </div>
      </dl>
    </div>
  </article>
</template>

<style scoped>
/* The pass: a white card on the ground with the amber stripe along its foot (the one highlight) */
.bus-pass {
  position: relative;
  display: grid;
  grid-template-columns: 168px 1fr;
  gap: var(--sp-5);
  max-width: 720px;
  padding: var(--sp-5) var(--sp-5) calc(var(--sp-5) + var(--sp-2));
  border-radius: var(--r-card);
  background: var(--wb-surface);
  overflow: hidden;
}

.bus-pass::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: var(--sp-2);
  background: var(--wb-amber);
}

.pass-photo {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 5;
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}

.pass-body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--sp-5);
  min-width: 0;
}

.pass-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
}

.pass-holder {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  min-width: 0;
}

.pass-brand {
  font-family: var(--font-display);
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--wb-text-2);
}

.pass-name {
  margin: 0;
  font-size: var(--fs-lead);
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.pass-credits {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--sp-1);
  text-align: right;
}

.credits-value {
  font-family: var(--font-display);
  font-size: var(--fs-title);
  font-weight: 600;
  line-height: 1.1;
  color: var(--wb-ink);
}

.stat-label {
  font-size: var(--fs-small);
  color: var(--wb-muted);
}

.pass-counts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-4);
  margin: 0;
}

.count {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.count-value {
  margin: 0;
  font-size: var(--fs-lead);
  font-weight: 500;
  line-height: 1.2;
  color: var(--wb-ink);
}

.missing {
  color: var(--wb-muted);
}

/* earned badges: small filled marks under the name */
.pass-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: var(--sp-2) 0 0;
  padding: 0;
  list-style: none;
}

.pass-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  min-height: 28px;
  padding: 2px 10px;
  border-radius: var(--r-pill);
  background: var(--wb-rarity-legendary-tint);
  color: var(--wb-ink);
  font-size: var(--fs-small);
  font-weight: 500;
}
.pass-badge .bi { color: var(--wb-amber-ink); }

/* Night pass (perk-pass-night): ink card, light type. on-ink on ink 17.1:1, on-ink-2 on ink 6.6:1,
   on-ink on the badge fill (on-ink 12% over ink) 12.1:1, legendary icon on it 5.4:1. The photo window keeps its light tint. */
.bus-pass.pass-night {
  background: var(--wb-ink);
  color: var(--wb-on-ink);
}
.pass-night .pass-name,
.pass-night .credits-value,
.pass-night .count-value { color: var(--wb-on-ink); }
.pass-night .pass-brand,
.pass-night .stat-label,
.pass-night .missing { color: var(--wb-on-ink-2); }
.pass-night .pass-badge {
  background: color-mix(in srgb, var(--wb-on-ink) 12%, var(--wb-ink));
  color: var(--wb-on-ink);
}
.pass-night .pass-badge .bi { color: var(--wb-rarity-legendary); }
.pass-night .bar { background: color-mix(in srgb, var(--wb-on-ink) 16%, var(--wb-ink)); }

/* Loading: flat grey bars at the size of the value they stand in for, no shimmer */
.bar {
  display: block;
  border-radius: var(--r-pill);
  background: var(--wb-surface-2);
}
.bar-name    { width: 160px; height: 1.2em; }
.bar-credits { width: 72px;  height: calc(var(--fs-title) * 1.1); }
.bar-count   { width: 40px;  height: 1.2em; }

/* Phones: the photo window becomes a band across the top and the counts go 2 by 2 */
@media (max-width: 575.98px) {
  .bus-pass {
    grid-template-columns: 1fr;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--sp-4) calc(var(--sp-4) + var(--sp-2));
  }
  .pass-photo {
    aspect-ratio: auto;
    min-height: 128px;
  }
  .pass-counts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
