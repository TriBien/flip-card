import type { Card } from '../types'
import { createCard } from './scheduler'

const DECK: Array<[front: string, back: string]> = [
  [
    'What is spaced repetition?',
    'A study technique that schedules reviews at growing intervals — just before you are about to forget something.',
  ],
  [
    'What does CSS backface-visibility do?',
    'It hides the reverse side of an element, so the two faces of a 3D flip card never show through each other.',
  ],
  [
    'What is the capital of Australia?',
    'Canberra — not Sydney or Melbourne.',
  ],
  [
    'Which organelle is known as the powerhouse of the cell?',
    'The mitochondria. It produces most of the cell’s ATP energy.',
  ],
]

export function sampleCards(): Card[] {
  return DECK.map(([front, back]) => createCard(front, back))
}
