// Promise-based confirm dialog (design.md §2.5). Replaces native confirm().
// if (!(await confirm({ title: 'Delete your signpost at Blk 55?', confirmLabel: 'Delete signpost' }))) return

export interface ConfirmOptions {
  title: string
  body?: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

const current = ref<ConfirmState | null>(null)

function settle(ok: boolean) {
  current.value?.resolve(ok)
  current.value = null
}

export function useConfirm() {
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    // a second request cancels the first rather than queueing
    if (current.value) settle(false)
    return new Promise(resolve => {
      current.value = { danger: true, cancelLabel: 'Cancel', ...opts, resolve }
    })
  }
  return { confirm, current, settle }
}
