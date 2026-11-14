import { toast as sonner } from 'sonner'

type ShowToast = (
  message: string,
  opts?: { tone?: 'info' | 'error'; action?: { label: string; onClick: () => void }; duration?: number },
) => void

const show: ShowToast = (message, opts = {}) => {
  const fn = opts.tone === 'error' ? sonner.error : sonner
  fn(message, {
    duration: opts.duration ?? (opts.action ? 6000 : 3500),
    action: opts.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined,
  })
}

/** Same call shape the components already use; sonner renders the toasts (see <Toaster /> in App). */
export function useToast(): ShowToast {
  return show
}
