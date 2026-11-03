<script setup>
import { ref, onMounted } from 'vue'

defineEmits(['leave'])

const props = defineProps({
  group: {
    type: Object,
    required: true
  }
})

const { $supabase } = useNuxtApp()
const hostName = ref('Host')
const isHost = ref(false)
const groupMembers = ref([])
const loadingMembers = ref(true)
const membersError = ref('')


onMounted(async () => {
  try {
    const { data: userData, error: userError } = await $supabase.auth.getUser()
    if (userError) throw userError

    const { data: groupDetails, error: groupError } = await $supabase
      .from('groups')
      .select('host_id')
      .eq('group_code', props.group.group_code)
      .maybeSingle()

    if (groupError) throw groupError
    if (!groupDetails) throw new Error('Group not found')

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

    hostName.value = host.display_name
    groupMembers.value = allMembers.filter(
      member => member.user_id != groupDetails.host_id
    )
  } catch {
    membersError.value = 'Unable to load group members.'
  } finally {
    loadingMembers.value = false
  }
})
</script>

<template>
  <div class="row g-4 mt-2">
    <div class="col-12 col-lg-4">
      <div class="lobby-card p-4 p-sm-5">

        <h2>Everyone aboard?</h2>
        <p>Wait here while everyone joins the group.</p>

        <span class="code-label">Group code</span>
        <div class="group-code">{{ group.group_code }}</div>

        <button
          type="button"
          class="lobby-button dark-button"
          @click="$emit('leave')"
        >
          Leave group
        </button>
      </div>
    </div>

    <div class="col-12 col-lg-8">
      <div class="lobby-card">
        <div class="lobby-heading">
          <h2>Trip lobby</h2>
        </div>

        <p>Gather your friends before spinning your next adventure.</p>

        <div class="member-row">
          <div class="member-details">
            <strong>{{ hostName }}</strong>
            <span>Ready to explore</span>
          </div>

        </div>

        <div class="waiting-box">
          <span v-if="loadingMembers">Loading group members...</span>
          <span v-else-if="membersError">{{ membersError }}</span>
          <span v-else-if="groupMembers.length == 0">
            Waiting for friends to join.
          </span>
          <template v-else>
            <span
              v-for="member in groupMembers"
              :key="member.user_id"
            >
              {{ member.display_name }}
            </span>
          </template>
        </div>

        <button
          type="button"
          class="lobby-button green-button"
          :disabled="!isHost"
        >
          Ready? Let's Spin!
        </button>

      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby-card {
  height: 100%;
  padding: 32px;
  background: #fff;
  border: 1px solid #e3e5ec;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
}

.lobby-card h2 {
  color: #141a33;
  font-size: 1.5rem;
  font-weight: 700;
}

.lobby-card p {
  color: #4a5068;
}


.code-label {
  margin: 12px 0 8px;
  color: #141a33;
  font-weight: 600;
}

.group-code {
  width: 100%;
  min-width: 0;
  padding: 20px 8px;
  margin-bottom: 20px;
  border: 1px dashed #b9c1ce;
  border-radius: 12px;
  background: #f6f8fb;
  color: #141a33;
  text-align: center;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 4px;
}

.lobby-button {
  width: 100%;
  padding: 12px 22px;
  border: none;
  border-radius: 50px;
  color: #fff;
  font-weight: 600;
}

.dark-button {
  background: #141a33;
}

.green-button {
  background: #0b7a4b;
}

.lobby-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.lobby-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.lobby-heading h2 {
  margin: 0;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #e3e5ec;
}

.member-details {
  display: flex;
  flex-direction: column;
  flex: 1;
  color: #141a33;
}

.member-details span {
  color: #4a5068;
  font-size: 0.85rem;
}

.waiting-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 24px 0;
  padding: 28px 16px;
  border-radius: 12px;
  background: #f6f8fb;
  text-align: center;
  color: #4a5068;
}

</style>
