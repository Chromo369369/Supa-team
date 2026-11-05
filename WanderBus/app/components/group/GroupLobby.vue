<script setup>
import { ref, onMounted } from 'vue'
import SeatMap from '~/components/group/SeatMap.vue'
import LedBoard from '~/components/ui/LedBoard.vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'
import SpinFilters from '~/components/spin/SpinFilters.vue'
import SpinResults from '~/components/spin/SpinResults.vue'

const emit = defineEmits(['leave'])

const props = defineProps({
  group: {
    type: Object,
    required: true
  }
})
const result = ref(null)
let channel = null
const { $supabase } = useNuxtApp()
const toast = useToast()
const { confirm } = useConfirm()
const hostName = ref('Host')
const isHost = ref(false)
const groupMembers = ref([])
const loadingMembers = ref(true)
const membersError = ref('')
const currentUserId = ref('')
const leavingGroup = ref(false)
const ready = ref(false)
const travelTime = ref(null)
const startingLocation = ref('')
const selectedPlace=ref('')
const preferences = ref([])
const locResponse = await useFetch('/api/onemap', {
    query: { value: startingLocation }
})
const submitted= ref(false)
const response = await useFetch('/api/allBusStops')
const sharedSpin = ref(null)

async function shareSpin(){
  if (!result.value){
    return
  }
  
  const spinData = {
    chosenStop: result.value.chosenStop,
    stopDetails: result.value.stopDetails,
    startDetails: result.value.startDetails,
    startingStops: result.value.startingStops,
    preferences: preferences.value,
    startingAddress: selectedPlace.value.ADDRESS
  }
  sharedSpin.value = spinData
  const {data,error} = await $supabase.from('groups').update( {current_spin: spinData}).eq('group_code', props.group.group_code).select()
  if (error || !data?.length){alert('could not share spin', error)}
  await $supabase.from('group_spin_options').upsert({
    group_code: props.group.group_code,
    possible_stops: result.value.possibleStops
  })
}
async function saveTrip(){
        try{
            const {data, error} = await $supabase.from('passport_entries').insert({
                starting_stop: sharedSpin.value.startDetails.Description,
                end_stop: sharedSpin.value.stopDetails.Description,
                time_taken: Math.ceil(sharedSpin.value.chosenStop.chosen.totalTime),
                bus_taken: sharedSpin.value.chosenStop.chosen.bus,
                starting_location: sharedSpin.value.startingAddress
            })
            if(error){
                alert(`Could not save your trip: ${error.message}`)
                return
            }
            alert('Your entry has been saved successfully, to view it, please head to the passport page!')
            
                
        }catch(e){
            console.log(e)
        }
    }

async function respin2(){
  let possibleStops = result?.value.possibleStops
  if (!possibleStops){
    const { data } = await $supabase.from('group_spin_options').select('possible_stops').eq('group_code',props.group.group_code).maybeSingle()
    possibleStops = data?.possibleStops
  }
  result.value = {...result.value,...reroll(response.data.value,result.value.possibleStops)
  
  }
  if (!possibleStops){
    ready.value=true
  }
  await shareSpin()
}

async function spin2(){
  submitted.value=true
  result.value = null
  result.value = await spin(preferences.value,selectedPlace.value,travelTime.value,submitted.value)
  await shareSpin()
}

const hostLeft = ref(null)

onMounted(async () => {
  try {
    const { data: userData, error: userError } = await $supabase.auth.getUser()
    if (userError) throw userError

    currentUserId.value = userData.user.id

    const { data: groupDetails, error: groupError } = await $supabase
      .from('groups')
      .select('host_id, current_spin')
      .eq('group_code', props.group.group_code)
      .maybeSingle()
    if (groupError) throw groupError
    // the host leaving deletes the group row, so a missing group means the host left
    if (!groupDetails) {
      hostLeft.value = true
      return
    }
    sharedSpin.value = groupDetails.current_spin

    isHost.value = userData.user.id == groupDetails.host_id

    const { data: members, error: memberError } = await $supabase
      .from('group_members')
      .select('user_id, display_name')
      .eq('group_code', props.group.group_code)

    if (memberError) throw memberError

    const allMembers = members || []
    let host = null

    for (const member of allMembers) {
      if (member.user_id == groupDetails.host_id) {
        host = member
        break
      }
    }

    if (host) {
      hostName.value = host.display_name
    } else {
      hostLeft.value = true
    }
    groupMembers.value = allMembers.filter(
      member => member.user_id != groupDetails.host_id
    )
    async function reloadMembers(){
      const { data } = await $supabase.from('group_members').select('user_id, display_name').eq('group_code', props.group.group_code)
      groupMembers.value = (data || []).filter(m => m.user_id != groupDetails.host_id)
    }
    channel = $supabase.channel(`group-${props.group.group_code}`).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'groups',
      filter: `group_code=eq.${props.group.group_code}`
    }, 
    (payload) => {sharedSpin.value = payload.new.current_spin})
    .on('postgres_changes',
    { event: '*', schema: 'public', table: 'group_members', filter: `group_code=eq.${props.group.group_code}` },
    reloadMembers)
    .subscribe()
  } catch {
    membersError.value = 'Couldn’t load your crew. Refresh the page to try again.'
  } finally {
    loadingMembers.value = false
  }
})

onUnmounted(()=>{
  if (channel){
    $supabase.removeChannel(channel)
  }
})

async function leaveGroup() {
  if (leavingGroup.value) return

  const ok = await confirm(isHost.value
    ? {
        title: `Leave crew ${props.group.group_code}?`,
        body: 'As host, leaving ends the crew for everyone.',
        confirmLabel: 'End crew'
      }
    : {
        title: `Leave crew ${props.group.group_code}?`,
        confirmLabel: 'Leave crew'
      })
  if (!ok) return

  leavingGroup.value = true

  try {
    if (isHost.value) {
      const { error: membersDeleteError } = await $supabase
        .from('group_members')
        .delete()
        .eq('group_code', props.group.group_code)

      if (membersDeleteError) throw membersDeleteError

      const { error: groupDeleteError } = await $supabase
        .from('groups')
        .delete()
        .eq('group_code', props.group.group_code)

      if (groupDeleteError) throw groupDeleteError

    } else {
      const { error: memberDeleteError } = await $supabase
        .from('group_members')
        .delete()
        .eq('group_code', props.group.group_code)
        .eq('user_id', currentUserId.value)

      if (memberDeleteError) throw memberDeleteError
    }

    emit('leave')
  } catch (error) {
    toast.error(error.message)
  } finally {
    leavingGroup.value = false
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.group.group_code)
    toast.success('Crew code copied.')
  } catch {
    toast.error('Couldn’t copy the code. Select it and copy it instead.')
  }
}
</script>

<template>
  <!-- F1's proportions: a 340px lobby column (like the filter column) and the ticket stage beside it -->
  <div class="lobby-grid" :class="{ 'has-dock': ready }">
    <div class="lobby-col">
      <div class="lobby-card">
        <div class="lobby-head">
          <h2>Crew lobby</h2>
          <p>Share the code so friends can join. Once everyone’s here, the host spins for the crew.</p>
        </div>

        <div class="lobby-seats">
          <!-- the crew LED rides on top of the bus -->
          <SeatMap
            v-if="!hostLeft && !loadingMembers && !membersError"
            compact
            :show-sign="true"
            :members="groupMembers"
            :host-name="hostName"
            :host-id="group.host_id"
            :is-host="isHost"
            :code="group.group_code"
            :current-user-id="currentUserId"
          />
          <!-- no bus to sit on (loading, error, host left): the sign stays on its own -->
          <div v-else class="crew-sign">
            <LedBoard
              class="crew-sign__led"
              badge=""
              :pitch="3"
              :line1="`CREW ${group.group_code}`"
              :label="`Crew ${group.group_code}`"
            />
          </div>

          <div v-if="hostLeft" class="member-row host-left" role="status">
            <i class="bi bi-person-dash host-icon" aria-hidden="true"></i>
            <div class="member-details">
              <strong>Host left</strong>
              <span>Nobody can start the spin without a host. Leave this crew, then host or join another.</span>
            </div>
          </div>
        </div>

        <div class="lobby-foot">
          <div class="waiting-box" aria-live="polite">
            <span v-if="loadingMembers">Loading your crew…</span>
            <span v-else-if="membersError" role="alert">{{ membersError }}</span>
            <span v-else-if="!hostLeft && groupMembers.length == 0">
              Waiting for friends to join…
            </span>
          </div>

          <p v-if="!isHost && !loadingMembers && !hostLeft" id="spin-hint" class="spin-hint">
            Only the host can start the spin.
          </p>

          <div class="lobby-actions">
            <button
              type="button"
              class="btn-wb-ghost lobby-button copy-button"
              @click="copyCode"
            >
              <i class="bi bi-clipboard" aria-hidden="true"></i>
              Copy code
            </button>

            <button
              type="button"
              class="btn-wb-primary lobby-button ready-button"
              :disabled="!isHost"
              :hidden="!isHost"
              @click="ready=true"
            >
              Ready
            </button>
            <button
              type="button"
              class="btn-wb-primary lobby-button ready-button"
              :disabled="!isHost && !sharedSpin"
              :hidden="isHost"
              @click="ready=true"
            >
              Waiting for host to spin…
            </button>

            <button
              type="button"
              class="btn-wb-secondary lobby-button leave-button"
              :disabled="leavingGroup || loadingMembers"
              :aria-busy="leavingGroup ? 'true' : undefined"
              @click="leaveGroup"
            >
              {{ leavingGroup ? 'Leaving…' : 'Leave crew' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="stage-col">
      <!-- the ticket card: the ticket (with SpinResults' own LED on top) first, the filters under it -->
      <div class="ticket-col">
        <!-- what the ticket column says before there is a ticket to show -->
        <div v-if="loadingMembers" class="ticket-wait">
          <WanderMascot mood="loading" :size="64" />
          <div>
            <h2>Crew ticket</h2>
            <p>Loading the ticket…</p>
          </div>
        </div>
        <div v-else-if="membersError || hostLeft" class="ticket-wait">
          <WanderMascot mood="sad" :size="64" />
          <div>
            <h2>Crew ticket</h2>
            <p>No ticket without a host and a crew.</p>
          </div>
        </div>
        <div v-else-if="isHost && !ready && !sharedSpin" class="ticket-wait">
          <WanderMascot mood="idle" :size="64" />
          <div>
            <h2>Crew ticket</h2>
            <p>Tap Ready when everyone’s aboard. Your filters open here, and the ticket you spin is shared with the crew.</p>
          </div>
        </div>
        <div v-else-if="!isHost && !sharedSpin" class="ticket-wait">
          <WanderMascot mood="sleepy" :size="64" />
          <div>
            <h2>Crew ticket</h2>
            <p>Waiting for the host to spin…</p>
          </div>
        </div>

        <Transition name="ticket-in" appear>
          <SpinResults
          v-if="submitted"
          :submitted="submitted"
          :error-message="result?.errorMessage"
          :chosen-stop="result?.chosenStop"
          :stop-details="result?.stopDetails"
          :start-details="result?.startDetails"
          :starting-stops="result?.startingStops"
          :preferences="preferences"
          @reroll="respin2()"
          @save-trip="saveTrip()"
          />
        </Transition>
        <Transition name="ticket-in" appear>
          <SpinResults
            v-if="!submitted && sharedSpin"
            :submitted="true"
            :chosen-stop="sharedSpin.chosenStop"
            :stop-details="sharedSpin.stopDetails"
            :start-details="sharedSpin.startDetails"
            :starting-stops="sharedSpin.startingStops"
            :preferences="sharedSpin.preferences"
            @reroll="respin2()"
            @save-trip="saveTrip()"
          />
        </Transition>

        <SpinFilters
        v-if="ready"
        class="ticket-filters"
        v-model:travelTime="travelTime"
        v-model:starting-location="startingLocation"
        v-model:selected-place="selectedPlace"
        :categories="Object.keys(categories)"
        v-model:preferences="preferences"
        :places="locResponse.data.value"
        @submit="spin2()"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── layout ──
   F1's proportions (home.vue .spin-layout): a 340px column on the left, here the crew lobby in
   place of the filters, and the ticket stage taking the rest. Phones stack, lobby first. */
.lobby-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--sp-5);
  margin-top: var(--sp-2);
}

.lobby-col,
.stage-col {
  min-width: 0;
}

@media (min-width: 992px) {
  .lobby-grid {
    grid-template-columns: 340px minmax(0, 1fr);
    gap: var(--sp-6);
    align-items: start;
  }

}

/* the lobby rides along like F1's filter bar, when the screen is tall enough to show all of it */
@media (min-width: 992px) and (min-height: 760px) {
  .lobby-col {
    position: sticky;
    top: 90px;
  }
}

/* ── crew lobby card: header, the bus with its LED, then the actions ── */
.lobby-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
  background: var(--wb-surface);
  border-radius: var(--r-card);
}

.lobby-head,
.lobby-seats,
.lobby-foot {
  min-width: 0;
}

.lobby-seats {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.lobby-card h2,
.ticket-wait h2 {
  margin: 0 0 var(--sp-1);
  font-family: var(--font-ui);
  font-size: var(--fs-lead);
  font-weight: 600;
}

.lobby-card p,
.ticket-wait p {
  margin: 0;
  color: var(--wb-text-2);
}

.lobby-head p {
  font-size: var(--fs-small);
}

/* the LED on its own while there is no bus to put it on: same size and place as on the bus */
.crew-sign {
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  padding: 0 5%;
}

.crew-sign__led {
  width: 100%;
}

.copy-button {
  background: var(--wb-surface-2);
  color: var(--wb-ink);
}

.copy-button:hover {
  background: var(--wb-line);
}

.member-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}

.host-icon {
  font-size: 20px;
  line-height: 1;
  color: var(--wb-amber-ink);
}

.member-details {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  color: var(--wb-ink);
  overflow-wrap: anywhere;
}

.member-details span {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

.waiting-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-3);
  padding: var(--sp-3);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
  text-align: center;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

/* nothing to say once the crew has loaded: collapse the well, keep the live region */
.waiting-box:empty {
  margin: 0;
  padding: 0;
  background: none;
}

.lobby-card .spin-hint {
  margin: 0 0 var(--sp-2);
  color: var(--wb-muted);
  font-size: var(--fs-small);
}

/* the actions: Copy code, Ready (or the member's waiting button) and Leave crew, stacked full
   width; 340px is too narrow for the long waiting label to share a row */
.lobby-actions {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.lobby-button {
  width: 100%;
  min-height: 44px;
}

.lobby-button[hidden] {
  display: none;
}

/* ── ticket stage: the ticket (or what to expect) first, the filters under it ── */
.ticket-col {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
}

/* the filters stay in the stage instead of sticking on their own (the lobby column is the sticky
   one); phones keep Bootstrap's bottom sheet untouched */
@media (min-width: 992px) {
  .ticket-col :deep(.filters),
  .ticket-col :deep(.filters-sheet) {
    position: static;
  }
}

.ticket-wait {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-4);
  padding: var(--sp-5);
  background: var(--wb-surface);
  border-radius: var(--r-card);
}

.ticket-wait > div {
  min-width: 0;
}

/* the ticket slides in once there is one */
.ticket-in-enter-active {
  transition: opacity var(--t-reveal) var(--ease), transform var(--t-reveal) var(--ease);
}

.ticket-in-leave-active {
  transition: opacity var(--t-micro) var(--ease);
}

.ticket-in-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

.ticket-in-leave-to {
  opacity: 0;
}

/* phones: leave room for the filters dock fixed to the bottom of the screen */
@media (max-width: 991.98px) {
  .lobby-grid.has-dock {
    padding-bottom: 112px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ticket-in-enter-active,
  .ticket-in-leave-active {
    transition: none;
  }
}
</style>
