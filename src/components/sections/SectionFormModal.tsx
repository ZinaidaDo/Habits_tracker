import { useState, type CSSProperties, type FormEvent } from 'react'
import { useStore } from '../../hooks/useStore'
import { createSection, updateSection, validateSectionName } from '../../lib/sections'
import { setStore } from '../../lib/store'
import type { Section } from '../../lib/types'
import { Modal } from '../ui/Modal'

const EMOJI_PRESETS = ['🇬🇧', '📐', '🏃', '📚', '🧪', '🎨', '🎵', '💻', '🧠', '🗣️', '🏋️', '📖']

const COLOR_PRESETS = [
  '#2f6fed',
  '#1f9d55',
  '#b9740a',
  '#d43f3f',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#5b6470',
]

type SectionFormModalProps = {
  /** null — создание нового раздела. */
  section: Section | null
  onClose: () => void
}

export function SectionFormModal({ section, onClose }: SectionFormModalProps) {
  const store = useStore()
  const [name, setName] = useState(section?.name ?? '')
  const [emoji, setEmoji] = useState(section?.emoji ?? EMOJI_PRESETS[0])
  const [color, setColor] = useState(section?.color ?? COLOR_PRESETS[0])
  const [error, setError] = useState<string | null>(null)

  const titleId = 'section-form-title'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateSectionName(name)
    if (validationError) {
      setError(validationError)
      return
    }

    setStore(
      section !== null
        ? updateSection(store, section.id, { name, emoji, color })
        : createSection(store, { name, emoji, color }),
    )
    onClose()
  }

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <h2 className="modal__title" id={titleId}>
          {section !== null ? 'Редактирование раздела' : 'Новый раздел'}
        </h2>

        <div className="form-field">
          <label htmlFor="section-name">Название</label>
          <input
            id="section-name"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            aria-invalid={error !== null}
            aria-describedby={error !== null ? 'section-name-error' : undefined}
          />
          {error !== null && (
            <p className="form-error" id="section-name-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <fieldset className="option-group">
          <legend>Иконка</legend>
          <div className="emoji-grid">
            {EMOJI_PRESETS.map((preset) => (
              <label key={preset} className="emoji-option">
                <input
                  type="radio"
                  name="section-emoji"
                  value={preset}
                  checked={emoji === preset}
                  onChange={() => setEmoji(preset)}
                />
                <span aria-hidden="true">{preset}</span>
                <span className="visually-hidden">Иконка {preset}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="option-group">
          <legend>Цвет</legend>
          <div className="color-grid">
            {COLOR_PRESETS.map((preset) => (
              <label
                key={preset}
                className="color-option"
                style={{ '--swatch': preset } as CSSProperties}
              >
                <input
                  type="radio"
                  name="section-color"
                  value={preset}
                  checked={color === preset}
                  onChange={() => setColor(preset)}
                />
                <span aria-hidden="true" />
                <span className="visually-hidden">Цвет {preset}</span>
              </label>
            ))}
            <label className="custom-color">
              Свой цвет
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="Свой цвет"
              />
            </label>
          </div>
        </fieldset>

        <div className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="button button--primary">
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}
