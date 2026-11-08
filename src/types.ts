export type Rating = 'hard' | 'medium' | 'easy'

export interface Card {
  id: string
  front: string
  back: string
  createdAt: number
  interval: number
  dueAt: number
  lastReviewedAt: number | null
  lastRating: Rating | null
  reviewCount: number
}

export interface Settings {
  spacedRepetition: boolean
}
