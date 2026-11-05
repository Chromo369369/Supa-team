<!--
  CardCollection: the profile's collectible cards (supabase/cards.sql), drawn as a grid of
  trading cards in 5:7 portrait.

  On mount it loads the catalogue, then asks the database for any cards you've earned but don't
  have yet (claimUnlocks). Each new card gets a "New card: <name>" toast, and the confetti fires
  once for the batch.

  Unlocked cards take their rarity's colour all over (--wb-rarity-*): the art sits on the rarity
  tint (or a still mascot in the rarity colour does), then the name and a solid rarity band with
  the rarity word. Common is grey, rare blue, epic plum, legendary gold.

  Holo effect (a hand-built Vue port of the reactbits holo-card behaviour), unlocked cards only, in
  the grid and on the dialog's large card. The pointer sets --mx/--my (position, %) and --rx/--ry
  (tilt, max 12deg), rAF-throttled and reset on pointerleave; only transform, opacity and
  background-position move. Tiers: common none; rare tilt + glare; epic tilt + glare + foil
  (a rainbow sheen, color-dodge, shifted by the pointer); legendary the same with a gold foil and a
  slow idle shimmer. Under reduced motion and on (hover: none) devices there's no tilt and no glare,
  and the foil stays still. Locked cards: a dashed outline, the name and how to
  unlock it ("Save 5 trips", "Buy it in the shop"). Every card is a button that opens a native
  <dialog> with a larger card, the description and the date it was collected; Esc or Close shuts
  it and focus goes back to the card.

  States (design.md §3.3): loading keeps the grid with flat placeholder cards, an empty catalogue
  gets one sentence, and a failed load (e.g. the tables aren't there yet) says what failed with
  a Retry.

  Exposes `reload()` (= load()) so the page can refresh it, e.g. after the shop hands out a card.
-->
<script setup>
import WanderMascot from '~/components/ui/WanderMascot.vue'
import ConfettiBurst from '~/components/ui/ConfettiBurst.vue'

const { cards, loading, loadError, load, claimUnlocks, artUrl } = useCards()
const toast = useToast()

const confetti = ref(null)
const grid = ref(null)
const dialog = ref(null)
const opener = ref(null)       // the card button that opened the dialog, to give focus back to
const chosen = ref(null)       // the card shown in the dialog

const collected = computed(() => cards.value.filter(card => card.unlocked).length)

// rarity → its colour (band + mascot), its tint (art ground) and the band's text colour.
// White on common 6.16:1, rare 6.09:1, epic 8.60:1; gold is a fill only, so legendary takes ink (7.59:1)
const rarities = {
    common: { key: 'common', label: 'Common', band: 'var(--wb-rarity-common)', tint: 'var(--wb-rarity-common-tint)', text: 'var(--wb-on-ink)' },
    rare: { key: 'rare', label: 'Rare', band: 'var(--wb-rarity-rare)', tint: 'var(--wb-rarity-rare-tint)', text: 'var(--wb-on-ink)' },
    epic: { key: 'epic', label: 'Epic', band: 'var(--wb-rarity-epic)', tint: 'var(--wb-rarity-epic-tint)', text: 'var(--wb-on-ink)' },
    legendary: { key: 'legendary', label: 'Legendary', band: 'var(--wb-rarity-legendary)', tint: 'var(--wb-rarity-legendary-tint)', text: 'var(--wb-ink)' }
}
const rarityOf = (card) => rarities[card.rarity] || rarities.common

/* ── holo ── */
// classes for an unlocked card's tier; common and locked cards get none
const HOLO_TIERS = ['rare', 'epic', 'legendary']
function holoOf(card) {
    const tier = rarityOf(card).key
    return card.unlocked && HOLO_TIERS.includes(tier) ? ['holo', `holo-${tier}`] : []
}
const hasFoil = (card) => card.unlocked && ['epic', 'legendary'].includes(rarityOf(card).key)

const TILT_MAX = 12   // degrees
let canTilt = false   // false under reduced motion and on (hover: none) devices
let motionQuery = null
const onMotionChange = () => { canTilt = !motionQuery.matches }

let frame = 0
let pending = null              // { el, x, y } of the last pointermove, painted on the next frame
const boxes = new WeakMap()     // each card's rect at pointerenter, so the tilt doesn't chase itself

function tracks(event) {
    return canTilt && event.pointerType != 'touch' && event.currentTarget.classList.contains('holo')
}

function onHoloEnter(event) {
    if (tracks(event)) boxes.set(event.currentTarget, event.currentTarget.getBoundingClientRect())
}

function onHoloMove(event) {
    if (!tracks(event)) return
    const el = event.currentTarget
    if (!boxes.has(el)) boxes.set(el, el.getBoundingClientRect())
    pending = { el, x: event.clientX, y: event.clientY }
    if (!frame) frame = requestAnimationFrame(paintHolo)
}

function paintHolo() {
    frame = 0
    const p = pending
    pending = null
    const box = p && boxes.get(p.el)
    if (!box || !box.width || !box.height) return
    const mx = Math.min(1, Math.max(0, (p.x - box.left) / box.width))
    const my = Math.min(1, Math.max(0, (p.y - box.top) / box.height))
    const style = p.el.style
    style.setProperty('--mx', `${(mx * 100).toFixed(1)}%`)
    style.setProperty('--my', `${(my * 100).toFixed(1)}%`)
    style.setProperty('--rx', `${((0.5 - my) * 2 * TILT_MAX).toFixed(2)}deg`)
    style.setProperty('--ry', `${((mx - 0.5) * 2 * TILT_MAX).toFixed(2)}deg`)
    p.el.dataset.holo = 'on'
}

function onHoloLeave(event) {
    const el = event.currentTarget
    if (pending?.el === el) pending = null
    boxes.delete(el)
    delete el.dataset.holo
    for (const name of ['--mx', '--my', '--rx', '--ry']) el.style.removeProperty(name)
}

onMounted(() => {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce), (hover: none)')
    canTilt = !motionQuery.matches
    motionQuery.addEventListener('change', onMotionChange)
})
onBeforeUnmount(() => {
    motionQuery?.removeEventListener('change', onMotionChange)
    if (frame) cancelAnimationFrame(frame)
})

// "Save 5 trips", "Leave 1 signpost", "Pioneer 5 places", "Buy it in the shop"
const unlockVerbs = {
    trips: ['Save', 'trip', 'trips'],
    signposts: ['Leave', 'signpost', 'signposts'],
    challenges: ['Complete', 'challenge', 'challenges'],
    pioneer: ['Pioneer', 'place', 'places']
}
function howToUnlock(card) {
    if (card.unlock_kind == 'shop') return 'Buy it in the shop'
    const words = unlockVerbs[card.unlock_kind]
    if (!words) return 'Keep exploring to earn it'
    const count = card.unlock_count || 1
    return `${words[0]} ${count} ${count == 1 ? words[1] : words[2]}`
}

const collectedOn = (card) => new Date(card.unlockedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })

// load, then hand out anything earned since last time. Also what Retry runs
async function start() {
    await load()
    if (loadError.value) return

    let newIds = []
    try {
        newIds = await claimUnlocks()
    } catch (e) {
        // the catalogue is on screen already; a failed check just waits for the next visit
        console.error('[cards] claim failed:', e.message)
        return
    }
    if (!newIds.length) return

    for (const id of newIds) {
        const card = cards.value.find(c => c.id == id)
        if (card) toast.success(`New card: ${card.name}`)
    }
    await nextTick()
    const box = grid.value?.getBoundingClientRect()
    confetti.value?.fire(box
        ? { x: box.left + box.width / 2, y: Math.max(box.top + 80, 80) }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 })
}

onMounted(start)

function reload() {
    return load()
}
defineExpose({ reload })

/* ── detail dialog ── */
async function openCard(card, event) {
    opener.value = event.currentTarget
    chosen.value = card
    await nextTick()
    if (dialog.value && !dialog.value.open) dialog.value.showModal()
}

function closeCard() {
    if (dialog.value?.open) dialog.value.close()
}

// runs for Esc, the Close button and a backdrop click alike
function onClosed() {
    chosen.value = null
    opener.value?.focus()
    opener.value = null
}

function onBackdrop(event) {
    if (event.target === dialog.value) closeCard()
}
</script>

<template>
    <section class="card-collection" aria-labelledby="cards-heading">
        <header class="collection-head">
            <h2 id="cards-heading" class="collection-title">Card collection</h2>
            <p v-if="loading" class="collection-count" role="status">Loading your cards…</p>
            <p v-else-if="!loadError && cards.length" class="collection-count">
                <span class="num">{{ collected }}</span> of <span class="num">{{ cards.length }}</span> collected
            </p>
        </header>

        <!-- Loading: the same grid, with flat placeholder cards at their real size -->
        <ul v-if="loading && !cards.length" class="card-grid" aria-hidden="true">
            <li v-for="n in 6" :key="n" class="card-skeleton"></li>
        </ul>

        <!-- Error: one sentence, what failed, Retry (the tables may not exist yet) -->
        <div v-else-if="loadError" class="state-block" role="alert">
            <WanderMascot mood="sad" color="var(--wb-danger)" :size="48" />
            <div>
                <p class="state-text">Couldn’t load your cards.</p>
                <p class="state-detail">{{ loadError }}</p>
            </div>
            <button type="button" class="btn-wb-secondary btn-sm" @click="start">
                <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry
            </button>
        </div>

        <!-- Empty: no cards in the catalogue yet -->
        <div v-else-if="!cards.length" class="state-block">
            <WanderMascot mood="sleepy" :size="48" />
            <p class="state-text">No cards to collect yet. Check back after your next trip.</p>
        </div>

        <ul v-else ref="grid" class="card-grid">
            <li v-for="card in cards" :key="card.id">
                <button
                    type="button"
                    class="wb-card"
                    :class="[card.unlocked ? 'is-unlocked' : 'is-locked', ...holoOf(card)]"
                    aria-haspopup="dialog"
                    @click="openCard(card, $event)"
                    @pointerenter="onHoloEnter"
                    @pointermove="onHoloMove"
                    @pointerleave="onHoloLeave"
                >
                    <template v-if="card.unlocked">
                        <span class="card-art" :style="{ background: rarityOf(card).tint }">
                            <img v-if="artUrl(card.art_path)" :src="artUrl(card.art_path)" alt="" class="art-img" loading="lazy" decoding="async" />
                            <WanderMascot v-else class="art-mascot" :color="rarityOf(card).band" :size="72" />
                            <span v-if="hasFoil(card)" class="holo-foil" aria-hidden="true"></span>
                        </span>
                        <span class="card-name">{{ card.name }}</span>
                        <span class="card-band" :style="{ background: rarityOf(card).band, color: rarityOf(card).text }">
                            {{ rarityOf(card).label }}
                        </span>
                        <span v-if="holoOf(card).length" class="holo-glare" aria-hidden="true"></span>
                    </template>

                    <template v-else>
                        <span class="card-art locked-art" aria-hidden="true">
                            <i class="bi bi-lock"></i>
                        </span>
                        <span class="card-name"><span class="visually-hidden">Locked: </span>{{ card.name }}</span>
                        <span class="card-unlock">{{ howToUnlock(card) }}</span>
                    </template>
                </button>
            </li>
        </ul>

        <!-- Detail: native <dialog> traps focus and closes on Esc; onClosed gives focus back to the card -->
        <dialog ref="dialog" class="card-dialog" aria-labelledby="card-dialog-title" @close="onClosed" @click="onBackdrop">
            <div v-if="chosen" class="dialog-inner">
                <div
                    class="wb-card is-large"
                    :class="[chosen.unlocked ? 'is-unlocked' : 'is-locked', ...holoOf(chosen)]"
                    aria-hidden="true"
                    @pointerenter="onHoloEnter"
                    @pointermove="onHoloMove"
                    @pointerleave="onHoloLeave"
                >
                    <template v-if="chosen.unlocked">
                        <span class="card-art" :style="{ background: rarityOf(chosen).tint }">
                            <img v-if="artUrl(chosen.art_path)" :src="artUrl(chosen.art_path)" alt="" class="art-img" decoding="async" />
                            <WanderMascot v-else class="art-mascot" :color="rarityOf(chosen).band" :size="120" />
                            <span v-if="hasFoil(chosen)" class="holo-foil" aria-hidden="true"></span>
                        </span>
                        <span class="card-name">{{ chosen.name }}</span>
                        <span class="card-band" :style="{ background: rarityOf(chosen).band, color: rarityOf(chosen).text }">
                            {{ rarityOf(chosen).label }}
                        </span>
                        <span v-if="holoOf(chosen).length" class="holo-glare" aria-hidden="true"></span>
                    </template>
                    <template v-else>
                        <span class="card-art locked-art"><i class="bi bi-lock"></i></span>
                        <span class="card-name">{{ chosen.name }}</span>
                        <span class="card-unlock">{{ howToUnlock(chosen) }}</span>
                    </template>
                </div>

                <div class="dialog-text">
                    <h3 id="card-dialog-title" class="dialog-title">{{ chosen.name }}</h3>
                    <p class="dialog-meta">{{ rarityOf(chosen).label }} card</p>
                    <p v-if="chosen.description" class="dialog-desc">{{ chosen.description }}</p>
                    <p v-if="chosen.unlocked" class="dialog-meta">Collected on {{ collectedOn(chosen) }}</p>
                    <p v-else class="dialog-meta">Not collected yet. {{ howToUnlock(chosen) }} to earn it.</p>
                    <button type="button" class="btn-wb-secondary btn-sm dialog-close" @click="closeCard">Close</button>
                </div>
            </div>
        </dialog>

        <ConfettiBurst ref="confetti" />
    </section>
</template>

<style scoped>
.collection-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
  margin-bottom: var(--sp-4);
}

.collection-title {
  margin: 0;
  font-size: var(--fs-lead);
}

.collection-count {
  margin: 0;
  color: var(--wb-text-2);
}

/* ── the grid: as many 5:7 cards as fit, never narrower than 140px ── */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--sp-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.card-skeleton {
  aspect-ratio: 5 / 7;
  border-radius: var(--r-card);
  background: var(--wb-surface-2);
}

/* ── one card ── */
.wb-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  aspect-ratio: 5 / 7;
  padding: 0;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: var(--r-card);
  background: var(--wb-surface);
  color: var(--wb-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  position: relative;
  transition: transform var(--t-micro) var(--ease), border-color var(--t-micro) var(--ease);
}

button.wb-card:hover { transform: translateY(-2px); border-color: var(--wb-line); }
button.wb-card:active { transform: scale(.98); }
button.wb-card:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 3px;
}

.card-art {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.art-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* a still mascot: no random blinks on a wall of cards */
.art-mascot :deep(.wm-eye) { animation: none; }

.card-name {
  display: block;
  padding: var(--sp-2) var(--sp-3) var(--sp-1);
  font-weight: 600;
  font-size: var(--fs-small);
  line-height: 1.3;
}

.card-band {
  display: block;
  padding: var(--sp-1) var(--sp-3) var(--sp-2);
  font-size: var(--fs-small);
  font-weight: 500;
}

/* ── holo (rare, epic, legendary; unlocked only) ──
   --mx/--my: pointer position in %, --rx/--ry: tilt in deg, set per frame from the script.
   Only transform, opacity and background-position change. */
.wb-card.holo,
button.wb-card.holo:hover {
  transform: perspective(700px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform var(--t-ui) var(--ease), border-color var(--t-micro) var(--ease);
}
button.wb-card.holo:active {
  transform: perspective(700px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) scale(.98);
}
/* while the pointer is on it the card follows at once; on leave it eases back flat */
.wb-card.holo[data-holo] { transition: transform 80ms linear, border-color var(--t-micro) var(--ease); }

/* glare: a soft white spot under the pointer (the spot is the centre of a 200% background) */
.holo-glare {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  pointer-events: none;
  background-image: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--wb-surface) 42%, transparent), transparent 32%); /* taste-skill-ignore: holo foil */
  background-size: 200% 200%;
  background-position: calc(100% - var(--mx, 50%)) calc(100% - var(--my, 50%));
  opacity: 0;
  transition: opacity var(--t-ui) var(--ease);
}
.wb-card[data-holo] .holo-glare { opacity: 1; }

/* foil: a rainbow sheen over the art, dodged into it and shifted by the pointer (epic) */
.holo-foil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: color-dodge;
  background-image: repeating-linear-gradient(115deg, var(--cat-food) 0%, var(--wb-amber) 7%, var(--cat-nature) 14%, var(--cat-challenge) 21%, var(--wb-rarity-epic) 28%, var(--cat-food) 35%); /* taste-skill-ignore: holo foil */
  background-size: 300% 300%;
  background-position: var(--mx, 50%) var(--my, 50%);
  opacity: .28;
  transition: opacity var(--t-ui) var(--ease);
}
.wb-card[data-holo] .holo-foil { opacity: .5; }

/* legendary: a gold foil with a slow idle shimmer, which the pointer takes over */
.holo-legendary .holo-foil {
  background-image: repeating-linear-gradient(115deg, var(--wb-rarity-legendary) 0%, var(--wb-rarity-legendary-tint) 8%, var(--cat-shopping) 16%, var(--wb-amber) 24%, var(--wb-rarity-legendary) 32%); /* taste-skill-ignore: holo foil */
  animation: holo-shimmer 7s ease-in-out infinite alternate;
}
.holo-legendary[data-holo] .holo-foil { animation: none; }

@keyframes holo-shimmer {
  from { background-position: 0% 40%; }
  to { background-position: 100% 60%; }
}

/* no tilt, no glare and a still foil without a hovering pointer, or with reduced motion */
@media (hover: none), (prefers-reduced-motion: reduce) {
  .wb-card.holo,
  button.wb-card.holo:hover,
  button.wb-card.holo:active { transform: none; }
  .holo-glare { display: none; }
  .holo-legendary .holo-foil { animation: none; }
}

/* locked: a dashed outline (as with the empty seat), nothing filled in yet */
.wb-card.is-locked {
  border: 2px dashed var(--wb-control);
  background: var(--wb-surface-2);
}

.locked-art {
  color: var(--wb-muted);
  font-size: 1.75rem;
}

.is-locked .card-name { color: var(--wb-text-2); }

.card-unlock {
  display: block;
  padding: 0 var(--sp-3) var(--sp-3);
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  line-height: 1.3;
}

/* ── states ── */
.state-block {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-5);
  border-radius: var(--r-card);
  background: var(--wb-surface-2);
}

.state-text {
  margin: 0;
  color: var(--wb-ink);
}

.state-detail {
  margin: var(--sp-1) 0 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

/* ── detail dialog ── */
.card-dialog {
  width: min(560px, calc(100vw - 2 * var(--gutter)));
  padding: 0;
  border: 0;
  border-radius: var(--r-card);
  background: var(--wb-surface);
  color: var(--wb-ink);
  box-shadow: var(--wb-float); /* taste-skill-ignore: floating overlay */
  overscroll-behavior: contain;
}
.card-dialog::backdrop { background: rgba(20, 26, 51, .5); }

.dialog-inner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-5);
  padding: var(--sp-5);
}

.wb-card.is-large {
  flex: 0 0 200px;
  cursor: default;
  border-color: var(--wb-surface-2);
}
.wb-card.is-large.is-locked { border-color: var(--wb-control); }
.wb-card.is-large .card-name { font-size: var(--fs-body); }

.dialog-text {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.dialog-title {
  margin: 0 0 var(--sp-1);
  font-family: var(--font-display);
  font-size: var(--fs-title);
  font-weight: 600;
}

.dialog-meta {
  margin: 0 0 var(--sp-3);
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

.dialog-desc {
  margin: 0 0 var(--sp-3);
}

.dialog-close { margin-top: auto; }

@media (max-width: 479.98px) {
  .wb-card.is-large { flex-basis: 100%; max-width: 220px; margin: 0 auto; }
}

@media (prefers-reduced-motion: reduce) {
  button.wb-card:hover, button.wb-card:active { transform: none; }
}
</style>
