import type { MouseEvent } from 'react'

export type OpenMode = 'popup' | 'tab'

const POPUP_NAME = 'dpdc-bill'
const POPUP_WIDTH = 1040
const POPUP_HEIGHT = 860

/**
 * Desktop = a mouse or trackpad, whatever the window size (a narrow window or
 * docked DevTools is still a desktop). Phones and tablets keep the normal new tab.
 */
export function prefersPopup(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/**
 * Opens the DPDC page in a centred popup window. A popup is a normal top-level
 * window, so DPDC's security-code cookie works (it does not inside an iframe).
 * Returns false when we shouldn't or couldn't open one (mobile, popup blocked).
 */
export function openBillPopup(url: string): boolean {
  if (!prefersPopup()) return false
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2))
  const win = window.open(
    url,
    POPUP_NAME,
    `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`,
  )
  if (!win) return false
  try {
    win.opener = null // the DPDC page must not be able to control our tab
  } catch {
    /* ignore */
  }
  win.focus()
  return true
}

/**
 * onClick for an <a target="_blank"> pointing at DPDC. On desktop it opens the
 * popup instead; Ctrl/Cmd/Shift/middle-click still open a tab as the user asked.
 * If the popup is blocked the link opens a normal tab.
 */
export function openBillFromLink(e: MouseEvent<HTMLAnchorElement>, url: string): OpenMode {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return 'tab'
  if (openBillPopup(url)) {
    e.preventDefault()
    return 'popup'
  }
  return 'tab'
}
