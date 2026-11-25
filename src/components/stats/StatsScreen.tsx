import { useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '../../hooks/useStore'
import { addDays, formatDateRu, parseDate, today } from '../../lib/dates'
import { dayTasks } from '../../lib/day'
import { weekStart } from '../../lib/progress'
import {
  dailySeries,
  heatmapGrid,
  intensity,
  pluralDays,
  rangeProgress,
  streaks,
} from '../../lib/stats'
import { STATUS_LABELS } from '../../lib/types'

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function formatFullDate(day: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(parseDate(day))
}

/**
 * Экран «Статистика»: heatmap за 12 недель (клик по дню — список задач дня),
 * текущая и лучшая серии подряд, % выполнения за 7/30 дней, столбиковый
 * график за 30 дней (CSS, без библиотек) и фильтр по разделу.
 */
export function StatsScreen() {
  const store = useStore()
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>(() => today())
  const [focusDay, setFocusDay] = useState<string>(() => today())
  const gridRef = useRef<HTMLDivElement>(null)

  const now = today()
  const firstDayOfWeek = store.settings.firstDayOfWeek
  const streak = streaks(store, sectionId, now)
  const week = rangeProgress(store, addDays(now, -6), now, sectionId)
  const month = rangeProgress(store, addDays(now, -29), now, sectionId)
  const grid = heatmapGrid(store, now, firstDayOfWeek, sectionId, 12)
  const series = dailySeries(store, now, 30, sectionId)
  const gridStart = grid[0][0].day

  const dayAll = dayTasks(store, selectedDay)
  const dayTasksFiltered = sectionId
    ? dayAll.filter((task) => task.sectionId === sectionId)
    : dayAll
  const dayDone = dayTasksFiltered.filter((task) => task.status === 'done').length

  function focusCell(day: string) {
    setFocusDay(day)
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus()
  }

  /** Стрелки/Home/End перемещают фокус по ячейкам heatmap (roving tabindex). */
  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const offsets: Record<string, number> = {
      ArrowLeft: -7,
      ArrowRight: 7,
      ArrowUp: -1,
      ArrowDown: 1,
    }
    let next: string | null = null
    if (event.key in offsets) next = addDays(focusDay, offsets[event.key])
    else if (event.key === 'Home') next = weekStart(focusDay, firstDayOfWeek)
    else if (event.key === 'End') next = addDays(weekStart(focusDay, firstDayOfWeek), 6)
    if (next === null) return
    event.preventDefault()
    if (next < gridStart) next = gridStart
    if (next > now) next = now
    focusCell(next)
  }

  return (
    <section className="stats" aria-labelledby="stats-title">
      <h2 className="screen-title" id="stats-title">
        Статистика
      </h2>

      <div className="stats__filters" role="group" aria-label="Фильтр по разделам">
        <button
          type="button"
          className={`chip${sectionId === null ? ' chip--on' : ''}`}
          aria-pressed={sectionId === null}
          onClick={() => setSectionId(null)}
        >
          Все разделы
        </button>
        {store.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`chip${sectionId === section.id ? ' chip--on' : ''}`}
            aria-pressed={sectionId === section.id}
            onClick={() => setSectionId(section.id)}
          >
            <span aria-hidden="true">{section.emoji}</span> {section.name}
            {section.archived && <span className="chip__muted"> (архив)</span>}
          </button>
        ))}
      </div>

      {store.tasks.length === 0 ? (
        <p className="empty-hint">
          Пока нет задач — добавьте их на экране «Доска», и здесь появится статистика.
        </p>
      ) : (
        <>
          <div className="stats__cards">
            <div className="stats-card">
              <span className="stats-card__label">Серия сейчас</span>
              <strong className="stats-card__value">{pluralDays(streak.current)}</strong>
            </div>
            <div className="stats-card">
              <span className="stats-card__label">Лучшая серия</span>
              <strong className="stats-card__value">{pluralDays(streak.best)}</strong>
            </div>
            <div className="stats-card">
              <span className="stats-card__label">Выполнено за 7 дней</span>
              <strong className="stats-card__value">{week.percent}%</strong>
              <span className="stats-card__hint">
                {week.done} из {week.total}
              </span>
            </div>
            <div className="stats-card">
              <span className="stats-card__label">Выполнено за 30 дней</span>
              <strong className="stats-card__value">{month.percent}%</strong>
              <span className="stats-card__hint">
                {month.done} из {month.total}
              </span>
            </div>
          </div>

          <section className="panel" aria-labelledby="heat-title">
            <h3 className="panel__title" id="heat-title">
              Активность за 12 недель
            </h3>
            <p className="panel__hint">{`${formatDateRu(gridStart)} — ${formatDateRu(now)}`}</p>

            <div className="heat">
              <div className="heat__weekdays" aria-hidden="true">
                {grid[0].map((cell, index) => (
                  <span key={cell.day}>
                    {index % 2 === 0 ? WEEKDAY_SHORT[parseDate(cell.day).getDay()] : ''}
                  </span>
                ))}
              </div>
              <div
                className="heat__grid"
                ref={gridRef}
                role="group"
                aria-label="Календарь активности за 12 недель"
                onKeyDown={onGridKeyDown}
              >
                {grid.map((weekCells) =>
                  weekCells.map((cell) => {
                    if (cell.future) {
                      return (
                        <span
                          key={cell.day}
                          className="heat__cell heat__cell--future"
                          aria-hidden="true"
                        />
                      )
                    }
                    const level = intensity(cell)
                    const label =
                      cell.total === 0
                        ? `${formatDateRu(cell.day)}: задач не было`
                        : `${formatDateRu(cell.day)}: выполнено ${cell.done} из ${cell.total}`
                    return (
                      <button
                        key={cell.day}
                        type="button"
                        data-day={cell.day}
                        className={`heat__cell heat__cell--${
                          level === 'none' ? 'none' : `level-${level}`
                        }${selectedDay === cell.day ? ' heat__cell--selected' : ''}`}
                        tabIndex={focusDay === cell.day ? 0 : -1}
                        aria-label={label}
                        aria-pressed={selectedDay === cell.day}
                        onClick={() => {
                          setSelectedDay(cell.day)
                          setFocusDay(cell.day)
                        }}
                      />
                    )
                  }),
                )}
              </div>
            </div>

            <div className="heat-legend" aria-hidden="true">
              <span>Меньше</span>
              <span className="heat__cell heat__cell--none" />
              <span className="heat__cell heat__cell--level-0" />
              <span className="heat__cell heat__cell--level-1" />
              <span className="heat__cell heat__cell--level-2" />
              <span className="heat__cell heat__cell--level-3" />
              <span className="heat__cell heat__cell--level-4" />
              <span>Больше</span>
            </div>
          </section>

          <section className="panel" aria-labelledby="day-title">
            <h3 className="panel__title" id="day-title">
              {formatFullDate(selectedDay)}
            </h3>
            {dayAll.length === 0 ? (
              <p className="empty-hint">В этот день задач не было.</p>
            ) : dayTasksFiltered.length === 0 ? (
              <p className="empty-hint">Все задачи этого дня скрыты фильтром.</p>
            ) : (
              <>
                <p className="stats__day-progress">
                  Выполнено: {dayDone} из {dayTasksFiltered.length}
                </p>
                <ul className="stats-day__list">
                  {dayTasksFiltered.map((task) => (
                    <li
                      key={task.id}
                      className={`stats-day__item${
                        task.status === 'done' ? ' stats-day__item--done' : ''
                      }`}
                    >
                      <span className={`task-status task-status--${task.status}`}>
                        {STATUS_LABELS[task.status]}
                      </span>
                      <span className="stats-day__title">{task.title}</span>
                      <span className="stats-day__section">
                        {store.sections.find((section) => section.id === task.sectionId)?.emoji}{' '}
                        {store.sections.find((section) => section.id === task.sectionId)?.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="panel" aria-labelledby="bars-title">
            <h3 className="panel__title" id="bars-title">
              Последние 30 дней
            </h3>
            <ul className="bars" aria-label="Выполнение по дням за 30 дней">
              {series.map((stat) => (
                <li
                  key={stat.day}
                  className="bars__item"
                  aria-label={
                    stat.total === 0
                      ? `${formatDateRu(stat.day)}: задач не было`
                      : `${formatDateRu(stat.day)}: выполнено ${stat.done} из ${stat.total}`
                  }
                >
                  <span
                    className={`bars__bar${stat.total === 0 ? ' bars__bar--empty' : ''}`}
                    style={{ height: `${stat.total === 0 ? 0 : stat.percent}%` }}
                  />
                </li>
              ))}
            </ul>
            <div className="bars__axis" aria-hidden="true">
              <span>{formatDateRu(series[0].day)}</span>
              <span>{formatDateRu(series[series.length - 1].day)}</span>
            </div>
          </section>
        </>
      )}
    </section>
  )
}
