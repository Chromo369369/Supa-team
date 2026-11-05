<!--
  ShopPanel: the reward shop on the profile (supabase/shop.sql + supabase/rewards.sql). Your credit
  balance, the items for sale in three groups, your voucher wallet and what you've claimed so far.

  Groups
    Cards      collectable cards; once owned the row says "Owned".
    Looks      perks, each with its slot ("Ticket theme", "Stamp theme", "Mascot hat", "Bus pass").
               Once owned: "Owned" plus an Equip / Equipped toggle (aria-pressed). One look per slot,
               so equipping one replaces the other look in that slot, and the row says so beforehand.
    Vouchers   the brand as plain text (no logos), the offer and "Limited stock". A claim that comes
               back "Sold out" marks the row sold out.

  Claim asks first through the shared confirm dialog ("Spend 250 credits on Night Owl Bus card?"),
  then redeem() runs with the button busy. The database checks the price, ownership and stock, so
  an error ("You already own this", "Sold out", "Not enough credits…") comes back as an error toast.

  Your vouchers (useRewards().vouchers): each one shows the brand, the offer, the code large with a
  Copy button, "Valid until 5 Dec 2026" and "Mark as used" (confirm first). Used and expired
  vouchers are greyed and lose the buttons. No QR code (no QR library in the app).

  Emits
    redeemed   { credits, item } after a successful claim (credits = the new balance), so the
               page can update its bus pass and reload the card collection

  States (design.md §3.3): loading keeps the layout with flat placeholder rows, a failed load says
  what failed with a Retry, and an empty shop, wallet or history gets one sentence.
-->
<script setup>
import WanderMascot from '~/components/ui/WanderMascot.vue'
import ConfettiBurst from '~/components/ui/ConfettiBurst.vue'
import { useId } from 'vue'

const emit = defineEmits(['redeemed'])

const { items, credits, history, loading, loadError, busyId, load, redeem } = useShop()
const { owned, equipped, vouchers, equip, unequip, markUsed, load: loadRewards } = useRewards()
const toast = useToast()
const { confirm } = useConfirm()

const uid = `shop${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const confetti = ref(null)

const SLOTS = {
    ticket_theme: 'Ticket theme',
    stamp_theme: 'Stamp theme',
    mascot_hat: 'Mascot hat',
    pass_skin: 'Bus pass'
}

// where each reward shows up, by slug (shown instead of the stored description)
const WHERE = {
    'card-golden-double-decker': 'Legendary card. It joins your card collection on this page.',
    'card-night-owl-bus': 'Epic card. It joins your card collection on this page.',
    'perk-mascot-captain': 'Your mascot wears a captain’s cap on your bus pass and in the header.',
    'perk-ticket-sunset': 'Changes your spin tickets to sunset colours.',
    'perk-stamp-gold': 'Your passport stamps get a gold foil finish.',
    'perk-pass-night': 'Your bus pass turns night-bus dark.'
}
const describe = (item) => WHERE[item.slug] || item.description

// badges are earned, not bought: they never show here, even if an old row is still active
const forSale = computed(() => items.value.filter((item) => item.kind != 'badge' && item.active !== false))
const groups = computed(() => [
    { key: 'card', title: 'Cards', list: forSale.value.filter((item) => item.kind == 'card') },
    { key: 'perk', title: 'Looks', list: forSale.value.filter((item) => item.kind == 'perk') },
    { key: 'voucher', title: 'Vouchers', list: forSale.value.filter((item) => item.kind == 'voucher') }
].filter((group) => group.list.length))

const slugToName = (slug) => items.value.find((item) => item.slug == slug)?.name || ''

// owned: from your claimed history (cards included) and from useRewards (perks)
const ownsItem = (item) => item.kind != 'voucher' && (history.value.some((row) => row.item_id == item.id) || owned.value.includes(item.slug))
const isEquipped = (item) => !!item.slot && equipped.value[item.slot] == item.slug
// the other look in this slot that equipping would replace
const replaces = (item) => {
    const other = item.slot && equipped.value[item.slot]
    return other && other != item.slug ? slugToName(other) : ''
}

// "Hard Rock Cafe: $10 off your bill" -> "$10 off your bill", since the brand shows on its own
const offerOf = (item) => {
    const name = item.name || ''
    return item.brand && name.startsWith(`${item.brand}: `) ? name.slice(item.brand.length + 2) : name
}

const soldOut = ref(new Set())
const isSoldOut = (item) => item.stock === 0 || soldOut.value.has(item.id)

const shortBy = (item) => Math.max(0, item.cost - credits.value)
const count = new Intl.NumberFormat('en-SG')
const day = (iso) => new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })

onMounted(load)

async function claim(item, event) {
    // remember where the button is now, the confetti comes out of it after the confirm
    const box = event.currentTarget.getBoundingClientRect()
    const ok = await confirm({
        title: `Spend ${count.format(item.cost)} credits on ${item.name}?`,
        body: `You’ll have ${count.format(credits.value - item.cost)} credits left.`,
        confirmLabel: `Spend ${count.format(item.cost)} credits`,
        danger: false
    })
    if (!ok) return

    try {
        await redeem(item)
    } catch (e) {
        if (/sold out/i.test(e.message)) soldOut.value = new Set([...soldOut.value, item.id])
        toast.error(`Couldn’t claim ${item.name}. ${e.message}`)
        return
    }
    const left = `${count.format(credits.value)} credits left.`
    if (item.kind == 'voucher') toast.success(`Voucher claimed. Your code is in Your vouchers below. ${left}`)
    else toast.success(`${item.name} is yours. ${left}`)
    if (item.kind == 'card') confetti.value?.fire({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
    loadRewards()   // a new look is put on straight away when its slot was empty; a voucher brings its code
    emit('redeemed', { credits: credits.value, item })
}

// ---- equip / unequip ----
const busyLook = ref(null)

async function toggleLook(item) {
    if (busyLook.value != null) return
    busyLook.value = item.id
    const on = isEquipped(item)
    try {
        if (on) await unequip(item.slot)
        else await equip(item)
        toast.success(on ? `${item.name} is off.` : `${item.name} is on.`)
    } catch (e) {
        toast.error(`Couldn’t ${on ? 'take off' : 'put on'} ${item.name}. ${e.message}`)
    } finally {
        busyLook.value = null
    }
}

// ---- the voucher wallet ----
const isExpired = (v) => !!v.expiresAt && new Date(v.expiresAt).getTime() <= Date.now()
const isDone = (v) => !!v.usedAt || isExpired(v)
// usable ones first (soonest to expire first), then used and expired, newest first
const wallet = computed(() => [...vouchers.value].sort((a, b) => {
    if (isDone(a) != isDone(b)) return isDone(a) ? 1 : -1
    if (!isDone(a)) return (a.expiresAt || '9').localeCompare(b.expiresAt || '9')
    return b.createdAt.localeCompare(a.createdAt)
}))
const voucherOffer = (v) => offerOf({ name: v.name, brand: v.brand })

async function copyCode(v) {
    try {
        await navigator.clipboard.writeText(v.code)
        toast.success(`${v.brand || 'Voucher'} code copied.`)
    } catch {
        toast.error('Couldn’t copy the code. Select it and copy it by hand.')
    }
}

const busyVoucher = ref(null)

async function useVoucher(v) {
    const ok = await confirm({
        title: `Mark your ${v.brand || 'voucher'} code as used?`,
        body: 'Do this once the counter has taken the code. You can’t undo it.',
        confirmLabel: 'Mark as used',
        danger: false
    })
    if (!ok) return
    busyVoucher.value = v.id
    try {
        await markUsed(v.id)
        toast.success(`${v.brand || 'Voucher'} code marked as used.`)
    } catch (e) {
        toast.error(`Couldn’t mark the ${v.brand || 'voucher'} code as used. ${e.message}`)
    } finally {
        busyVoucher.value = null
    }
}
</script>

<template>
    <section class="shop-panel" aria-labelledby="shop-heading">
        <header class="shop-head">
            <h2 id="shop-heading" class="shop-title">Reward shop</h2>
            <p class="balance" :aria-busy="loading ? 'true' : undefined">
                <span class="balance-label">Your balance</span>
                <span v-if="loading && !items.length" class="balance-skeleton" aria-hidden="true"></span>
                <span v-else-if="loadError" class="balance-value is-missing">–</span>
                <span v-else class="balance-value"><span class="num">{{ count.format(credits) }}</span> <span class="unit">credits</span></span>
            </p>
        </header>

        <p v-if="loading && !items.length" class="visually-hidden" role="status">Loading the shop…</p>

        <!-- Loading: the same rows, values replaced by flat bars -->
        <ul v-if="loading && !items.length" class="item-list" aria-hidden="true">
            <li v-for="n in 3" :key="n" class="item-row">
                <div class="item-text">
                    <span class="bar bar-name"></span>
                    <span class="bar bar-desc"></span>
                </div>
                <span class="bar bar-btn"></span>
            </li>
        </ul>

        <!-- Error: one sentence, what failed, Retry (the tables may not exist yet) -->
        <div v-else-if="loadError" class="state-block" role="alert">
            <WanderMascot mood="sad" color="var(--wb-danger)" :size="48" />
            <div>
                <p class="state-text">Couldn’t load the shop.</p>
                <p class="state-detail">{{ loadError }}</p>
            </div>
            <button type="button" class="btn-wb-secondary btn-sm" @click="load">
                <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry
            </button>
        </div>

        <template v-else>
            <p v-if="!groups.length" class="empty-line">Nothing in the shop right now. New rewards land here from time to time.</p>

            <section v-for="group in groups" :key="group.key" class="shop-group" :aria-labelledby="`${uid}-group-${group.key}`">
                <h3 :id="`${uid}-group-${group.key}`" class="group-title">{{ group.title }}</h3>
                <ul class="item-list">
                    <li v-for="item in group.list" :key="item.id" class="item-row">
                        <div class="item-text">
                            <!-- vouchers lead with the brand, as plain text -->
                            <template v-if="item.kind == 'voucher'">
                                <p class="item-name">{{ item.brand || item.name }}</p>
                                <p class="item-offer">{{ offerOf(item) }}</p>
                                <p v-if="item.description" class="item-desc">{{ item.description }}</p>
                            </template>
                            <template v-else>
                                <p class="item-name">
                                    {{ item.name }}
                                    <span v-if="item.kind == 'perk' && SLOTS[item.slot]" class="kind-chip">{{ SLOTS[item.slot] }}</span>
                                </p>
                                <p v-if="describe(item)" class="item-desc">{{ describe(item) }}</p>
                                <p v-if="item.kind == 'perk' && ownsItem(item) && !isEquipped(item) && replaces(item)" :id="`${uid}-swap-${item.id}`" class="item-desc swap-note">
                                    One look per slot: equipping this replaces {{ replaces(item) }}.
                                </p>
                            </template>
                        </div>

                        <!-- owned look: Owned + the Equip toggle -->
                        <div v-if="item.kind == 'perk' && ownsItem(item) && item.slot" class="item-buy">
                            <p class="owned-mark"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> Owned</p>
                            <button
                                type="button"
                                class="btn-sm claim-btn"
                                :class="isEquipped(item) ? 'btn-wb-primary' : 'btn-wb-secondary'"
                                :aria-pressed="isEquipped(item) ? 'true' : 'false'"
                                :aria-label="isEquipped(item) ? `Take off ${item.name}` : `Equip ${item.name}`"
                                :aria-describedby="!isEquipped(item) && replaces(item) ? `${uid}-swap-${item.id}` : undefined"
                                :disabled="busyLook != null"
                                :aria-busy="busyLook == item.id ? 'true' : undefined"
                                @click="toggleLook(item)"
                            >
                                <i v-if="isEquipped(item)" class="bi bi-x-lg" aria-hidden="true"></i>
                                {{ isEquipped(item) ? 'Take off' : 'Equip' }}
                            </button>
                        </div>

                        <!-- owned card -->
                        <div v-else-if="ownsItem(item)" class="item-buy">
                            <p class="owned-mark"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> Owned</p>
                        </div>

                        <div v-else class="item-buy">
                            <p class="item-cost"><span class="num">{{ count.format(item.cost) }}</span> <span class="unit">credits</span></p>
                            <button
                                type="button"
                                class="btn-wb-primary btn-sm claim-btn"
                                :aria-label="`${busyId == item.id ? 'Claiming' : 'Claim'} ${item.name}`"
                                :disabled="shortBy(item) > 0 || busyId != null || isSoldOut(item)"
                                :aria-busy="busyId == item.id ? 'true' : undefined"
                                :aria-describedby="isSoldOut(item) || shortBy(item) > 0 || (item.kind == 'voucher' && item.stock != null) ? `${uid}-need-${item.id}` : undefined"
                                @click="claim(item, $event)"
                            >
                                {{ busyId == item.id ? 'Claiming…' : isSoldOut(item) ? 'Sold out' : 'Claim' }}
                            </button>
                            <p v-if="isSoldOut(item)" :id="`${uid}-need-${item.id}`" class="need-more">All claimed</p>
                            <p v-else-if="shortBy(item) > 0" :id="`${uid}-need-${item.id}`" class="need-more">
                                Need <span class="num">{{ count.format(shortBy(item)) }}</span> more
                            </p>
                            <p v-else-if="item.kind == 'voucher' && item.stock != null" :id="`${uid}-need-${item.id}`" class="need-more">Limited stock</p>
                        </div>
                    </li>
                </ul>
            </section>

            <!-- your voucher codes -->
            <section class="shop-group" :aria-labelledby="`${uid}-wallet`">
                <h3 :id="`${uid}-wallet`" class="group-title">Your vouchers</h3>
                <p v-if="!wallet.length" class="empty-line">No vouchers yet. Claim one above and its code shows up here.</p>
                <ul v-else class="wallet-list">
                    <li v-for="v in wallet" :key="v.id" class="voucher" :class="{ 'is-done': isDone(v) }">
                        <div class="voucher-text">
                            <p class="item-name">{{ v.brand || v.name }}</p>
                            <p class="item-offer">{{ voucherOffer(v) }}</p>
                            <p class="voucher-status">
                                <template v-if="v.usedAt"><i class="bi bi-check-circle" aria-hidden="true"></i> Used on {{ day(v.usedAt) }}</template>
                                <template v-else-if="isExpired(v)"><i class="bi bi-clock-history" aria-hidden="true"></i> Expired on {{ day(v.expiresAt) }}</template>
                                <template v-else-if="v.expiresAt">Valid until {{ day(v.expiresAt) }}</template>
                            </p>
                        </div>

                        <div class="voucher-code-block">
                            <p class="voucher-code">{{ v.code || 'No code yet' }}</p>
                            <div v-if="!isDone(v)" class="voucher-actions">
                                <button v-if="v.code" type="button" class="btn-wb-secondary btn-sm" :aria-label="`Copy the ${v.brand || 'voucher'} code`" @click="copyCode(v)">
                                    <i class="bi bi-copy" aria-hidden="true"></i> Copy
                                </button>
                                <button
                                    type="button"
                                    class="btn-wb-ghost btn-sm"
                                    :aria-label="`Mark the ${v.brand || 'voucher'} code as used`"
                                    :disabled="busyVoucher != null"
                                    :aria-busy="busyVoucher == v.id ? 'true' : undefined"
                                    @click="useVoucher(v)"
                                >
                                    {{ busyVoucher == v.id ? 'Marking…' : 'Mark as used' }}
                                </button>
                            </div>
                        </div>
                    </li>
                </ul>
            </section>

            <section class="shop-group" :aria-labelledby="`${uid}-history`">
                <h3 :id="`${uid}-history`" class="group-title">Claimed</h3>
                <p v-if="!history.length" class="empty-line">Nothing claimed yet. Your first reward will show up here.</p>
                <ul v-else class="history-list">
                    <li v-for="row in history" :key="row.id" class="history-row">
                        <span class="history-name">{{ row.name }}</span>
                        <span class="history-date">{{ day(row.created_at) }}</span>
                        <span class="history-cost"><span class="num">{{ count.format(row.cost) }}</span> <span class="unit">credits</span></span>
                    </li>
                </ul>
            </section>
        </template>

        <ConfettiBurst ref="confetti" />
    </section>
</template>

<style scoped>
.shop-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-3) var(--sp-5);
  margin-bottom: var(--sp-4);
}

.shop-title {
  margin: 0;
  font-size: var(--fs-lead);
}

/* the balance answers "what can I afford?", so it's the biggest figure in the panel */
.balance {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin: 0;
}

.balance-label {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

.balance-value {
  font-size: var(--fs-title);
  font-weight: 600;
  line-height: 1.2;
}
.balance-value.is-missing { color: var(--wb-muted); }

.balance-skeleton {
  display: block;
  width: 120px;
  height: 34px;
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}

.unit {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  font-weight: 400;
}

/* ── groups: a heading each, space between ── */
.shop-group + .shop-group { margin-top: var(--sp-6); }

.group-title {
  margin: 0 0 var(--sp-3);
  font-family: var(--font-ui);
  font-size: var(--fs-body);
  font-weight: 600;
}

/* ── items: filled rows with a small gap, no rules ── */
.item-list,
.history-list,
.wallet-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.item-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3) var(--sp-5);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}

.item-text {
  flex: 1 1 240px;
  min-width: 0;
}

.item-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  margin: 0;
  font-weight: 600;
}

.item-offer {
  margin: var(--sp-1) 0 0;
  color: var(--wb-ink);
}

.kind-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 2px 10px;
  border-radius: var(--r-pill);
  background: var(--wb-surface);
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  font-weight: 500;
  white-space: nowrap;
}

.item-desc {
  margin: var(--sp-1) 0 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

.swap-note { color: var(--wb-ink); }

/* cost and Claim on one right edge; the reason line sits under the button */
.item-buy {
  flex: none;
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  justify-items: end;
  column-gap: var(--sp-4);
  margin-left: auto;
}

.item-cost,
.owned-mark {
  margin: 0;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}

.owned-mark {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  min-height: 44px;
  color: var(--wb-green);
}

.claim-btn { min-width: 112px; }

.need-more {
  grid-column: 2;
  margin: var(--sp-1) 0 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  white-space: nowrap;
}

/* ── the voucher wallet: a ticket-like row per code ── */
.voucher {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3) var(--sp-5);
  padding: var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-amber-tint);
}

.voucher-text {
  flex: 1 1 220px;
  min-width: 0;
}

.voucher-status {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  margin: var(--sp-1) 0 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

.voucher-code-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--sp-2);
  margin-left: auto;
}

/* the code is read out at a counter: big, the text face, tabular figures, a little air */
.voucher-code {
  margin: 0;
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-surface);
  color: var(--wb-ink);
  font-family: var(--font-ui);
  font-size: var(--fs-title);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: .08em;
  line-height: 1.2;
  overflow-wrap: anywhere;
  user-select: all;
}

.voucher-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sp-2);
}

/* used or expired: greyed, the code kept for reference */
.voucher.is-done { background: var(--wb-surface-2); }
/* text-2 on surface-2 7.4:1; the struck-through code is large type, muted 4.4:1 */
.voucher.is-done .item-name,
.voucher.is-done .item-offer { color: var(--wb-text-2); }
.voucher.is-done .voucher-code { color: var(--wb-muted); }
.voucher.is-done .voucher-code {
  background: transparent;
  text-decoration: line-through;
  user-select: text;
}

/* loading bars at the real sizes of what they stand in for */
.bar {
  display: block;
  border-radius: var(--r-control);
  background: var(--wb-line);
}
.bar-name { width: 45%; height: 20px; }
.bar-desc { width: 70%; height: 16px; margin-top: var(--sp-2); }
.bar-btn { width: 112px; height: 44px; border-radius: var(--r-pill); margin-left: auto; }

/* ── claimed history ── */
.history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: baseline;
  gap: var(--sp-4);
  min-height: 44px;
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}

.history-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-date {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  white-space: nowrap;
}

.history-cost {
  min-width: 96px;
  text-align: right;
  white-space: nowrap;
}

.empty-line {
  margin: 0;
  padding: var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
  color: var(--wb-text-2);
}

/* ── error ── */
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

@media (max-width: 479.98px) {
  .balance { align-items: flex-start; }
  .item-buy { width: 100%; grid-template-columns: 1fr auto; justify-items: start; }
  .item-buy .claim-btn, .item-buy .need-more { justify-self: end; }
  .voucher-code-block { width: 100%; align-items: stretch; }
  .voucher-code { text-align: center; }
  .voucher-actions { justify-content: stretch; }
  .voucher-actions > * { flex: 1 1 auto; }
  .history-row { grid-template-columns: minmax(0, 1fr) auto; }
  .history-date { grid-column: 1; grid-row: 2; }
  .history-cost { grid-row: 1 / span 2; align-self: center; }
}
</style>
