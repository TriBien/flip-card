import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Card } from '../types'
import { CloseIcon } from './Icons'

interface CardEditorProps {
  card: Card | null
  onClose: () => void
  onSave: (values: { front: string; back: string }) => void
  onDelete: (id: string) => void
}

export default function CardEditor({
  card,
  onClose,
  onSave,
  onDelete,
}: CardEditorProps) {
  const [front, setFront] = useState(card?.front ?? '')
  const [back, setBack] = useState(card?.back ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const frontRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (window.matchMedia('(pointer: fine)').matches) {
      frontRef.current?.focus()
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const canSave = front.trim().length > 0 && back.trim().length > 0

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    onSave({ front: front.trim(), back: back.trim() })
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <header className="sheet__header">
          <h2 id="editor-title">{card ? 'Edit card' : 'New card'}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close editor"
          >
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">
              Front <em>the prompt</em>
            </span>
            <textarea
              ref={frontRef}
              value={front}
              onChange={(event) => setFront(event.target.value)}
              placeholder="What do you want to remember?"
              rows={3}
              maxLength={500}
            />
          </label>

          <label className="field">
            <span className="field__label">
              Back <em>the answer</em>
            </span>
            <textarea
              value={back}
              onChange={(event) => setBack(event.target.value)}
              placeholder="The answer you want to recall."
              rows={3}
              maxLength={500}
            />
          </label>

          <div className="sheet__actions">
            {card ? (
              <button
                type="button"
                className="btn btn--danger-ghost"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="sheet__actions-right">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={!canSave}>
                {card ? 'Save changes' : 'Add card'}
              </button>
            </div>
          </div>

          {confirmDelete && card && (
            <div className="confirm">
              <p>Delete this card? This can’t be undone.</p>
              <div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => onDelete(card.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
