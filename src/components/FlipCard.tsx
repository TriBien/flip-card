import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Card, Rating } from '../types'
import {
  RATINGS,
  RATING_ORDER,
  formatDuration,
  nextInterval,
} from '../lib/scheduler'
import { EditIcon, FlipIcon } from './Icons'

interface FlipCardProps {
  card: Card
  now: number
  spacedRepetition: boolean
  onRate: (card: Card, rating: Rating) => void
  onEdit: (card: Card) => void
}

export default function FlipCard({
  card,
  now,
  spacedRepetition,
  onRate,
  onEdit,
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const pointerMoved = useRef(false)

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY }
    pointerMoved.current = false
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = pointerStart.current
    if (!start) return
    const distance = Math.hypot(
      event.clientX - start.x,
      event.clientY - start.y,
    )
    if (distance > 8) pointerMoved.current = true
  }

  const handleStageClick = () => {
    if (pointerMoved.current) {
      pointerMoved.current = false
      return
    }
    setFlipped((value) => !value)
  }

  const isNew = card.reviewCount === 0
  const isDueNow = card.dueAt <= now
  const statusTone = isNew ? 'new' : isDueNow ? 'due' : 'later'
  const statusLabel = isNew
    ? 'New'
    : isDueNow
      ? 'Due now'
      : `in ${formatDuration(card.dueAt - now)}`

  return (
    <article className={`flip-card${flipped ? ' is-flipped' : ''}`}>
      <div className="flip-card__meta">
        {spacedRepetition ? (
          <span className={`chip chip--${statusTone}`}>{statusLabel}</span>
        ) : (
          <span className="chip chip--off">Manual</span>
        )}

        {spacedRepetition && card.lastRating && (
          <span
            className="level-pill"
            style={
              { '--level': RATINGS[card.lastRating].color } as CSSProperties
            }
          >
            {RATINGS[card.lastRating].label}
          </span>
        )}

        <button
          type="button"
          className="icon-btn flip-card__edit"
          onClick={() => onEdit(card)}
          aria-label="Edit card"
        >
          <EditIcon />
        </button>
      </div>

      <button
        type="button"
        className="flip-card__stage"
        onClick={handleStageClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        aria-pressed={flipped}
        aria-label={
          flipped
            ? `Back: ${card.back}. Flip to the front.`
            : `Front: ${card.front}. Flip to the back.`
        }
      >
        <div className="flip-card__inner">
          <div className="flip-card__face flip-card__face--front">
            <span className="face__tag">Front</span>
            <p className="face__text">{card.front}</p>
            <span className="face__hint">
              <FlipIcon />
              Tap to flip
            </span>
          </div>
          <div className="flip-card__face flip-card__face--back">
            <span className="face__tag">Back</span>
            <p className="face__text">{card.back}</p>
            <span className="face__hint">
              <FlipIcon />
              Tap to flip back
            </span>
          </div>
        </div>
      </button>

      {spacedRepetition && flipped && (
        <div className="rating">
          <p className="rating__label">How well did you know it?</p>
          <div className="rating__buttons">
            {RATING_ORDER.map((rating) => {
              const config = RATINGS[rating]
              const intervalLabel = formatDuration(nextInterval(card, rating))
              return (
                <button
                  key={rating}
                  type="button"
                  className="rate"
                  style={{ '--tone': config.color } as CSSProperties}
                  onClick={() => onRate(card, rating)}
                  aria-label={`${config.label}, next review in ${intervalLabel}`}
                >
                  <span className="rate__name">
                    <span className="rate__dot" />
                    {config.label}
                  </span>
                  <span className="rate__time">{intervalLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </article>
  )
}
