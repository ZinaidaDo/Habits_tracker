import { useState } from 'react'
import { useStore } from '../../hooks/useStore'
import { useUndoToast } from '../../hooks/useUndoToast'
import { addDays, formatDateRu, parseDate, today } from '../../lib/dates'
import { dayProgress, dayTasks, isFutureDay, markTask, unmarkTask } from '../../lib/day'
import { tasksProgress, weekTasks } from '../../lib/progress'
import { getStore, setStore } from '../../lib/store'
import type { Task } from '../../lib/types'
import { UndoToast } from '../ui/UndoToast'

function formatDayLabel(day: string): string {
  const base = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDate(day))
  if (day === today()) return `Сегодня, ${base}`
  if (day === addDays(today(), -1)) return `Вчера, ${base}`
  return base
}

/**
 * Экран «Сегодня»: задачи выбранного дня с фильтром по разделам,
 * строкой прогресса дня и недели и быстрой галочкой выполнения.
 * Будущие даты заблокированы; после отметки показывается undo-уведомление.
 */
export function TodayScreen() {
  const store = useStore()
  const [day, setDay] = useState(() => today())
  const [hiddenSections, setHiddenSections] = useState<string[]>([])
  const toast = useUndoToast()

  const hidden = new Set(hiddenSections)
  const dayAll = dayTasks(store, day)
  const tasks = dayAll.filter((task) => !hidden.has(task.sectionId))
  const { done, total } = dayProgress(tasks)
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)

  const week = tasksProgress(
    weekTasks(store, day, store.settings.firstDayOfWeek).filter(
      (task) => !hidden.has(task.sectionId),
    ),
  )

  const emptyText =
    dayAll.length === 0
      ? day === today()
        ? 'На сегодня задач нет — добавьте их на экране «Доска».'
        : 'В этот день задач не было.'
      : 'Все задачи скрыты фильтром — включите разделы.'

  function toggleTask(task: Task) {
    const prev = getStore()
    const wasDone = task.status === 'done'
    try {
      setStore(wasDone ? unmarkTask(prev, task.id) : markTask(prev, task.id, day))
      toast.show(
        wasDone
          ? `Отметка с «${task.title}» снята`
          : `«${task.title}» отмечена на ${formatDateRu(day)}`,
        prev,
      )
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Не удалось изменить отметку')
    }
  }

  function toggleSection(sectionId: string) {
    setHiddenSections((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    )
  }

  return (
    <section className="today" aria-labelledby="today-title">
      <div className="today__header">
        <h2 className="screen-title" id="today-title">
          Сегодня
        </h2>
        <div className="day-nav" role="group" aria-label="Выбор дня">
          <button
            type="button"
            className="day-nav__button"
            aria-label="Предыдущий день"
            onClick={() => setDay(addDays(day, -1))}
          >
            ‹
          </button>
          <span className="day-nav__label" aria-live="polite">
            {formatDayLabel(day)}
          </span>
          <button
            type="button"
            className="day-nav__button"
            aria-label="Следующий день"
            disabled={isFutureDay(addDays(day, 1))}
            onClick={() => setDay(addDays(day, 1))}
          >
            ›
          </button>
          {day !== today() && (
            <button type="button" className="day-nav__today" onClick={() => setDay(today())}>
              К сегодняшнему дню
            </button>
          )}
        </div>
      </div>

      <div className="today__filters" role="group" aria-label="Фильтр по разделам">
        {store.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`chip${hidden.has(section.id) ? '' : ' chip--on'}`}
            aria-pressed={!hidden.has(section.id)}
            onClick={() => toggleSection(section.id)}
          >
            <span aria-hidden="true">{section.emoji}</span> {section.name}
            {section.archived && <span className="chip__muted"> (архив)</span>}
          </button>
        ))}
      </div>

      <p className="today__progress" aria-live="polite">
        Выполнено: {done} из {total}
      </p>
      {total > 0 && (
        <div
          className="progress"
          role="progressbar"
          aria-label="Прогресс дня"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div className="progress__fill" style={{ width: `${percent}%` }} />
        </div>
      )}

      <p className="today__week">
        За неделю: {week.done} из {week.total}
      </p>
      {week.total > 0 && (
        <div
          className="progress"
          role="progressbar"
          aria-label="Прогресс недели"
          aria-valuemin={0}
          aria-valuemax={week.total}
          aria-valuenow={week.done}
        >
          <div className="progress__fill" style={{ width: `${week.percent}%` }} />
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="empty-hint">{emptyText}</p>
      ) : (
        <ul className="today__list">
          {tasks.map((task) => {
            const section = store.sections.find((item) => item.id === task.sectionId)
            return (
              <li
                key={task.id}
                className={`today-item${task.status === 'done' ? ' today-item--done' : ''}`}
              >
                <input
                  type="checkbox"
                  className="today-item__check"
                  id={`today-check-${task.id}`}
                  checked={task.status === 'done'}
                  aria-label={`Отметить задачу «${task.title}»`}
                  onChange={() => toggleTask(task)}
                />
                <label className="today-item__label" htmlFor={`today-check-${task.id}`}>
                  <span
                    className="today-item__section"
                    style={section ? { color: section.color } : undefined}
                  >
                    {section?.emoji} {section?.name}
                  </span>
                  <span className="today-item__title">{task.title}</span>
                </label>
                {task.dueDate && (
                  <span className="today-item__due">Срок: {formatDateRu(task.dueDate)}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {toast.toast !== null && <UndoToast message={toast.toast.message} onUndo={toast.undo} />}
    </section>
  )
}
