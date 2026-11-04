// Shared toast queue (design.md §2.5). Replaces every alert().
// toast.success('Saved to your passport')
// toast.error('Could not save your trip.', { action: { label: 'Retry', run: save } })

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  variant: ToastVariant
  message: string
  action?: ToastAction
}

interface ToastOptions {
  action?: ToastAction
  // ms before auto-dismiss; errors default to sticky (0)
  duration?: number
}

const toasts = ref<Toast[]>([])
let nextId = 1

function dismiss(id: number) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

function push(variant: ToastVariant, message: string, opts: ToastOptions = {}) {
  const id = nextId++
  toasts.value.push({ id, variant, message, action: opts.action })
  const duration = opts.duration ?? (variant === 'error' ? 0 : 4000)
  if (duration > 0) setTimeout(() => dismiss(id), duration)
  return id
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (message: string, opts?: ToastOptions) => push('success', message, opts),
    error: (message: string, opts?: ToastOptions) => push('error', message, opts),
    info: (message: string, opts?: ToastOptions) => push('info', message, opts),
  }
}
