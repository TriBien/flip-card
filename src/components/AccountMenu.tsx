import { useEffect, useRef, useState } from 'react'
import type { DriveSyncStatus } from '../hooks/useDriveSync'
import type { GoogleProfile } from '../lib/google'
import { formatDuration } from '../lib/scheduler'
import { GoogleIcon, SignOutIcon, UserIcon } from './Icons'

interface AccountMenuProps {
  status: DriveSyncStatus
  user: GoogleProfile | null
  lastSyncedAt: number | null
  error: string | null
  now: number
  onSignIn: () => void
  onSignOut: () => void
  onRetry: () => void
}

function syncedLabel(lastSyncedAt: number, now: number): string {
  if (!lastSyncedAt) return 'Connected to Google Drive'
  const ago = Math.max(0, now - lastSyncedAt)
  if (ago < 30_000) return 'Synced just now'
  return `Synced ${formatDuration(ago)} ago`
}

export default function AccountMenu({
  status,
  user,
  lastSyncedAt,
  error,
  now,
  onSignIn,
  onSignOut,
  onRetry,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const connecting = status === 'connecting'
  const busy = status === 'syncing' || status === 'connecting'
  const label =
    status === 'connecting'
      ? 'Connecting to Google…'
      : status === 'syncing'
        ? 'Syncing to Google Drive…'
        : status === 'error'
          ? 'Sync paused'
          : lastSyncedAt
            ? syncedLabel(lastSyncedAt, now)
            : 'Connected to Google Drive'
  const displayName = user?.name || user?.email || 'Google account'
  const dotTone =
    status === 'error' ? 'is-error' : busy ? 'is-busy' : user ? 'is-online' : null

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="user-btn"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? `Google account: ${displayName}` : 'Google account'}
      >
        <span className="user-btn__face">
          {user?.picture ? (
            <img src={user.picture} alt="" referrerPolicy="no-referrer" />
          ) : (
            <UserIcon />
          )}
        </span>
        {dotTone && (
          <span className={`user-btn__dot ${dotTone}`} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="account-pop" role="menu">
          <div className="account-pop__head">
            <span className="account-pop__avatar">
              {user?.picture ? (
                <img src={user.picture} alt="" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon />
              )}
            </span>
            <span className="account-pop__copy">
              <strong>{user ? displayName : 'Google Drive'}</strong>
              <small className={status === 'error' ? 'is-error' : undefined}>
                {user
                  ? label
                  : connecting
                    ? 'Connecting to Google…'
                    : 'Not connected'}
              </small>
            </span>
          </div>

          {user ? (
            <div className="account-pop__actions">
              {status === 'error' && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setOpen(false)
                    onRetry()
                  }}
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setOpen(false)
                  onSignOut()
                }}
              >
                <SignOutIcon /> Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--primary account-pop__action"
              onClick={() => {
                setOpen(false)
                onSignIn()
              }}
              disabled={connecting}
            >
              <GoogleIcon /> {connecting ? 'Connecting…' : 'Sign in with Google'}
            </button>
          )}

          {error && <p className="account-pop__error">{error}</p>}
        </div>
      )}
    </div>
  )
}
