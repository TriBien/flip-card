import type { Card, Settings } from '../types'

export interface SyncPayload {
  version: 1
  updatedAt: number
  cards: Card[]
  settings: Settings
}

export interface SyncData {
  cards: Card[]
  settings: Settings
}

export function normalizeCard(card: Card): Card {
  if (typeof card.updatedAt === 'number') return card
  const fallback =
    Math.max(card.createdAt ?? 0, card.lastReviewedAt ?? 0) || Date.now()
  return { ...card, updatedAt: fallback }
}

export function normalizeSettings(
  settings: Partial<Settings> | null | undefined,
  fallback: Settings,
): Settings {
  const theme = settings?.theme
  return {
    spacedRepetition:
      typeof settings?.spacedRepetition === 'boolean'
        ? settings.spacedRepetition
        : fallback.spacedRepetition,
    theme: theme === 'dark' || theme === 'light' ? theme : fallback.theme,
  }
}

export function isSyncPayload(value: unknown): value is SyncPayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Partial<SyncPayload>
  if (!Array.isArray(payload.cards)) return false
  if (typeof payload.settings !== 'object' || payload.settings === null) return false
  if (typeof payload.settings.spacedRepetition !== 'boolean') return false
  const theme = payload.settings.theme
  if (theme !== undefined && theme !== 'dark' && theme !== 'light') {
    return false
  }
  return payload.cards.every(
    (card) =>
      typeof card === 'object' &&
      card !== null &&
      typeof (card as Card).id === 'string' &&
      typeof (card as Card).front === 'string' &&
      typeof (card as Card).back === 'string',
  )
}

export function buildPayload(data: SyncData): SyncPayload {
  return {
    version: 1,
    updatedAt: Date.now(),
    cards: data.cards,
    settings: {
      spacedRepetition: data.settings.spacedRepetition,
      theme: data.settings.theme,
    },
  }
}

export function mergeData(local: SyncData, remote: SyncPayload): SyncData {
  const cards = new Map<string, Card>()

  for (const card of remote.cards) {
    const normalized = normalizeCard(card)
    cards.set(normalized.id, normalized)
  }

  for (const card of local.cards) {
    const normalized = normalizeCard(card)
    const existing = cards.get(normalized.id)
    if (!existing || normalized.updatedAt >= existing.updatedAt) {
      cards.set(normalized.id, normalized)
    }
  }

  return {
    cards: [...cards.values()].sort((a, b) => b.createdAt - a.createdAt),
    settings: normalizeSettings(remote.settings, local.settings),
  }
}

export function dataSignature(cards: Card[], settings: Settings): string {
  const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify({ cards: sorted, settings })
}
