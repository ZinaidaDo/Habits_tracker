import { useState } from 'react'
import { useStore } from '../../hooks/useStore'
import { formatDateRu, today } from '../../lib/dates'
import { markTask, unmarkTask } from '../../lib/day'
import { getStore, setStore } from '../../lib/store'
import { deleteTask, moveTask, tasksInSection } from '../../lib/tasks'
import { STATUS_LABELS, type Section, type Task } from '../../lib/types'
import { ConfirmModal } from '../ui/ConfirmModal'
import { TaskFormModal } from './TaskFormModal'

type TaskListProps = {
  section: Section
  /** Перенос задачи в другой раздел (меню на строке задачи). */
  onMoveTask: (taskId: string, sectionId: string) => void
}

type TaskFormState = { mode: 'create' } | { mode: 'edit'; taskId: string }

export function TaskList({ section, onMoveTask }: TaskListProps) {
  const store = useStore()
  const [form, setForm] = useState<TaskFormState | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)

  const tasks = tasksInSection(store, section.id)
  const editingTask =
    form?.mode === 'edit' ? (store.tasks.find((task) => task.id === form.taskId) ?? null) : null

  return (
    <section className="panel task-panel" aria-labelledby="task-panel-title">
      <div className="task-panel__header">
        <h3 className="task-panel__title" id="task-panel-title">
          Задачи
        </h3>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setForm({ mode: 'create' })}
        >
          Добавить задачу
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="empty-hint">В разделе «{section.name}» пока нет задач.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task, index) => (
            <li
              key={task.id}
              className={`task-item${task.status === 'done' ? ' task-item--done' : ''}`}
            >
              <input
                type="checkbox"
                className="task-item__check"
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

              <div className="task-item__body">
                <span className={`task-status task-status--${task.status}`}>
                  {STATUS_LABELS[task.status]}
                </span>
                <span className="task-item__title">{task.title}</span>
                {task.description && <p className="task-item__description">{task.description}</p>}
                {task.dueDate && (
                  <span className="task-item__due">Срок: {formatDateRu(task.dueDate)}</span>
                )}
              </div>

              <label className="task-item__move">
                <span className="visually-hidden">
                  Переместить задачу «{task.title}» в другой раздел
                </span>
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value) onMoveTask(task.id, event.target.value)
                  }}
                >
                  <option value="">Переместить в раздел…</option>
                  {store.sections
                    .filter((item) => item.id !== task.sectionId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.archived ? ' (архив)' : ''}
                      </option>
                    ))}
                </select>
              </label>

              <div className="task-item__actions">
                <button
                  type="button"
                  className="task-item__action"
                  aria-label={`Переместить задачу «${task.title}» вверх`}
                  disabled={index === 0}
                  onClick={() => setStore(moveTask(store, task.id, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="task-item__action"
                  aria-label={`Переместить задачу «${task.title}» вниз`}
                  disabled={index === tasks.length - 1}
                  onClick={() => setStore(moveTask(store, task.id, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="task-item__action"
                  aria-label={`Редактировать задачу «${task.title}»`}
                  onClick={() => setForm({ mode: 'edit', taskId: task.id })}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="task-item__action"
                  aria-label={`Удалить задачу «${task.title}»`}
                  onClick={() => setDeletingTask(task)}
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form !== null && (
        <TaskFormModal
          task={editingTask}
          defaultSectionId={section.id}
          onClose={() => setForm(null)}
        />
      )}

      {deletingTask !== null && (
        <ConfirmModal
          title="Удалить задачу?"
          message={`«${deletingTask.title}» будет удалена безвозвратно.`}
          onConfirm={() => {
            setStore(deleteTask(store, deletingTask.id))
            setDeletingTask(null)
          }}
          onClose={() => setDeletingTask(null)}
        />
      )}
    </section>
  )
}
