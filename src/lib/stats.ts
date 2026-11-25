import { addDays, today } from './dates'
import { dayProgress, dayTasks } from './day'
import { tasksProgress, weekStart, type Progress } from './progress'
import type { Store, Task } from './types'

export type DayStat = { day: string; done: number; total: number; percent: number }

/** Интенсивность дня для heatmap: 'none' — задач не было, 0..4 — доля выполненных. */
export type Intensity = 'none' | 0 | 1 | 2 | 3 | 4

export type Streaks = { current: number; best: number }

/** Ячейка heatmap: статистика дня + признак будущего дня. */
export type HeatmapCell = DayStat & { future: boolean }

function tasksOfDay(store: Store, day: string, sectionId: string | null): Task[] {
  const tasks = dayTasks(store, day)
  return sectionId ? tasks.filter((task) => task.sectionId === sectionId) : tasks
}

/** Статистика одного дня: задачи дня (правила dayTasks) с фильтром раздела. */
export function dayStat(store: Store, day: string, sectionId: string | null = null): DayStat {
  const { done, total } = dayProgress(tasksOfDay(store, day, sectionId))
  return { day, done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** Уровень ячейки heatmap по статистике дня. */
export function intensity(stat: DayStat): Intensity {
  if (stat.total === 0) return 'none'
  if (stat.percent === 0) return 0
  if (stat.percent <= 25) return 1
  if (stat.percent <= 50) return 2
  if (stat.percent <= 75) return 3
  return 4
}

/**
 * Сетка heatmap: `weeks` недель по `firstDayOfWeek`, заканчивая неделей дня `day`.
 * Каждая неделя — 7 ячеек по порядку; будущие дни помечены future.
 */
export function heatmapGrid(
  store: Store,
  day: string,
  firstDayOfWeek: 0 | 1,
  sectionId: string | null = null,
  weeks = 12,
): HeatmapCell[][] {
  const lastStart = weekStart(day, firstDayOfWeek)
  const firstStart = addDays(lastStart, -(weeks - 1) * 7)
  const grid: HeatmapCell[][] = []

  for (let week = 0; week < weeks; week++) {
    const cells: HeatmapCell[] = []
    for (let offset = 0; offset < 7; offset++) {
      const cellDay = addDays(firstStart, week * 7 + offset)
      cells.push(
        cellDay > day
          ? { day: cellDay, done: 0, total: 0, percent: 0, future: true }
          : { ...dayStat(store, cellDay, sectionId), future: false },
      )
    }
    grid.push(cells)
  }
  return grid
}

/** Дни, в которые отмечено выполнение задачи (completedAt), с учётом раздела. */
function completionDays(store: Store, sectionId: string | null): Set<string> {
  const days = new Set<string>()
  for (const task of store.tasks) {
    if (sectionId && task.sectionId !== sectionId) continue
    if (task.completedAt) days.add(task.completedAt)
  }
  return days
}

/**
 * Серии подряд: текущая и лучшая за всё время.
 * Текущая считается от сегодняшнего дня; если сегодня отметок нет,
 * но вчера были — серия ещё ждёт сегодняшней отметки (день не закрыт).
 * Пропуск дня обрывает серию. На `firstDayOfWeek` не зависит.
 */
export function streaks(store: Store, sectionId: string | null = null, day = today()): Streaks {
  const active = completionDays(store, sectionId)

  let current = 0
  let cursor = active.has(day) ? day : addDays(day, -1)
  while (active.has(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }

  const sorted = [...active].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const date of sorted) {
    run = prev !== null && addDays(prev, 1) === date ? run + 1 : 1
    if (run > best) best = run
    prev = date
  }

  return { current, best }
}

/**
 * Прогресс периода [from, to] включительно: объединение задач всех дней
 * периода без дублей (задача, попавшая в два дня, считается один раз).
 */
export function rangeProgress(
  store: Store,
  from: string,
  to: string,
  sectionId: string | null = null,
): Progress {
  const seen = new Set<string>()
  const tasks: Task[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    for (const task of tasksOfDay(store, day, sectionId)) {
      if (seen.has(task.id)) continue
      seen.add(task.id)
      tasks.push(task)
    }
  }
  return tasksProgress(tasks)
}

/** Столбики за N дней: статистика каждого дня от старых к новым. */
export function dailySeries(
  store: Store,
  day: string,
  days: number,
  sectionId: string | null = null,
): DayStat[] {
  const series: DayStat[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    series.push(dayStat(store, addDays(day, -offset), sectionId))
  }
  return series
}

/** Склонение «день» для счётчиков серий. */
export function pluralDays(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} день`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} дня`
  return `${count} дней`
}
