import { today } from './dates'
import { type Store, type Task } from './types'

/** Будущие даты недоступны для отметок и навигации. */
export function isFutureDay(day: string): boolean {
  return day > today()
}

/**
 * Задачи, относящиеся к дню:
 * - отмеченные выполненные в этот день (completedAt);
 * - с сроком на этот день (dueDate);
 * - для сегодняшнего дня — плюс рабочая очередь невыполненных задач.
 * Список отсортирован по разделу, затем по порядку задачи.
 */
export function dayTasks(store: Store, day: string): Task[] {
  const isToday = day === today()
  const sectionOrder = new Map(store.sections.map((section) => [section.id, section.order]))
  const seen = new Set<string>()
  const result: Task[] = []

  for (const task of store.tasks) {
    if (!sectionOrder.has(task.sectionId)) continue
    const belongs =
      task.completedAt === day || task.dueDate === day || (isToday && task.status !== 'done')
    if (!belongs || seen.has(task.id)) continue
    seen.add(task.id)
    result.push(task)
  }

  return result.sort((a, b) => {
    const bySection = (sectionOrder.get(a.sectionId) ?? 0) - (sectionOrder.get(b.sectionId) ?? 0)
    return bySection !== 0 ? bySection : a.order - b.order
  })
}

export type DayProgress = { done: number; total: number }

/** Прогресс дня: «выполнено из общего числа». */
export function dayProgress(tasks: Task[]): DayProgress {
  const done = tasks.filter((task) => task.status === 'done').length
  return { done, total: tasks.length }
}

/**
 * Быстрая отметка «выполнено» на указанный день (не позднее сегодняшнего).
 * Запоминает прежний статус — он возвращается при снятии отметки.
 */
export function markTask(store: Store, id: string, day: string): Store {
  if (isFutureDay(day)) throw new Error('Нельзя отметить задачу на будущую дату')
  const task = store.tasks.find((item) => item.id === id)
  if (!task || task.status === 'done') return store

  const next: Task = {
    ...task,
    status: 'done',
    previousStatus: task.status,
    completedAt: day,
    lastStatusChangeAt: day,
    updatedAt: today(),
  }
  return { ...store, tasks: store.tasks.map((item) => (item.id === id ? next : item)) }
}

/** Снятие отметки: возврат в прежний статус (по умолчанию «В работе»). */
export function unmarkTask(store: Store, id: string): Store {
  const task = store.tasks.find((item) => item.id === id)
  if (!task || task.status !== 'done') return store

  const next: Task = {
    ...task,
    status: task.previousStatus ?? 'in_progress',
    previousStatus: undefined,
    completedAt: undefined,
    lastStatusChangeAt: today(),
    updatedAt: today(),
  }
  return { ...store, tasks: store.tasks.map((item) => (item.id === id ? next : item)) }
}
