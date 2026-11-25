import { addDays, parseDate } from './dates'
import { dayTasks } from './day'
import type { Store, Task } from './types'

export type Progress = { done: number; total: number; percent: number }

/** Прогресс списка задач: выполнено из общего числа, процент округляется. */
export function tasksProgress(tasks: Task[]): Progress {
  const total = tasks.length
  const done = tasks.filter((task) => task.status === 'done').length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** Прогресс раздела: выполнено / все задачи раздела. */
export function sectionProgress(store: Store, sectionId: string): Progress {
  return tasksProgress(store.tasks.filter((task) => task.sectionId === sectionId))
}

/**
 * Начало недели (YYYY-MM-DD) для дня:
 * неделя стартует с воскресенья (firstDayOfWeek = 0) или понедельника (= 1).
 */
export function weekStart(day: string, firstDayOfWeek: 0 | 1): string {
  const weekday = parseDate(day).getDay() // 0 = воскресенье … 6 = суббота
  const offset = firstDayOfWeek === 1 ? (weekday + 6) % 7 : weekday
  return addDays(day, -offset)
}

/**
 * Задачи недели: объединение задач каждого дня от начала недели до дня
 * включительно (те же правила, что и для одного дня), без дублей.
 */
export function weekTasks(store: Store, day: string, firstDayOfWeek: 0 | 1): Task[] {
  const start = weekStart(day, firstDayOfWeek)
  const seen = new Set<string>()
  const result: Task[] = []

  for (let cursor = start; cursor <= day; cursor = addDays(cursor, 1)) {
    for (const task of dayTasks(store, cursor)) {
      if (seen.has(task.id)) continue
      seen.add(task.id)
      result.push(task)
    }
  }
  return result
}

/** Общий прогресс недели: выполнено из задач недели. */
export function weekProgress(store: Store, day: string, firstDayOfWeek: 0 | 1): Progress {
  return tasksProgress(weekTasks(store, day, firstDayOfWeek))
}
