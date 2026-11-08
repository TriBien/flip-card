import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import './App.css'
import type { Card, Rating, Settings } from './types'
import {
  RATINGS,
  createCard,
  formatDuration,
  scheduleCard,
} from './lib/scheduler'
import { sampleCards } from './lib/samples'
import { normalizeCard, type SyncData } from './lib/sync'
import { useDriveSync } from './hooks/useDriveSync'
import FlipCard from './components/FlipCard'
import CardEditor from './components/CardEditor'
import AccountBar from './components/AccountBar'
import {
  ArrowRightIcon,
  CheckIcon,
  LogoIcon,
  PlusIcon,
  SparklesIcon,
} from './components/Icons'

const CARDS_KEY = 'flipwise.cards.v1'
const SETTINGS_KEY = 'flipwise.settings.v1'
const TOUCHED_KEY = 'flipwise.touched.v1'
const DEFAULT_SETTINGS: Settings = { spacedRepetition: true }

type View = 'due' | 'all'

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    if (typeof parsed !== 'object' || parsed === null) return fallback
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback
    return parsed
  } catch {
    return fallback
  }
}

function loadCards(): Card[] {
  try {
    if (localStorage.getItem(CARDS_KEY) === null) return sampleCards()
  } catch {
    return sampleCards()
  }
  return loadStored<Card[]>(CARDS_KEY, []).map(normalizeCard)
}

function loadTouched(): boolean {
  try {
    return localStorage.getItem(TOUCHED_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const [cards, setCards] = useState<Card[]>(loadCards)
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = loadStored<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS)
    return { spacedRepetition: stored.spacedRepetition !== false }
  })
  const [view, setView] = useState<View>(() =>
    loadStored<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS).spacedRepetition === false
      ? 'all'
      : 'due',
  )
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState<Card | 'new' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [hasLocalChanges, setHasLocalChanges] = useState(loadTouched)
  const toastTimeout = useRef<number | undefined>(undefined)

  useEffect(() => {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cards))
  }, [cards])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const interval = window.setInterval(tick, 30_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', tick)
    }
  }, [])

  useEffect(
    () => () => {
      if (toastTimeout.current) window.clearTimeout(toastTimeout.current)
    },
    [],
  )

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimeout.current) window.clearTimeout(toastTimeout.current)
    toastTimeout.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  const markLocalChange = useCallback(() => {
    setHasLocalChanges(true)
    try {
      localStorage.setItem(TOUCHED_KEY, '1')
    } catch {
      return
    }
  }, [])

  const handleRemoteData = useCallback((data: SyncData) => {
    setCards(data.cards)
    setSettings(data.settings)
    setView(data.settings.spacedRepetition ? 'due' : 'all')
    setNow(Date.now())
  }, [])

  const sync = useDriveSync({
    cards,
    settings,
    hasLocalChanges,
    onRemoteData: handleRemoteData,
    onNotice: showToast,
  })

  const spacedRepetition = settings.spacedRepetition

  const dueCards = useMemo(
    () =>
      cards
        .filter((card) => card.dueAt <= now)
        .sort((a, b) => a.dueAt - b.dueAt),
    [cards, now],
  )

  const allCards = useMemo(
    () => [...cards].sort((a, b) => b.createdAt - a.createdAt),
    [cards],
  )

  const newCount = useMemo(
    () => cards.filter((card) => card.reviewCount === 0).length,
    [cards],
  )
  const learnedCount = cards.length - newCount

  const nextDue = useMemo(() => {
    const upcoming = cards
      .filter((card) => card.dueAt > now)
      .sort((a, b) => a.dueAt - b.dueAt)
    return upcoming[0]
  }, [cards, now])

  const closeEditor = useCallback(() => setEditing(null), [])

  const handleToggleSpacedRepetition = () => {
    markLocalChange()
    const next = !spacedRepetition
    setSettings({ spacedRepetition: next })
    setView(next ? 'due' : 'all')
    setNow(Date.now())
    showToast(
      next
        ? 'Spaced repetition on — only due cards are shown'
        : 'Spaced repetition off — showing every card',
    )
  }

  const handleSave = ({ front, back }: { front: string; back: string }) => {
    markLocalChange()
    if (editing === 'new') {
      setCards((current) => [createCard(front, back), ...current])
      setNow(Date.now())
      showToast('Card added')
    } else if (editing) {
      const updatedAt = Date.now()
      setCards((current) =>
        current.map((card) =>
          card.id === editing.id
            ? { ...card, front, back, updatedAt }
            : card,
        ),
      )
      showToast('Card updated')
    }
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    markLocalChange()
    setCards((current) => current.filter((card) => card.id !== id))
    setEditing(null)
    showToast('Card deleted')
  }

  const handleRate = (card: Card, rating: Rating) => {
    markLocalChange()
    const updated = scheduleCard(card, rating)
    setCards((current) =>
      current.map((item) => (item.id === card.id ? updated : item)),
    )
    setNow(Date.now())
    showToast(
      `${RATINGS[rating].label} · next review in ${formatDuration(updated.interval)}`,
    )
  }

  const addSamples = () => {
    markLocalChange()
    setCards((current) => [...sampleCards(), ...current])
    setView(spacedRepetition ? 'due' : 'all')
    setNow(Date.now())
    showToast('Sample deck added')
  }

  const dueCount = dueCards.length
  const dateLabel = new Date(now).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  let heading = 'Your deck'
  if (spacedRepetition && cards.length > 0) {
    heading = dueCount > 0 ? 'Time to review' : 'All caught up'
  }

  let subtitle: ReactNode = 'Create your first flip card and start remembering more.'
  if (cards.length > 0) {
    if (!spacedRepetition) {
      subtitle = `${cards.length} card${cards.length === 1 ? '' : 's'} in your deck. Spaced repetition is off, so everything is shown.`
    } else if (dueCount > 0) {
      subtitle = `${dueCount} card${dueCount === 1 ? '' : 's'} due now. Flip each card, then rate how well you knew it.`
    } else if (nextDue) {
      subtitle = `Nothing due right now. Your next card comes back in ${formatDuration(nextDue.dueAt - now)}.`
    } else {
      subtitle = 'Nothing due right now.'
    }
  }

  const visibleCards =
    spacedRepetition && view === 'due' ? dueCards : allCards

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">
            <LogoIcon />
          </span>
          <span className="brand__name">Flipwise</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={spacedRepetition}
          aria-label="Spaced repetition"
          className={`sr-switch${spacedRepetition ? ' is-on' : ''}`}
          onClick={handleToggleSpacedRepetition}
        >
          <span className="sr-switch__label">Spaced repetition</span>
          <span className="sr-switch__track">
            <span className="sr-switch__thumb" />
          </span>
        </button>
      </header>

      <AccountBar
        status={sync.status}
        user={sync.user}
        lastSyncedAt={sync.lastSyncedAt}
        error={sync.error}
        now={now}
        onSignIn={sync.signIn}
        onSignOut={sync.signOut}
        onRetry={sync.retry}
      />

      <main className="main">
        <section className="hero">
          <p className="hero__eyebrow">{dateLabel}</p>
          <h1>{heading}</h1>
          <p className="hero__sub">{subtitle}</p>
          {spacedRepetition && cards.length > 0 && (
            <div className="stats">
              <span className="stat stat--due">
                <b>{dueCount}</b> due
              </span>
              <span className="stat stat--new">
                <b>{newCount}</b> new
              </span>
              <span className="stat stat--learned">
                <b>{learnedCount}</b> learned
              </span>
            </div>
          )}
        </section>

        {spacedRepetition && cards.length > 0 && (
          <div className="tabs" role="tablist" aria-label="Filter cards">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'due'}
              className="tab"
              onClick={() => setView('due')}
            >
              Due <span className="tab__count">{dueCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'all'}
              className="tab"
              onClick={() => setView('all')}
            >
              All <span className="tab__count">{cards.length}</span>
            </button>
          </div>
        )}

        {!spacedRepetition && cards.length > 0 && (
          <div className="list-heading">
            <strong>All cards</strong>
            <span>{cards.length} total</span>
          </div>
        )}

        {cards.length === 0 ? (
          <div className="empty">
            <div className="empty__stack" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2 className="empty__title">Your deck is empty</h2>
            <p className="empty__text">
              Flip cards turn small facts into long-term memory. Add your first
              one, or start with a ready-made sample deck.
            </p>
            <div className="empty__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setEditing('new')}
              >
                <PlusIcon /> Add your first card
              </button>
              <button type="button" className="btn btn--ghost" onClick={addSamples}>
                <SparklesIcon /> Add sample cards
              </button>
            </div>
          </div>
        ) : spacedRepetition && view === 'due' && dueCount === 0 ? (
          <div className="empty">
            <div className="empty__check">
              <CheckIcon />
            </div>
            <h2 className="empty__title">All caught up</h2>
            <p className="empty__text">
              {nextDue
                ? `Your next card comes back in ${formatDuration(nextDue.dueAt - now)}. Take a breath — you have earned it.`
                : 'You have reviewed every card in your deck.'}
            </p>
            <div className="empty__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setView('all')}
              >
                Browse all cards <ArrowRightIcon />
              </button>
            </div>
          </div>
        ) : (
          <div className="card-list">
            {visibleCards.map((card) => (
              <FlipCard
                key={`${card.id}:${card.dueAt}:${card.front}:${card.back}`}
                card={card}
                now={now}
                spacedRepetition={spacedRepetition}
                onRate={handleRate}
                onEdit={setEditing}
              />
            ))}
          </div>
        )}
      </main>

      <div className="dock">
        <div className="dock__inner">
          <button
            type="button"
            className="btn-add"
            onClick={() => setEditing('new')}
          >
            <PlusIcon /> New card
          </button>
        </div>
      </div>

      {editing !== null && (
        <CardEditor
          card={editing === 'new' ? null : editing}
          onClose={closeEditor}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
