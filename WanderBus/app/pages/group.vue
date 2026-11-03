<script setup>
import { ref, onMounted } from 'vue'
import GroupLobby from '../components/group/GroupLobby.vue'

definePageMeta( {middleware: 'auth' })

const { $supabase } = useNuxtApp()
const showLobby = ref(false)
const currentGroup = ref(null)
const creatingGroup = ref(false)
const groupCode = ref('')
const joiningGroup = ref(false)
const joinError = ref('')
const alreadyInGroup = ref(false)
const checkingMembership = ref(true)

onMounted(async () => {
  try {
    const { data, error } = await $supabase.auth.getUser()
    if (error) throw error

    if (!data.user) return

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
  } catch (error) {
    console.log(error)
    joinError.value = 'Unable to check your current group.'
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
    alreadyInGroup.value
  ) {
    return
  }

  creatingGroup.value = true

  try {
    const { data, error } = await $supabase.auth.getUser()

    if (error) {
      alert(error.message)
      return
    }

    if (!data.user) {
      alert('Please log in first')
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
      alert(e.message)
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
      alert(groupError.message)
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
      alert(memberError.message)
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
    checkingMembership.value
  ) return

  joinError.value = ''
  const code = groupCode.value.trim()

  if (code.length != 6) {
    joinError.value = 'Please enter valid group code'
    return
  }

  joiningGroup.value = true

  try {
    const { data: authData, error: authError } = await $supabase.auth.getUser()
    if (authError) throw authError

    if (!authData.user) {
      joinError.value = 'Please log in first'
      return
    }

    const { data: group, error } = await $supabase
      .from('groups')
      .select('group_code')
      .eq('group_code', code)
      .maybeSingle()

    if (error) throw error

    if (!group) {
      joinError.value = 'Group not found.'
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
  } catch {
    
    joinError.value = 'Unable to open this group'
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
  <section class="container py-4">
    <h1 class="page-title">Explore together</h1>
    <p class="page-description">
      Gather your friends and let WanderBus choose your next side quest.
    </p>

    <div v-if="!showLobby" class="row g-4 mt-2">
      <!-- Host card -->
      <div class="col-12 col-md-6">
        <div class="group-card">
          <span class="card-icon" aria-hidden="true">🚌</span>
          <h2>Host a trip</h2>
          <p>Create a group and invite your friends with a group code.</p>

          <button
            type="button"
            class="group-button host-button"
            :disabled="creatingGroup || joiningGroup || checkingMembership || alreadyInGroup"
            @click="createGroup"
            >
            {{ creatingGroup ? 'Creating group...' : 'Create a group' }}
            </button>
        </div>
      </div>
      

      <!-- Join card -->
      <div class="col-12 col-md-6">
        <div class="group-card">
          <span class="card-icon" aria-hidden="true">👋</span>
          <h2>Join your friends</h2>
          <p>Have a group code? Enter it below to join their adventure.</p>

          <label for="Group-code" class="code-label">Group code</label>
          <input
            id="Group-code"
            v-model="groupCode"
            inputmode="numeric"
            maxlength="6"
            :disabled="joiningGroup || creatingGroup || checkingMembership || alreadyInGroup"
            :aria-invalid="joinError != ''"
            :aria-describedby="joinError ? 'join-error' : undefined"
            @keyup.enter="joinGroup"
            type="text"
            class="form-control group-input"
            placeholder="Enter Group code"
          >
            <br>
          <p v-if="joinError" id="join-error" class="text-danger" >
            {{ joinError }}
          </p>
          <p v-if="alreadyInGroup" class="text-muted">
            You are already in a group.
          </p>
          <button
            type="button"
            class="group-button join-button"
            :disabled="joiningGroup || creatingGroup || checkingMembership"
            @click="openGroup"
          >
            {{ alreadyInGroup ? 'View your group' : 'Join a group' }}
          </button>
        </div>
      </div>
    </div>
    <GroupLobby v-else :group="currentGroup" @leave="resetEverything"/>
  </section>
</template>

<style scoped>
.page-title {
  font-size: 2.4rem;
  font-weight: 800;
  color: #141a33;
}

.page-description {
  color: #4a5068;
}

.group-card {
  height: 100%;
  padding: 32px;
  border: 1px solid #e3e5ec;
  border-radius: 20px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.card-icon {
  font-size: 2.5rem;
  margin-bottom: 16px;
}

.group-card h2 {
  color: #141a33;
  font-size: 1.5rem;
  font-weight: 700;
}

.group-card p {
  color: #4a5068;
  margin-bottom: 24px;
}

.code-label {
  color: #141a33;
  font-weight: 600;
  margin-bottom: 8px;
}

.group-input {
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 20px;
}

.group-button {
  width: 100%;
  margin-top: auto;
  padding: 12px 22px;
  border: none;
  border-radius: 50px;
  font-weight: 600;
  color: #fff;
}

.group-button:disabled {
  opacity: 0.55;
}

.host-button {
  background: #141a33;
}

.host-button:hover {
  background: #2a3150;
}

.join-button {
  background: #0b7a4b;
}

.join-button:hover {
  background: #096640;
}

</style>
