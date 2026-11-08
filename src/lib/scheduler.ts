import type { Card, Rating } from '../types'

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

interface RatingConfig {
  label: string
  description: string
  color: string
  base: number
  factor: number
}

export const RATINGS: Record<Rating, RatingConfig> = {
  hard: {
    label: 'Hard',
    description: 'Show sooner',
    color: '#fb7185',
    base: 10 * MINUTE,
    factor: 0.5,
  },
  medium: {
    label: 'Medium',
    description: 'Keep it steady',
    color: '#fbbf24',
    base: DAY,
    factor: 2,
  },
  easy: {
    label: 'Easy',
    description: 'Show later',
    color: '#34d399',
    base: 3 * DAY,
    factor: 3,
  },
}

export const RATING_ORDER: Rating[] = ['hard', 'medium', 'easy']

export function newId(): string {
  const random = globalThis.crypto?.randomUUID?.()
  if (random) return random
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createCard(front: string, back: string): Card {
  const now = Date.now()
  return {
    id: newId(),
    front: front.trim(),
    back: back.trim(),
    createdAt: now,
    updatedAt: now,
    interval: 0,
    dueAt: now,
    lastReviewedAt: null,
    lastRating: null,
    reviewCount: 0,
  }
}

export function nextInterval(card: Card, rating: Rating): number {
  const { base, factor } = RATINGS[rating]
  if (card.interval <= 0) return base
  return Math.max(base, Math.round(card.interval * factor))
}

export function scheduleCard(card: Card, rating: Rating, now = Date.now()): Card {
  const interval = nextInterval(card, rating)
  return {
    ...card,
    updatedAt: now,
    interval,
    dueAt: now + interval,
    lastReviewedAt: now,
    lastRating: rating,
    reviewCount: card.reviewCount + 1,
  }
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'now'
  if (ms < MINUTE) return '<1m'
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))}m`
  if (ms < DAY) return `${Math.max(1, Math.round(ms / HOUR))}h`
  if (ms < 30 * DAY) return `${Math.max(1, Math.round(ms / DAY))}d`
  if (ms < 365 * DAY) return `${Math.max(1, Math.round(ms / (30 * DAY)))}mo`
  return `${Math.max(1, Math.round(ms / (365 * DAY)))}y`
}
