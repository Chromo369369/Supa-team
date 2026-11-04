<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['leave'])

const props = defineProps({
  group: {
    type: Object,
    required: true
  }
})

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
const hostLeft = ref(false)


onMounted(async () => {
  try {
    const { data: userData, error: userError } = await $supabase.auth.getUser()
    if (userError) throw userError

    currentUserId.value = userData.user.id

    const { data: groupDetails, error: groupError } = await $supabase
      .from('groups')
      .select('host_id')
      .eq('group_code', props.group.group_code)
      .maybeSingle()

    if (groupError) throw groupError
    // the host leaving deletes the group row, so a missing group means the host left
    if (!groupDetails) {
      hostLeft.value = true
      return
    }

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
  } catch {
    membersError.value = 'Couldn’t load your crew. Refresh the page to try again.'
  } finally {
    loadingMembers.value = false
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
        <div v-else class="member-row">
          <i class="bi bi-award-fill host-icon" aria-hidden="true"></i>
          <div class="member-details">
            <strong>{{ hostName }}</strong>
            <span>Host</span>
          </div>
        </div>

        <div class="waiting-box" aria-live="polite">
          <span v-if="loadingMembers">Loading your crew…</span>
          <span v-else-if="membersError" role="alert">{{ membersError }}</span>
          <span v-else-if="groupMembers.length == 0">
            Waiting for friends to join…
          </span>
          <ul v-else class="member-list">
            <li
              v-for="member in groupMembers"
              :key="member.user_id"
            >
              <i class="bi bi-person" aria-hidden="true"></i>
              {{ member.display_name }}
            </li>
          </ul>
        </div>

        <p v-if="!isHost && !loadingMembers && !hostLeft" id="spin-hint" class="spin-hint">
          Only the host can start the spin.
        </p>
        <button
          type="button"
          class="btn-wb-primary lobby-button"
          :disabled="!isHost || hostLeft"
          :aria-describedby="!isHost && !loadingMembers && !hostLeft ? 'spin-hint' : undefined"
        >
          Spin for the crew
        </button>
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

.member-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--wb-ink);
  overflow-wrap: anywhere;
}

.member-list .bi {
  margin-right: var(--sp-1);
  color: var(--wb-text-2);
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
