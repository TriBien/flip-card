import { googleConfig } from '../config'
import { isSyncPayload, type SyncPayload } from './sync'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

export class DriveError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DriveError'
    this.status = status
  }
}

async function ensureOk(response: Response): Promise<Response> {
  if (response.ok) return response
  const fallback = `Google Drive request failed (${response.status})`
  let message = fallback
  try {
    const data = (await response.json()) as { error?: { message?: string } }
    message = data.error?.message ?? fallback
  } catch {
    message = fallback
  }
  throw new DriveError(message, response.status)
}

export async function findDriveFile(
  accessToken: string,
): Promise<{ id: string } | null> {
  const params = new URLSearchParams({
    q: `name='${googleConfig.driveFileName.replace(/'/g, "\\'")}' and trashed=false`,
    spaces: 'drive',
    fields: 'files(id,name)',
    pageSize: '1',
  })
  const response = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  await ensureOk(response)
  const data = (await response.json()) as { files?: Array<{ id: string }> }
  return data.files?.[0] ?? null
}

export async function downloadDriveFile(
  accessToken: string,
  fileId: string,
): Promise<SyncPayload> {
  const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  await ensureOk(response)
  const data: unknown = await response.json()
  if (!isSyncPayload(data)) {
    throw new DriveError('The Drive backup is not a valid Flipwise file', 422)
  }
  return data
}

async function createDriveFile(
  accessToken: string,
  payload: SyncPayload,
): Promise<string> {
  const boundary = `flipwise-${Math.random().toString(36).slice(2)}`
  const metadata = {
    name: googleConfig.driveFileName,
    mimeType: 'application/json',
  }
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(payload),
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const response = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  await ensureOk(response)
  const data = (await response.json()) as { id?: string }
  if (!data.id) {
    throw new DriveError('Google Drive did not return a file id', 500)
  }
  return data.id
}

async function updateDriveFile(
  accessToken: string,
  fileId: string,
  payload: SyncPayload,
): Promise<void> {
  const response = await fetch(
    `${UPLOAD_API}/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(payload),
    },
  )
  await ensureOk(response)
}

export async function saveDriveFile(
  accessToken: string,
  fileId: string | null,
  payload: SyncPayload,
): Promise<string> {
  if (!fileId) return createDriveFile(accessToken, payload)
  try {
    await updateDriveFile(accessToken, fileId, payload)
    return fileId
  } catch (error) {
    if (error instanceof DriveError && error.status === 404) {
      return createDriveFile(accessToken, payload)
    }
    throw error
  }
}
