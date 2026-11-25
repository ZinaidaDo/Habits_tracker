import { useState, type DragEvent } from 'react'
import { useStore } from '../../hooks/useStore'
import { formatDateRu, today } from '../../lib/dates'
import { markTask, unmarkTask } from '../../lib/day'
import { getStore, setStore } from '../../lib/store'
import { setTaskStatus, tasksByStatus } from '../../lib/tasks'
import { STATUSES, STATUS_LABELS, type Section, type Status, type Task } from '../../lib/types'
import { TaskFormModal } from '../tasks/TaskFormModal'

type KanbanBoardProps = {
  section: Section
  /** Перенос задачи в другой раздел (drag & drop на сайдбар или меню на карточке). */
  onMoveTask: (taskId: string, sectionId: string) => void
}

/**
 * Канбан-доска выбранного раздела: четыре колонки статусов.
 * Перемещение — нативным drag & drop либо меню «Переместить в…»
 * (для клавиатуры и мобильных). Обновление оптимистичное: при сбое
 * состояние откатывается и показывается сообщение об ошибке.
 */
export function KanbanBoard({ section, onMoveTask }: KanbanBoardProps) {
  const store = useStore()
  const groups = tasksByStatus(store, section.id)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<Status | null>(null)
  const [activeColumn, setActiveColumn] = useState<Status>('planned')
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  function changeStatus(taskId: string, status: Status) {
    const prev = getStore()
    const task = prev.tasks.find((item) => item.id === taskId)
    try {
      setStore(setTaskStatus(prev, taskId, status))
      setError(null)
      if (task) setAnnouncement(`«${task.title}» → «${STATUS_LABELS[status]}»`)
    } catch {
      // Откат оптимистичного обновления: возвращаем прежнее состояние.
      try {
        setStore(prev)
      } catch {
        // Повторный сбой игнорируем — сообщение об ошибке важнее.
      }
      setError('Не удалось изменить статус — изменение отменено')
    } finally {
      setDraggingId(null)
      setDropTarget(null)
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, taskId: string) {
    event.dataTransfer.setData('text/plain', taskId)
    event.dataTransfer.effectAllowed = 'move'
    setDraggingId(taskId)
  }

  function handleDragOver(event: DragEvent<HTMLElement>, status: Status) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(status)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>, status: Status) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDropTarget((current) => (current === status ? null : current))
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: Status) {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('text/plain') || draggingId
    setDropTarget(null)
    setDraggingId(null)
    if (taskId) changeStatus(taskId, status)
  }

  return (
    <section className="panel kanban" aria-labelledby="kanban-title">
      <div className="kanban__header">
        <h3 className="kanban__title" id="kanban-title">
          Канбан
        </h3>
        <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
          Добавить задачу
        </button>
      </div>

      {error !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <p className="visually-hidden" id="kanban-dnd-help">
        Задачи перетаскиваются между колонками мышью. С клавиатуры используйте меню «Статус» на
        карточке задачи.
      </p>
      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>

      <div className="kanban__tabs" role="group" aria-label="Колонки статусов">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className="kanban__tab"
            aria-pressed={activeColumn === status}
            onClick={() => setActiveColumn(status)}
          >
            {STATUS_LABELS[status]}
            <span className="kanban__tab-count" aria-label={`Задач: ${groups[status].length}`}>
              {groups[status].length}
            </span>
          </button>
        ))}
      </div>

      <div className="kanban__columns" aria-describedby="kanban-dnd-help">
        {STATUSES.map((status) => {
          const tasks = groups[status]
          const isActive = activeColumn === status
          const isDropTarget = dropTarget === status

          return (
            <section
              key={status}
              className={[
                'kanban-column',
                isActive ? 'kanban-column--active' : '',
                isDropTarget ? 'kanban-column--drop-target' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`Колонка: ${STATUS_LABELS[status]}`}
              onDragOver={(event) => handleDragOver(event, status)}
              onDragLeave={(event) => handleDragLeave(event, status)}
              onDrop={(event) => handleDrop(event, status)}
            >
              <header className="kanban-column__header">
                <h4 className="kanban-column__title">{STATUS_LABELS[status]}</h4>
                <span className="kanban-column__count" aria-label={`Задач: ${tasks.length}`}>
                  {tasks.length}
                </span>
              </header>

              {tasks.length === 0 ? (
                <p className="kanban-column__empty">Перетащите задачу сюда</p>
              ) : (
                <ul className="kanban-column__list">
                  {tasks.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      sections={store.sections}
                      isDragging={draggingId === task.id}
                      onDragStart={(event) => handleDragStart(event, task.id)}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDropTarget(null)
                      }}
                      onMove={(nextStatus) => changeStatus(task.id, nextStatus)}
                      onMoveToSection={(sectionId) => onMoveTask(task.id, sectionId)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {creating && (
        <TaskFormModal
          task={null}
          defaultSectionId={section.id}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  )
}

type KanbanCardProps = {
  task: Task
  sections: Section[]
  isDragging: boolean
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onMove: (status: Status) => void
  onMoveToSection: (sectionId: string) => void
}

function KanbanCard({
  task,
  sections,
  isDragging,
  onDragStart,
  onDragEnd,
  onMove,
  onMoveToSection,
}: KanbanCardProps) {
  return (
    <li
      className={[
        'kanban-card',
        isDragging ? 'kanban-card--dragging' : '',
        task.status === 'done' ? 'kanban-card--done' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="kanban-card__head">
        <input
          type="checkbox"
          className="kanban-card__check"
          checked={task.status === 'done'}
          aria-label={`Отметить задачу «${task.title}»`}
          onChange={() => {
            const current = getStore()
            setStore(
              task.status === 'done'
                ? unmarkTask(current, task.id)
                : markTask(current, task.id, today()),
            )
          }}
        />
        <span className="kanban-card__title">{task.title}</span>
      </div>
      {task.description && <p className="kanban-card__description">{task.description}</p>}
      {task.dueDate && <span className="kanban-card__due">Срок: {formatDateRu(task.dueDate)}</span>}

      <label className="kanban-card__move">
        <span className="visually-hidden">Переместить задачу «{task.title}» в другой статус</span>
        <select value={task.status} onChange={(event) => onMove(event.target.value as Status)}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="kanban-card__move">
        <span className="visually-hidden">Переместить задачу «{task.title}» в другой раздел</span>
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) onMoveToSection(event.target.value)
          }}
        >
          <option value="">Переместить в раздел…</option>
          {sections
            .filter((item) => item.id !== task.sectionId)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.archived ? ' (архив)' : ''}
              </option>
            ))}
        </select>
      </label>
    </li>
  )
}
