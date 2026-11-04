<!-- Shared frame for the login and register forms: an LED sign above a card. -->
<script setup>
import { computed, ref } from 'vue'
import LedBoard from '~/components/ui/LedBoard.vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'

const props = defineProps({
    title: { type: String, required: true },
    intro: { type: String, default: '' },
    /** Messages for the LED sign, e.g. [['WELCOME BACK', 'EXPLORER']] */
    sign: { type: Array, required: true },
    signLabel: { type: String, default: '' },
    /** Override the mascot's mood, e.g. 'happy' on "Check your inbox". Empty = peek / cover-eyes. */
    mascotMood: { type: String, default: '' }
})

// The mascot covers its eyes while a slotted password field has focus.
// Listening on the card keeps login.vue and register.vue untouched.
const coverEyes = ref(false)
const isPassword = el => el instanceof HTMLInputElement && el.type === 'password'
function onFocusIn(e) { coverEyes.value = isPassword(e.target) }
function onFocusOut(e) { coverEyes.value = isPassword(e.relatedTarget) }

const mood = computed(() => props.mascotMood || (coverEyes.value ? 'cover-eyes' : 'peek'))
</script>

<template>
    <div class="auth-page">
        <div class="auth-frame">
            <WanderMascot class="auth-mascot" :mood="mood" :size="88" gaze />
            <section class="auth-card" aria-labelledby="auth-title" @focusin="onFocusIn" @focusout="onFocusOut">
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

/* The mascot sits behind the card, so the card's top edge hides its lower half. */
.auth-frame {
  position: relative;
  width: 100%;
  max-width: 28rem;
  margin-top: 52px;
}

.auth-mascot {
  position: absolute;
  z-index: 0;
  top: -52px;
  right: var(--sp-6);
}

.auth-card {
  position: relative;
  z-index: 1;
  width: 100%;
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
