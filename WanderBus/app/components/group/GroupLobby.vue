<script setup>
import { ref, onMounted } from 'vue'
import SeatMap from '~/components/group/SeatMap.vue'

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

  result.value = {...result.value,...reroll(response.data.value,result.value.possibleStops)
  
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
      const { data } = $supabase.from('group_members').select('user_id, display_name').eq(`group_code=${props.group.group_code}`)
      groupMembers.value = (data || []).filter(m => m.userId!= groupDetails.host_id)
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
    reloadMembers
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
  <div class="row g-4 mt-2">
    <div class="col-12 col-lg-4">
      <div class="lobby-card">
        <h2>Everyone aboard?</h2>
        <p>Wait here while your friends join the crew.</p>

        <p class="code-label">Crew code</p>
        <div class="group-code num">{{ group.group_code }}</div>

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
          class="btn-wb-secondary lobby-button leave-button"
          :disabled="leavingGroup || loadingMembers"
          :aria-busy="leavingGroup ? 'true' : undefined"
          @click="leaveGroup"
        >
          {{ leavingGroup ? 'Leaving…' : 'Leave crew' }}
        </button>
      </div>
    </div>

    <div class="col-12 col-lg-8">
      <div class="lobby-card">
        <h2>Crew lobby</h2>
        <p>Once everyone’s here, the host spins for the crew.</p>

        <div v-if="hostLeft" class="member-row host-left" role="status">
          <i class="bi bi-person-dash host-icon" aria-hidden="true"></i>
          <div class="member-details">
            <strong>Host left</strong>
            <span>Nobody can start the spin without a host. Leave this crew, then host or join another.</span>
          </div>
        </div>

        <SeatMap
          v-if="!hostLeft && !loadingMembers && !membersError"
          class="lobby-seats"
          :members="groupMembers"
          :host-name="hostName"
          :is-host="isHost"
          :code="group.group_code"
          :current-user-id="currentUserId"
        />

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
        <button
          type="button"
          class="lobby-button green-button"
          :disabled="!isHost"
          :hidden="!isHost"
          @click="ready=true"
        >
          Ready
        </button>
        <button
          type="button"
          class="lobby-button green-button"
          :disabled="!isHost && !sharedSpin"
          :hidden="isHost"
          @click="ready=true"
        >
          Waiting for host to spin...
        </button>
        <SpinFilters
        v-if="ready"
        v-model:travelTime="travelTime"
        v-model:starting-location="startingLocation"
        v-model:selected-place="selectedPlace"
        :categories="Object.keys(categories)"
        v-model:preferences="preferences"
        :places="locResponse.data.value"
        @submit="spin2()"
        />
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
        <SpinResults
          v-if="!isHost && sharedSpin"
          :submitted="true"
          :chosen-stop="sharedSpin.chosenStop"
          :stop-details="sharedSpin.stopDetails"
          :start-details="sharedSpin.startDetails"
          :starting-stops="sharedSpin.startingStops"
          :preferences="sharedSpin.preferences"
          @save-trip="saveTrip()"
        />
        
    

      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby-card {
  height: 100%;
  padding: var(--sp-5);
  background: var(--wb-surface);
  border-radius: var(--r-card);
  display: flex;
  flex-direction: column;
}

.lobby-card h2 {
  margin: 0 0 var(--sp-2);
  font-family: var(--font-ui);
  font-size: var(--fs-lead);
  font-weight: 600;
}

.lobby-card p {
  margin: 0 0 var(--sp-4);
  color: var(--wb-text-2);
}

.lobby-card .code-label {
  margin: var(--sp-2) 0 var(--sp-2);
  color: var(--wb-ink);
  font-weight: 500;
}

.group-code {
  width: 100%;
  min-width: 0;
  padding: var(--sp-4) var(--sp-2);
  margin-bottom: var(--sp-3);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  text-align: center;
  font-family: var(--font-display);
  font-size: var(--fs-title);
  font-weight: 600;
  letter-spacing: 0.15em;
  overflow-wrap: anywhere;
}

.lobby-button {
  width: 100%;
}

.copy-button {
  margin-bottom: var(--sp-5);
}

.leave-button {
  margin-top: auto;
}

.member-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
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
  margin: var(--sp-3) 0 var(--sp-5);
  padding: var(--sp-5) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
  text-align: center;
  color: var(--wb-text-2);
}
.lobby-card :deep(.filters) {
  position: static;
}

/* nothing to say once the crew has loaded: collapse the well, keep the live region */
.waiting-box:empty {
  margin: 0 0 var(--sp-5);
  padding: 0;
  background: none;
}

.lobby-seats {
  margin-top: var(--sp-2);
  margin-bottom: var(--sp-4);
}

.lobby-card .spin-hint {
  margin: 0 0 var(--sp-2);
  color: var(--wb-muted);
  font-size: var(--fs-small);
}

.lobby-card .spin-hint + .lobby-button,
.lobby-card .waiting-box + .lobby-button {
  margin-top: auto;
}
</style>
