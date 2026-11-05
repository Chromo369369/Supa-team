<!-- Toast stack (design.md §2.5). Mounted once in layouts/default.vue; driven by useToast(). -->
<script setup lang="ts">
import WanderMascot from '~/components/ui/WanderMascot.vue'

const { toasts, dismiss } = useToast()

// The mascot is the toast icon: it hops for a success, droops for an error, waves for info.
const mascot = {
  success: { mood: 'happy', color: 'var(--wb-green)' },
  error: { mood: 'sad', color: 'var(--wb-danger)' },
  info: { mood: 'wave', color: 'var(--wb-amber)' },
} as const

function runAction(id: number, run: () => void) {
  dismiss(id)
  run()
}
</script>

<template>
  <!-- Two live regions so errors interrupt and successes don't -->
  <div class="wb-toasts">
    <TransitionGroup name="wb-toast" tag="div" class="wb-toast-list" role="status" aria-live="polite">
      <div
        v-for="t in toasts.filter(t => t.variant !== 'error')"
        :key="t.id"
        class="wb-toast"
        :class="`wb-toast-${t.variant}`"
      >
        <WanderMascot class="wb-toast-icon" :mood="mascot[t.variant].mood" :color="mascot[t.variant].color" :size="32" />
        <p class="wb-toast-msg">{{ t.message }}</p>
        <button v-if="t.action" type="button" class="btn-wb-ghost btn-sm" @click="runAction(t.id, t.action.run)">
          {{ t.action.label }}
        </button>
        <button type="button" class="wb-toast-close" aria-label="Dismiss" @click="dismiss(t.id)">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>
    </TransitionGroup>
    <TransitionGroup name="wb-toast" tag="div" class="wb-toast-list" role="alert" aria-live="assertive">
      <div
        v-for="t in toasts.filter(t => t.variant === 'error')"
        :key="t.id"
        class="wb-toast wb-toast-error"
      >
        <WanderMascot class="wb-toast-icon" :mood="mascot.error.mood" :color="mascot.error.color" :size="32" />
        <p class="wb-toast-msg">{{ t.message }}</p>
        <button v-if="t.action" type="button" class="btn-wb-ghost btn-sm" @click="runAction(t.id, t.action.run)">
          {{ t.action.label }}
        </button>
        <button type="button" class="wb-toast-close" aria-label="Dismiss" @click="dismiss(t.id)">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.wb-toasts {
  position: fixed;
  z-index: 1090;
  top: var(--sp-4);
  left: var(--gutter);
  right: var(--gutter);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  pointer-events: none;
}

.wb-toast-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  width: 100%;
  max-width: 420px;
}

.wb-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-4);
  background: var(--wb-surface);
  color: var(--wb-ink);
  border-radius: var(--r-control);
  border-left: 6px solid var(--wb-ink);
  box-shadow: var(--wb-float); /* taste-skill-ignore: floating overlay */
}

.wb-toast-success { border-left-color: var(--wb-green); }
.wb-toast-error { border-left-color: var(--wb-danger); }

.wb-toast-icon { flex-shrink: 0; }

.wb-toast-msg {
  flex: 1;
  margin: 0;
  font-size: var(--fs-small);
  line-height: 1.4;
}

.wb-toast-close {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--r-control);
  background: transparent;
  color: var(--wb-text-2);
}
.wb-toast-close:hover { background: var(--wb-surface-2); color: var(--wb-ink); }
.wb-toast-close:focus-visible { outline: 3px solid var(--wb-green); outline-offset: 2px; }

.wb-toast-enter-active,
.wb-toast-leave-active { transition: transform var(--t-ui) var(--ease), opacity var(--t-ui) var(--ease); }
.wb-toast-enter-from { transform: translateY(-12px); opacity: 0; }
.wb-toast-leave-to { opacity: 0; }

@media (min-width: 768px) {
  .wb-toasts {
    top: auto;
    bottom: var(--sp-5);
    left: auto;
    right: var(--sp-5);
    align-items: flex-end;
  }
  .wb-toast-enter-from { transform: translateY(12px); }
}
</style>
