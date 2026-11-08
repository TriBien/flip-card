import { googleConfig } from '../config'

export interface GoogleProfile {
  name?: string
  email?: string
  picture?: string
}

export interface GoogleToken {
  accessToken: string
  expiresIn: number
}

interface TokenResponse {
  access_token: string
  expires_in: number
  error?: string
  error_description?: string
}

interface TokenError {
  type?: string
  message?: string
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: TokenError) => void
  }) => TokenClient
  revoke: (accessToken: string, done?: () => void) => void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleOAuth2
      }
    }
  }
}

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')

let loader: Promise<void> | null = null

export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (loader) return loader

  loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.oauth2) {
        resolve()
      } else {
        loader = null
        reject(new Error('Google Identity Services did not start'))
      }
    }
    script.onerror = () => {
      loader = null
      reject(new Error('Could not load Google Identity Services'))
    }
    document.head.appendChild(script)
  })

  return loader
}

export async function requestGoogleToken(
  prompt: '' | 'select_account',
): Promise<GoogleToken> {
  await loadGoogleIdentity()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google Identity Services is unavailable')

  return new Promise<GoogleToken>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: googleConfig.googleClientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description ?? response.error))
          return
        }
        resolve({
          accessToken: response.access_token,
          expiresIn: response.expires_in,
        })
      },
      error_callback: (error) => {
        const message =
          error?.message ?? error?.type ?? 'Google sign-in was cancelled'
        reject(new Error(message))
      },
    })
    client.requestAccessToken({ prompt })
  })
}

export async function fetchGoogleProfile(
  accessToken: string,
): Promise<GoogleProfile> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Could not load your Google profile')
  return (await response.json()) as GoogleProfile
}

export function revokeGoogleToken(accessToken: string): void {
  window.google?.accounts?.oauth2?.revoke(accessToken)
}
