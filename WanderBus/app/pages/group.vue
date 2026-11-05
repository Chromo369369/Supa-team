<script setup>
import { ref, onMounted } from 'vue'
import GroupLobby from '../components/group/GroupLobby.vue'

definePageMeta( {middleware: 'auth' })

const { $supabase } = useNuxtApp()
const toast = useToast()
const showLobby = ref(false)
const currentGroup = ref(null)
const creatingGroup = ref(false)
const groupCode = ref('')
const joiningGroup = ref(false)
const joinError = ref('')
const alreadyInGroup = ref(false)
const hasSoloTicket = ref(false)
const checkingMembership = ref(true)

onMounted(async () => {
  try {
    const { data, error } = await $supabase.auth.getUser()
    if (error) throw error
    
    if (!data.user) return
    const { data: soloTrip} = await $supabase.from('soloTrip').select('user_id').eq('user_id',data.user.id).maybeSingle()
    hasSoloTicket.value = !!soloTrip

    const { data: membership, error: membershipError } = await $supabase
      .from('group_members')
      .select('group_code')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (membershipError) throw membershipError

    if(membership){
      alreadyInGroup.value = true;
    }
    else{
      alreadyInGroup.value = false;
    }

    currentGroup.value = membership

    // auto-open the lobby (boss approved): load the crew's groups row, the same shape
    // createGroup/joinGroup put in currentGroup, and go straight to the lobby
    if (membership) {
      const { data: group, error: groupError } = await $supabase
        .from('groups')
        .select('group_code, host_id')
        .eq('group_code', membership.group_code)
        .maybeSingle()

      if (groupError) throw groupError

      if (group) {
        currentGroup.value = group
        showLobby.value = true
      } else {
        // stale membership: the crew is gone, so drop the leftover row (plan §3) and show the join page instead
        const { error: staleError } = await $supabase
          .from('group_members')
          .delete()
          .eq('group_code', membership.group_code)
          .eq('user_id', data.user.id)
        if (staleError) console.log(staleError)

        currentGroup.value = null
        alreadyInGroup.value = false
        toast.info('That crew has ended. Host a new one or join with a code.')
      }
    }
  } catch (error) {
    console.log(error)
    joinError.value = 'Couldn’t check if you’re already in a crew. Refresh the page to try again.'
  } finally {
    checkingMembership.value = false
  }
})

// create group
async function createGroup() {

  if (
    creatingGroup.value ||
    joiningGroup.value ||
    checkingMembership.value ||
    alreadyInGroup.value ||
    hasSoloTicket.value
  ) {
    return
  }

  creatingGroup.value = true

  try {
    const { data, error } = await $supabase.auth.getUser()

    if (error) {
      toast.error(error.message)
      return
    }

    if (!data.user) {
      toast.error('Log in first to host a crew.')
      return
    }

    const user = data.user
    let displayName = null

    if (user.user_metadata && user.user_metadata.display_name) {
      displayName = user.user_metadata.display_name
    }

    const { data: existingGroups, error: e } = await $supabase
      .from('groups')
      .select('group_code')

    if (e) {
      toast.error(e.message)
      return
    }

    let code = 0
    let codeExists = true


    // check if the group_code alr stored in supabase
    while (codeExists) {
      code = String(Math.floor(100000 + Math.random() * 900000))
      codeExists = false

      for (const g of existingGroups) {
        if (g.group_code == code) {
          codeExists = true
          break
        }
      }
    }

    const savedGroup = {
      group_code: code,
      host_id: user.id
    }

    const { error: groupError } = await $supabase
      .from('groups')
      .insert({
        group_code: code,
        host_id: user.id
      })

    if (groupError) {
      toast.error(groupError.message)
      return
    }

    // pass the host as a member to the db
    const { error: memberError } = await $supabase
      .from('group_members')
      .insert({
        group_code: code,
        user_id: user.id,
        display_name: displayName
      })

    if (memberError) {
      toast.error(memberError.message)
      return
    }

    currentGroup.value = savedGroup
    alreadyInGroup.value = true
    showLobby.value = true

  } catch (error) {
    console.log("something wrong in creating a group")
  } finally {
    creatingGroup.value = false
  }
}

// join the group by the 6 digit code
async function joinGroup() {
  if (
    joiningGroup.value ||
    creatingGroup.value ||
    checkingMembership.value ||
    hasSoloTicket.value
  ) return

  joinError.value = ''
  const code = groupCode.value.trim()

  if (code.length != 6) {
    joinError.value = 'Enter the 6-digit crew code.'
    return
  }

  joiningGroup.value = true

  try {
    const { data: authData, error: authError } = await $supabase.auth.getUser()
    if (authError) throw authError

    if (!authData.user) {
      joinError.value = 'Log in first to join a crew.'
      return
    }

    const { data: group, error } = await $supabase
      .from('groups')
      .select('group_code, host_id')
      .eq('group_code', code)
      .maybeSingle()

    if (error) throw error

    if (!group) {
      joinError.value = 'That code doesn’t exist. Check it and try again.'
      return
    }

    const user = authData.user
    const displayName = user.user_metadata.display_name
    const { error: memberError } = await $supabase
      .from('group_members')
      .insert({
        group_code: group.group_code,
        user_id: user.id,
        display_name: displayName
      })

    if (memberError) throw memberError

    currentGroup.value = group
    alreadyInGroup.value = true
    showLobby.value = true
  } catch (e) {
    console.error('Join crew failed:', e)
    // 23505 = unique violation: this account already has a seat in that crew
    if (e?.code === '23505') joinError.value = 'You’re already in that crew. Refresh to open its lobby.'
    else joinError.value = `Couldn’t join that crew. ${e?.message ?? 'Try again.'}`
  } finally {
    joiningGroup.value = false
  }
}

function openGroup() {
  if (alreadyInGroup.value && currentGroup.value) {
    showLobby.value = true
    return
  }

  joinGroup()
}

function resetEverything() {
  showLobby.value = false
  currentGroup.value = null
  alreadyInGroup.value = false
  groupCode.value = ''
  joinError.value = ''
}


</script>
<template>
  <section class="container py-4 group-page">
    <h1 class="page-title">Explore together</h1>
    <p class="page-description">
      Gather your friends and let WanderBus choose your next side quest.
    </p>

    <div v-if="!showLobby" class="row g-4 mt-2">
      <!-- Host card -->
      <div class="col-12 col-md-6">
        <div class="group-card">
          <i class="bi bi-bus-front card-icon" aria-hidden="true"></i>
          <h2>Host a crew</h2>
          <p>Start a crew and share its code with your friends.</p>

          <p v-if="alreadyInGroup" id="host-hint" class="card-hint">
            You’re already in a crew. Leave it to host a new one.
          </p>
          <p v-else-if="hasSoloTicket" id="host-hint" class="card-hint">
          You have an active ticket. End that journey first to host a crew.
          </p>
          <button
            type="button"
            class="btn-wb-secondary group-button"
            :disabled="creatingGroup || joiningGroup || checkingMembership || alreadyInGroup || hasSoloTicket"
            :aria-busy="creatingGroup ? 'true' : undefined"
            :aria-describedby="( alreadyInGroup || hasSoloTicket )? 'host-hint' : undefined"
            @click="createGroup"
          >
            {{ creatingGroup ? 'Hosting…' : 'Host a crew' }}
          </button>
        </div>
      </div>

      <!-- Join card -->
      <div class="col-12 col-md-6">
        <form class="group-card" novalidate @submit.prevent="openGroup">
          <i class="bi bi-people card-icon" aria-hidden="true"></i>
          <h2>Join with a code</h2>
          <p>Got a code from a friend? Enter it to join their crew.</p>

          <label for="group-code" class="code-label">Crew code</label>
          <input
            id="group-code"
            v-model="groupCode"
            type="text"
            inputmode="numeric"
            pattern="\d{6}"
            maxlength="6"
            autocomplete="off"
            spellcheck="false"
            :disabled="joiningGroup || creatingGroup || checkingMembership || alreadyInGroup || hasSoloTicket"
            :aria-invalid="joinError != '' ? 'true' : undefined"
            :aria-describedby="joinError ? 'join-error' : (( alreadyInGroup || hasSoloTicket ) ? 'join-hint' : 'join-format')"
            class="form-control group-input num"
            placeholder="6-digit code"
          >
          <p v-if="joinError" id="join-error" class="wb-field-error" role="alert">
            {{ joinError }}
          </p>
          <p v-else-if="alreadyInGroup" id="join-hint" class="card-hint">
            You’re already in a crew.
          </p>
          <p v-else-if="hasSoloTicket" id="join-hint" class="card-hint">
          You have an active ticket. End that journey first to join a crew.
          </p>
          <p v-else id="join-format" class="card-hint">
            Six digits, like <span class="num">482193</span>.
          </p>

          <button
            type="submit"
            class="btn-wb-primary group-button"
            :disabled="joiningGroup || creatingGroup || checkingMembership || hasSoloTicket"
            :aria-busy="joiningGroup ? 'true' : undefined"
          >
            {{ alreadyInGroup ? 'View your crew' : (joiningGroup ? 'Joining…' : 'Join crew') }}
          </button>
        </form>
      </div>
    </div>
    <GroupLobby v-else :group="currentGroup" @leave="resetEverything"/>
  </section>
</template>

<style scoped>
.page-title {
  margin-bottom: var(--sp-2);
  font-size: var(--fs-title);
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.page-description {
  max-width: 65ch;
  margin-bottom: 0;
  color: var(--wb-text-2);
}

.group-card {
  height: 100%;
  padding: var(--sp-5);
  border-radius: var(--r-card);
  background: var(--wb-surface);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.card-icon {
  font-size: 24px;
  line-height: 1;
  margin-bottom: var(--sp-4);
  color: var(--wb-ink);
}

.group-card h2 {
  margin: 0 0 var(--sp-2);
  font-family: var(--font-ui);
  font-size: var(--fs-lead);
  font-weight: 600;
}

.group-card p {
  margin: 0 0 var(--sp-5);
  color: var(--wb-text-2);
}

.group-card .card-hint {
  margin: var(--sp-1) 0 var(--sp-5);
  color: var(--wb-muted);
  font-size: var(--fs-small);
}

.group-card .wb-field-error {
  margin-bottom: var(--sp-5);
  color: var(--wb-danger);
}

.code-label {
  margin-bottom: var(--sp-2);
  color: var(--wb-ink);
  font-weight: 500;
}

.group-input {
  min-height: 44px;
  padding: var(--sp-3) var(--sp-4);
  border-color: var(--wb-control);
  border-radius: var(--r-control);
  font-size: var(--fs-lead);
  letter-spacing: 0.1em;
}

.group-input::placeholder {
  color: var(--wb-muted);
  letter-spacing: 0;
}

.group-button {
  width: 100%;
  margin-top: auto;
}
</style>
