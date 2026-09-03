import { useEffect, useRef, useState } from 'react'

import * as api from '../api'
import type { User } from '../types/auth'

type AccountMenuProps = {
  user: User
  onNavigate: (path: string) => void
  onSignedOut: () => Promise<void>
}

function initialsFromEmail(email: string) {
  const localPart = email.split('@', 1)[0] ?? ''
  const parts = localPart.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : (parts[0] ?? '').slice(0, 2)

  return initials.toLocaleUpperCase() || '?'
}

export function AccountMenu({ user, onNavigate, onSignedOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open || logoutPending) return

    function dismissOutside(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function dismissWithEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissWithEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissWithEscape)
    }
  }, [logoutPending, open])

  function openProfile() {
    setOpen(false)
    if (window.location.pathname !== '/profile') onNavigate('/profile')
  }

  async function signOut() {
    setLogoutPending(true)
    setLogoutError('')
    try {
      await api.logout()
      await onSignedOut()
    } catch (caught) {
      setLogoutError(caught instanceof Error ? caught.message : 'Could not sign out.')
    } finally {
      setLogoutPending(false)
    }
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${user.email}`}
        className="account-avatar"
        disabled={logoutPending}
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) setLogoutError('')
          setOpen((current) => !current)
        }}
      >
        {initialsFromEmail(user.email)}
      </button>
      {open && (
        <div className="account-menu-popover">
          <div role="menu">
            <button disabled={logoutPending} role="menuitem" type="button" onClick={openProfile}>Profile</button>
            <button disabled={logoutPending} role="menuitem" type="button" onClick={() => void signOut()}>
              {logoutPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
          {logoutError && <p className="account-menu-error" role="alert">{logoutError}</p>}
        </div>
      )}
    </div>
  )
}
