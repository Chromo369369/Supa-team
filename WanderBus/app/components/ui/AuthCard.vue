<!-- Shared frame for the login and register forms: an LED sign above a card. -->
<script setup>
import LedBoard from '~/components/ui/LedBoard.vue'

defineProps({
    title: { type: String, required: true },
    intro: { type: String, default: '' },
    /** Messages for the LED sign, e.g. [['WELCOME BACK', 'EXPLORER']] */
    sign: { type: Array, required: true },
    signLabel: { type: String, default: '' }
})
</script>

<template>
    <div class="auth-page">
        <section class="auth-card" aria-labelledby="auth-title">
            <LedBoard class="auth-sign" badge="WB" :messages="sign" :label="signLabel" />
            <div class="auth-body">
                <h1 id="auth-title" class="auth-title">{{ title }}</h1>
                <p v-if="intro" class="auth-intro">{{ intro }}</p>
                <slot />
                <p v-if="$slots.footer" class="auth-switch">
                    <slot name="footer" />
                </p>
            </div>
        </section>
    </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100%;
  margin: -20px;
  padding: 40px 16px 64px;
  background-color: #f9f9fb;
  background-image: radial-gradient(#e3e5ec 1px, transparent 1px);
  background-size: 22px 22px;
}

.auth-card {
  width: 100%;
  max-width: 28rem;
  background: #fff;
  border: 1px solid #e3e5ec;
  border-radius: 20px;
  box-shadow: 0 12px 32px rgba(20, 26, 51, 0.1);
  overflow: hidden;
}

.auth-sign {
  border-radius: 0;
}

.auth-body {
  padding: 24px;
}

@media (min-width: 576px) {
  .auth-body {
    padding: 32px;
  }
}

.auth-title {
  margin-bottom: 4px;
  font-size: 1.8rem;
  font-weight: 800;
  color: #141a33;
}

.auth-intro {
  color: #6b7085;
}

.auth-body :deep(.auth-form) {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.auth-body :deep(.form-label) {
  margin-bottom: 6px;
  font-weight: 600;
  color: #141a33;
}

.auth-body :deep(.form-control) {
  padding: 10px 12px;
  border: 1px solid #c9ccd6;
  border-radius: 12px;
}

.auth-body :deep(.form-control:focus) {
  border-color: #0b7a4b;
  box-shadow: 0 0 0 3px rgba(11, 122, 75, 0.2);
}

.auth-body :deep(.btn-wb-green) {
  padding: 12px 28px;
  border-radius: 50px;
  background: #0b7a4b;
  color: #fff;
  font-weight: 700;
}

.auth-body :deep(.btn-wb-green:hover) {
  background: #096640;
  color: #fff;
}

.auth-body :deep(.btn-wb-green:disabled) {
  background: #9cc9b5;
  color: #fff;
}

.auth-switch {
  margin-top: 24px;
  text-align: center;
  color: #4a5068;
}

.auth-switch :deep(a) {
  color: #0b7a4b;
  font-weight: 600;
}
</style>
