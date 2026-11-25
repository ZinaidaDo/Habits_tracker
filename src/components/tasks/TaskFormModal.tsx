import { useState, type FormEvent } from 'react'
import { useStore } from '../../hooks/useStore'
import { activeSections } from '../../lib/sections'
import { setStore } from '../../lib/store'
import { createTask, TASK_TITLE_MAX, updateTask, validateTaskTitle } from '../../lib/tasks'
import { STATUS_LABELS, STATUSES, type Task } from '../../lib/types'
import { Modal } from '../ui/Modal'

type TaskFormModalProps = {
  /** null — создание новой задачи. */
  task: Task | null
  /** Раздел по умолчанию для новой задачи. */
  defaultSectionId: string
  onClose: () => void
}

export function TaskFormModal({ task, defaultSectionId, onClose }: TaskFormModalProps) {
  const store = useStore()
  const sections = activeSections(store)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [sectionId, setSectionId] = useState(task?.sectionId ?? defaultSectionId)
  const [status, setStatus] = useState(task?.status ?? 'planned')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [error, setError] = useState<string | null>(null)

  const titleId = 'task-form-title'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateTaskTitle(title)
    if (validationError) {
      setError(validationError)
      return
    }

    const input = {
      title,
      description: description.trim() || undefined,
      sectionId,
      status,
      dueDate: dueDate || undefined,
    }

    setStore(task !== null ? updateTask(store, task.id, input) : createTask(store, input))
    onClose()
  }

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <h2 className="modal__title" id={titleId}>
          {task !== null ? 'Редактирование задачи' : 'Новая задача'}
        </h2>

        <div className="form-field">
          <label htmlFor="task-title">Название</label>
          <input
            id="task-title"
            type="text"
            maxLength={TASK_TITLE_MAX}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setError(null)
            }}
            aria-invalid={error !== null}
            aria-describedby={error !== null ? 'task-title-error' : undefined}
          />
          {error !== null && (
            <p className="form-error" id="task-title-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="task-description">Описание (необязательно)</label>
          <textarea
            id="task-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </div>

        <div className="form-field">
          <label htmlFor="task-section">Раздел</label>
          <select
            id="task-section"
            value={sectionId}
            onChange={(event) => setSectionId(event.target.value)}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.emoji} {section.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="option-group">
          <legend>Статус</legend>
          <div className="radio-list">
            {STATUSES.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="task-status"
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                />
                {STATUS_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-field">
          <label htmlFor="task-due">Срок выполнения (необязательно)</label>
          <input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>

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
