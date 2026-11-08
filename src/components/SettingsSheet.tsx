import { useEffect } from 'react'
import type { Theme } from '../types'
import { CloseIcon, MoonIcon, SunIcon } from './Icons'

interface SettingsSheetProps {
  spacedRepetition: boolean
  theme: Theme
  onToggleSpacedRepetition: () => void
  onThemeChange: (theme: Theme) => void
  onClose: () => void
}

export default function SettingsSheet({
  spacedRepetition,
  theme,
  onToggleSpacedRepetition,
  onThemeChange,
  onClose,
}: SettingsSheetProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sheet settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <header className="sheet__header">
          <h2 id="settings-title">Settings</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="settings">
          <div className="setting">
            <div className="setting__copy">
              <strong>Spaced repetition</strong>
              <small>Only show cards once they are due for review.</small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={spacedRepetition}
              aria-label="Spaced repetition"
              className={`switch${spacedRepetition ? ' is-on' : ''}`}
              onClick={onToggleSpacedRepetition}
            >
              <span className="switch__thumb" />
            </button>
          </div>

          <div className="setting setting--column">
            <div className="setting__copy">
              <strong>Appearance</strong>
              <small>Choose the look of the app.</small>
            </div>
            <div className="theme-toggle" role="radiogroup" aria-label="Theme">
              <button
                type="button"
                role="radio"
                aria-checked={theme === 'light'}
                className="theme-option"
                onClick={() => onThemeChange('light')}
              >
                <SunIcon /> Light
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={theme === 'dark'}
                className="theme-option"
                onClick={() => onThemeChange('dark')}
              >
                <MoonIcon /> Dark
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
