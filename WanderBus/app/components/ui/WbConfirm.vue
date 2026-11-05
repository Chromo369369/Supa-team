<!-- Confirm dialog (design.md §2.5). Mounted once in layouts/default.vue; driven by useConfirm().
     Native <dialog> gives focus trapping, Esc to cancel and returns focus to the opener. -->
<script setup lang="ts">
const { current, settle } = useConfirm()
const dialog = ref<HTMLDialogElement | null>(null)
const cancelBtn = ref<HTMLButtonElement | null>(null)

watch(current, async (val) => {
  await nextTick()
  if (!dialog.value) return
  if (val && !dialog.value.open) {
    dialog.value.showModal()
    // safe default: focus Cancel, not the destructive action
    cancelBtn.value?.focus()
  } else if (!val && dialog.value.open) {
    dialog.value.close()
  }
})

function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value) settle(false)
}
</script>

<template>
  <dialog
    ref="dialog"
    class="wb-confirm"
    aria-labelledby="wb-confirm-title"
    :aria-describedby="current?.body ? 'wb-confirm-body' : undefined"
    @cancel.prevent="settle(false)"
    @click="onBackdrop"
  >
    <div v-if="current" class="wb-confirm-inner">
      <h2 id="wb-confirm-title" class="wb-confirm-title">{{ current.title }}</h2>
      <p v-if="current.body" id="wb-confirm-body" class="wb-confirm-body">{{ current.body }}</p>
      <div class="wb-confirm-actions">
        <button ref="cancelBtn" type="button" class="btn-wb-secondary" @click="settle(false)">
          {{ current.cancelLabel }}
        </button>
        <button type="button" :class="current.danger ? 'btn-wb-danger' : 'btn-wb-primary'" @click="settle(true)">
          {{ current.confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.wb-confirm {
  width: min(440px, calc(100vw - 2 * var(--gutter)));
  padding: 0;
  border: 0;
  border-radius: var(--r-card);
  background: var(--wb-surface);
  color: var(--wb-ink);
  box-shadow: var(--wb-float); /* taste-skill-ignore: floating overlay */
}
.wb-confirm::backdrop { background: rgba(20, 26, 51, .5); }

.wb-confirm-inner { padding: var(--sp-5); }

.wb-confirm-title {
  margin: 0 0 var(--sp-2);
  font-family: var(--font-ui);
  font-size: var(--fs-lead);
  font-weight: 600;
}

.wb-confirm-body {
  margin: 0;
  color: var(--wb-text-2);
}

.wb-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-top: var(--sp-5);
}
</style>
