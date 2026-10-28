<script setup>
import { ref } from 'vue'
import GroupLobby from '~/components/group/GroupLobby.vue'
//Check for session validity
definePageMeta( {middleware: 'auth' })

const showLobby = ref(false)
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
            @click="showLobby = true"
            >
            Create a group
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
            type="text"
            class="form-control group-input"
            placeholder="Enter Group code"
          >
            <br>
          <button type="button" class="group-button join-button">
            Join a group
          </button>
        </div>
      </div>
    </div>
    <GroupLobby v-else @leave="showLobby = false"/>
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