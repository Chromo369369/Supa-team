<script setup>
import { ref, onMounted } from 'vue'

defineEmits(['leave'])

const { $supabase } = useNuxtApp()
const hostEmail = ref('Loading email...')
const groupCode = Math.floor(100000 + Math.random() * 900000)

onMounted(async () => {
  try {
    const { data, error } = await $supabase.auth.getUser()
    if (error) throw error
    if (data.user && data.user.email) {
      hostEmail.value = data.user.email
    } else {
      hostEmail.value = 'Email unavailable'
    }
  } catch {
    hostEmail.value = 'Email unavailable'
  }
})
</script>

<template>
  <div class="row g-4 mt-2">
    <div class="col-12 col-lg-4">
      <div class="lobby-card p-4 p-sm-5">

        <h2>Everyone aboard?</h2>
        <p>Invite your friends along for your next side quest.</p>

        <span class="code-label">Group code</span>
        <div class="group-code">{{ groupCode }}</div>

        <button
          type="button"
          class="lobby-button dark-button"
        >
          Copy group code
        </button>

        <button
          type="button"
          class="leave-button"
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
            <strong>{{ hostEmail }}</strong>
            <span>Ready to explore</span>
          </div>

          <span class="host-badge">Host</span>
        </div>

        <div class="waiting-box">
          <span>(frined list)</span>
        </div>

        <button
          type="button"
          class="lobby-button green-button"
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

.leave-button {
  align-self: center;
  margin-top: auto;
  padding: 8px;
  border: none;
  background: transparent;
  color: #4a5068;
  text-decoration: underline;
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

.host-badge {
  padding: 6px 12px;
  border-radius: 50px;
  background: #eaf5ef;
  color: #0b7a4b;
  font-size: 0.85rem;
  font-weight: 600;
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