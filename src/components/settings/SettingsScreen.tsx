import { useRef, useState, type ChangeEvent } from 'react'
import { useStore } from '../../hooks/useStore'
import { useUndoToast } from '../../hooks/useUndoToast'
import { UndoToast } from '../ui/UndoToast'
import { Modal } from '../ui/Modal'
import { today } from '../../lib/dates'
import { createDefaultStore, setStore } from '../../lib/store'
import { exportFileName, importStore, serializeStore } from '../../lib/settings'
import type { ThemeSetting } from '../../lib/types'

const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

const WEEK_OPTIONS: { value: 0 | 1; label: string }[] = [
  { value: 1, label: 'Понедельник' },
  { value: 0, label: 'Воскресенье' },
]

/**
 * Экран «Настройки»: тема (системная/светлая/тёмная), первый день недели,
 * экспорт в JSON-файл, импорт с валидацией схемы (без потери текущих данных)
 * и полный сброс с двойным подтверждением.
 */
export function SettingsScreen() {
  const store = useStore()
  const { toast, show, undo } = useUndoToast()
  const [resetOpen, setResetOpen] = useState(false)
  const [resetConfirmed, setResetConfirmed] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function updateSettings(patch: Partial<typeof store.settings>) {
    setStore((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))
  }

  function handleExport() {
    const blob = new Blob([serializeStore(store)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFileName(today())
    link.click()
    URL.revokeObjectURL(url)
    show('Файл экспортирован')
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // можно выбрать тот же файл повторно
    if (!file) return

    const reader = new FileReader()
    reader.onerror = () => setImportError('Файл не прочитан: ошибка чтения.')
    reader.onload = () => {
      const result = importStore(String(reader.result ?? ''))
      if (!result.ok) {
        setImportError(result.error)
        return
      }
      setImportError(null)
      setStore(result.store)
      show('Данные импортированы')
    }
    reader.readAsText(file)
  }

  function handleReset() {
    setResetOpen(false)
    setResetConfirmed(false)
    setStore(createDefaultStore())
    show('Все данные сброшены')
  }

  return (
    <section className="settings" aria-labelledby="settings-title">
      <h2 className="screen-title" id="settings-title">
        Настройки
      </h2>

      <section className="panel" aria-labelledby="theme-title">
        <h3 className="panel__title" id="theme-title">
          Тема оформления
        </h3>
        <div className="settings__row" role="radiogroup" aria-label="Тема оформления">
          {THEME_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`settings__option${store.settings.theme === option.value ? ' settings__option--on' : ''}`}
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={store.settings.theme === option.value}
                onChange={() => updateSettings({ theme: option.value })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="week-title">
        <h3 className="panel__title" id="week-title">
          Первая неделя
        </h3>
        <div className="settings__row" role="radiogroup" aria-label="Первая неделя">
          {WEEK_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`settings__option${store.settings.firstDayOfWeek === option.value ? ' settings__option--on' : ''}`}
            >
              <input
                type="radio"
                name="first-day"
                value={option.value}
                checked={store.settings.firstDayOfWeek === option.value}
                onChange={() => updateSettings({ firstDayOfWeek: option.value })}
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="panel__hint">
          От этого зависят недельные прогресс и heatmap на экране «Статистика».
        </p>
      </section>

      <section className="panel" aria-labelledby="data-title">
        <h3 className="panel__title" id="data-title">
          Данные
        </h3>
        <p className="panel__hint">
          Экспорт сохраняет все разделы, задачи и настройки в JSON-файл. Импорт заменяет текущие
          данные — битый или чужой файл отклоняется без изменений.
        </p>

        <div className="settings__row">
          <button type="button" className="button button--primary" onClick={handleExport}>
            Экспорт в JSON
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            Импорт из файла
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            aria-label="Файл для импорта"
            onChange={handleImportFile}
          />
        </div>

        {importError && (
          <p className="settings__error" role="alert">
            {importError}
          </p>
        )}

        <div className="settings__danger">
          <button
            type="button"
            className="button button--danger"
            onClick={() => {
              setResetConfirmed(false)
              setResetOpen(true)
            }}
          >
            Сбросить все данные
          </button>
        </div>
      </section>

      {resetOpen && (
        <Modal
          titleId="reset-modal-title"
          onClose={() => {
            setResetOpen(false)
            setResetConfirmed(false)
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (resetConfirmed) handleReset()
            }}
          >
            <h2 className="modal__title" id="reset-modal-title">
              Сбросить все данные?
            </h2>
            <p className="confirm-message">
              Будут удалены все разделы, задачи и настройки. Отменить сброс будет нельзя.
            </p>
            <label className="settings__confirm">
              <input
                type="checkbox"
                checked={resetConfirmed}
                onChange={(event) => setResetConfirmed(event.target.checked)}
              />
              Да, я понимаю: все данные будут удалены безвозвратно
            </label>

            <div className="modal__footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setResetOpen(false)
                  setResetConfirmed(false)
                }}
              >
                Отмена
              </button>
              <button type="submit" className="button button--danger" disabled={!resetConfirmed}>
                Сбросить
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast !== null && <UndoToast message={toast.message} onUndo={undo} />}
    </section>
  )
}
