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
/* Sits straight on the page ground (no dotted grid); the card is a flat surface (design.md §4.2). */
.auth-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100%;
  padding: var(--sp-5) 0 var(--sp-8);
}

.auth-card {
  width: 100%;
  max-width: 28rem;
  background: var(--wb-surface);
  border-radius: var(--r-card);
  overflow: hidden;
}

.auth-sign {
  border-radius: 0;
}

.auth-body {
  padding: var(--sp-5);
}

@media (min-width: 576px) {
  .auth-body {
    padding: var(--sp-6);
  }
}

.auth-title {
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-title);
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.auth-intro {
  margin: 0;
  color: var(--wb-text-2);
}

.auth-body :deep(.auth-form) {
  display: grid;
  gap: var(--sp-4);
  margin-top: var(--sp-5);
}

.auth-body :deep(.form-label) {
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--wb-ink);
}

.auth-body :deep(.form-control) {
  padding: 10px 12px; /* border, radius and focus ring come from main.css */
}

.auth-switch {
  margin: var(--sp-5) 0 0;
  text-align: center;
  color: var(--wb-text-2);
}

.auth-switch :deep(a) {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--wb-green);
  font-weight: 600;
}
</style>
