import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Settings } from '../types'
import {
  DriveError,
  downloadDriveFile,
  findDriveFile,
  saveDriveFile,
} from '../lib/drive'
import {
  fetchGoogleProfile,
  loadGoogleIdentity,
  requestGoogleToken,
  revokeGoogleToken,
  type GoogleProfile,
} from '../lib/google'
import {
  buildPayload,
  dataSignature,
  mergeData,
  normalizeCard,
  normalizeSettings,
  type SyncData,
} from '../lib/sync'

const SESSION_KEY = 'flipwise.google.session.v1'
const SYNC_DEBOUNCE = 1200

export type DriveSyncStatus =
  | 'signed-out'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'error'

export interface DriveSyncState {
  status: DriveSyncStatus
  user: GoogleProfile | null
  lastSyncedAt: number | null
  error: string | null
  signIn: () => void
  signOut: () => void
  retry: () => void
}

interface Session {
  accessToken: string
  expiresAt: number
  user: GoogleProfile
}

interface UseDriveSyncOptions {
  cards: Card[]
  settings: Settings
  hasLocalChanges: boolean
  onRemoteData: (data: SyncData) => void
  onNotice: (message: string) => void
}

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    if (
      !session.accessToken ||
      !session.expiresAt ||
      session.expiresAt <= Date.now() + 30_000
    ) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

function storeSession(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    return
  }
}

export function useDriveSync({
  cards,
  settings,
  hasLocalChanges,
  onRemoteData,
  onNotice,
}: UseDriveSyncOptions): DriveSyncState {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [connecting, setConnecting] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  const cardsRef = useRef(cards)
  const settingsRef = useRef(settings)
  const sessionRef = useRef<Session | null>(session)
  const fileIdRef = useRef<string | null>(null)
  const lastSignatureRef = useRef<string | null>(null)
  const syncReadyRef = useRef(false)
  const syncedTokenRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const hasLocalChangesRef = useRef(hasLocalChanges)

  useEffect(() => {
    hasLocalChangesRef.current = hasLocalChanges
  }, [hasLocalChanges])

  useEffect(() => {
    cardsRef.current = cards
  }, [cards])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    void loadGoogleIdentity().catch(() => undefined)
  }, [])

  const applySession = useCallback((next: Session | null) => {
    sessionRef.current = next
    setSession(next)
    storeSession(next)
  }, [])

  const handleExpired = useCallback(() => {
    syncReadyRef.current = false
    syncedTokenRef.current = null
    fileIdRef.current = null
    lastSignatureRef.current = null
    applySession(null)
    setSyncStatus('idle')
    setError(null)
    setLastSyncedAt(null)
    onNotice('Google session expired — sign in again')
  }, [applySession, onNotice])

  const syncFromCloud = useCallback(
    async (active: Session) => {
      syncReadyRef.current = false
      setSyncStatus('syncing')
      setError(null)
      try {
        const file = await findDriveFile(active.accessToken)
        const remote = file
          ? await downloadDriveFile(active.accessToken, file.id)
          : null
        const local: SyncData = {
          cards: cardsRef.current.map(normalizeCard),
          settings: settingsRef.current,
        }
        const adoptRemote = remote !== null && !hasLocalChangesRef.current
        const merged = remote
          ? adoptRemote
            ? {
                cards: remote.cards,
                settings: normalizeSettings(remote.settings, local.settings),
              }
            : mergeData(local, remote)
          : local
        const signature = dataSignature(merged.cards, merged.settings)

        if (!mountedRef.current) return
        onRemoteData(merged)

        const savedFileId = await saveDriveFile(
          active.accessToken,
          file?.id ?? null,
          buildPayload(merged),
        )
        if (!mountedRef.current) return

        fileIdRef.current = savedFileId
        lastSignatureRef.current = signature
        syncReadyRef.current = true
        setSyncStatus('idle')
        setLastSyncedAt(Date.now())
        onNotice(
          remote
            ? adoptRemote
              ? 'Deck restored from Google Drive'
              : 'Deck synced from Google Drive'
            : 'Deck backed up to Google Drive',
        )
      } catch (caught) {
        if (!mountedRef.current) return
        if (caught instanceof DriveError && caught.status === 401) {
          handleExpired()
          return
        }
        const message =
          caught instanceof Error
            ? caught.message
            : 'Could not sync with Google Drive'
        setSyncStatus('error')
        setError(message)
        onNotice(message)
      }
    },
    [handleExpired, onNotice, onRemoteData],
  )

  const signIn = useCallback(() => {
    if (connecting || sessionRef.current) return
    setConnecting(true)
    setError(null)
    void (async () => {
      try {
        const token = await requestGoogleToken('select_account')
        let user: GoogleProfile = {}
        try {
          user = await fetchGoogleProfile(token.accessToken)
        } catch {
          user = {}
        }
        applySession({
          accessToken: token.accessToken,
          expiresAt: Date.now() + (token.expiresIn || 3600) * 1000,
          user,
        })
      } catch (caught) {
        if (!mountedRef.current) return
        const raw =
          caught instanceof Error ? caught.message : 'Google sign-in failed'
        const message = /popup|closed|cancel/i.test(raw)
          ? 'Google sign-in was cancelled'
          : raw
        setError(message)
        onNotice(message)
      } finally {
        if (mountedRef.current) setConnecting(false)
      }
    })()
  }, [applySession, connecting, onNotice])

  const signOut = useCallback(() => {
    const active = sessionRef.current
    if (active) revokeGoogleToken(active.accessToken)
    syncReadyRef.current = false
    syncedTokenRef.current = null
    fileIdRef.current = null
    lastSignatureRef.current = null
    applySession(null)
    setSyncStatus('idle')
    setError(null)
    setLastSyncedAt(null)
    onNotice('Signed out of Google')
  }, [applySession, onNotice])

  const retry = useCallback(() => {
    const active = sessionRef.current
    if (!active) return
    syncedTokenRef.current = active.accessToken
    void syncFromCloud(active)
  }, [syncFromCloud])

  useEffect(() => {
    if (!session) {
      syncedTokenRef.current = null
      return
    }
    if (syncedTokenRef.current === session.accessToken) return
    syncedTokenRef.current = session.accessToken
    void syncFromCloud(session)
  }, [session, syncFromCloud])

  const signature = useMemo(
    () => dataSignature(cards, settings),
    [cards, settings],
  )

  useEffect(() => {
    if (!session || !syncReadyRef.current) return
    if (lastSignatureRef.current === signature) return
    const active = session

    const timer = window.setTimeout(() => {
      setSyncStatus('syncing')
      setError(null)
      void (async () => {
        try {
          const snapshot: SyncData = {
            cards: cardsRef.current,
            settings: settingsRef.current,
          }
          const savedFileId = await saveDriveFile(
            active.accessToken,
            fileIdRef.current,
            buildPayload(snapshot),
          )
          if (!mountedRef.current) return
          fileIdRef.current = savedFileId
          lastSignatureRef.current = dataSignature(
            snapshot.cards,
            snapshot.settings,
          )
          setSyncStatus('idle')
          setLastSyncedAt(Date.now())
        } catch (caught) {
          if (!mountedRef.current) return
          if (caught instanceof DriveError && caught.status === 401) {
            handleExpired()
            return
          }
          const message =
            caught instanceof Error
              ? caught.message
              : 'Could not save to Google Drive'
          setSyncStatus('error')
          setError(message)
          onNotice(message)
        }
      })()
    }, SYNC_DEBOUNCE)

    return () => window.clearTimeout(timer)
  }, [signature, session, handleExpired, onNotice])

  let status: DriveSyncStatus = 'signed-out'
  if (connecting) {
    status = 'connecting'
  } else if (session) {
    if (syncStatus === 'error') status = 'error'
    else if (syncStatus === 'syncing' || lastSyncedAt === null) {
      status = 'syncing'
    } else {
      status = 'synced'
    }
  }

  return {
    status,
    user: session?.user ?? null,
    lastSyncedAt,
    error,
    signIn,
    signOut,
    retry,
  }
}
