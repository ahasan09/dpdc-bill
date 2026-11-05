import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
  tone: 'info' | 'error'
  action?: { label: string; onClick: () => void }
}

type ShowToast = (
  message: string,
  opts?: { tone?: 'info' | 'error'; action?: ToastItem['action']; duration?: number },
) => void

const ToastContext = createContext<ShowToast>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const show = useCallback<ShowToast>(
    (message, opts = {}) => {
      const id = nextId.current++
      setToasts((all) => [...all.slice(-2), { id, message, tone: opts.tone ?? 'info', action: opts.action }])
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3500))
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  t.action?.onClick()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ShowToast {
  return useContext(ToastContext)
}
