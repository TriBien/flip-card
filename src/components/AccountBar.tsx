import type { DriveSyncStatus } from '../hooks/useDriveSync'
import type { GoogleProfile } from '../lib/google'
import { formatDuration } from '../lib/scheduler'
import { ArrowRightIcon, GoogleIcon, SignOutIcon } from './Icons'

interface AccountBarProps {
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

export default function AccountBar({
  status,
  user,
  lastSyncedAt,
  error,
  now,
  onSignIn,
  onSignOut,
  onRetry,
}: AccountBarProps) {
  if (!user) {
    const connecting = status === 'connecting'
    return (
      <div className="account">
        <button
          type="button"
          className="account-bar account-bar--signin"
          onClick={onSignIn}
          disabled={connecting}
        >
          <span className="account-bar__google">
            <GoogleIcon />
          </span>
          <span className="account-bar__copy">
            <strong>{connecting ? 'Connecting to Google…' : 'Sign in with Google'}</strong>
            <small>Sync your deck across devices</small>
          </span>
          <span className="account-bar__arrow">
            {connecting ? (
              <span className="account-bar__spinner" aria-hidden="true" />
            ) : (
              <ArrowRightIcon />
            )}
          </span>
        </button>
        {error && <p className="account-bar__error">{error}</p>}
      </div>
    )
  }

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

  const displayName = user.name || user.email || 'Google account'
  const busy = status === 'syncing' || status === 'connecting'

  return (
    <div className="account">
      <div className="account-bar">
        <span className="account-bar__avatar">
          {user.picture ? (
            <img src={user.picture} alt="" referrerPolicy="no-referrer" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </span>
        <span className="account-bar__copy">
          <strong>{displayName}</strong>
          <small className={status === 'error' ? 'is-error' : undefined}>
            {label}
          </small>
        </span>
        <span
          className={`account-bar__dot${busy ? ' is-syncing' : ''}${
            status === 'error' ? ' is-error' : ''
          }`}
          aria-hidden="true"
        />
        {status === 'error' && (
          <button
            type="button"
            className="account-bar__retry"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={onSignOut}
          aria-label="Sign out of Google"
        >
          <SignOutIcon />
        </button>
      </div>
      {error && <p className="account-bar__error">{error}</p>}
    </div>
  )
}
