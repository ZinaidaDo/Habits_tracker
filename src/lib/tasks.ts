import { isValidDateString, today } from './dates'
import { generateId } from './id'
import { type Status, type Store, type Task } from './types'

export const TASK_TITLE_MAX = 100

export type TaskInput = {
  title: string
  description?: string
  sectionId: string
  status: Status
  dueDate?: string // YYYY-MM-DD, необязательно
}

/** null — название корректно, иначе текст ошибки для пользователя. */
export function validateTaskTitle(title: string): string | null {
  const trimmed = title.trim()
  if (trimmed.length === 0) return 'Введите название задачи'
  if (trimmed.length > TASK_TITLE_MAX) {
    return `Название — не длиннее ${TASK_TITLE_MAX} символов`
  }
  return null
}

/** Задачи раздела в порядке сортировки. */
export function tasksInSection(store: Store, sectionId: string): Task[] {
  return store.tasks
    .filter((task) => task.sectionId === sectionId)
    .sort((a, b) => a.order - b.order)
}

function maxTaskOrder(store: Store): number {
  return store.tasks.reduce((max, task) => Math.max(max, task.order), -1)
}

function sectionExists(store: Store, sectionId: string): boolean {
  return store.sections.some((section) => section.id === sectionId)
}

export function createTask(store: Store, input: TaskInput): Store {
  const error = validateTaskTitle(input.title)
  if (error) throw new Error(error)
  if (!sectionExists(store, input.sectionId)) throw new Error('Раздел не найден')

  const date = today()
  const description = input.description?.trim()

  const task: Task = {
    id: generateId(),
    sectionId: input.sectionId,
    title: input.title.trim(),
    status: input.status,
    order: maxTaskOrder(store) + 1,
    lastStatusChangeAt: date,
    createdAt: date,
    updatedAt: date,
    ...(description ? { description } : {}),
    ...(isValidDateString(input.dueDate) ? { dueDate: input.dueDate } : {}),
    ...(input.status === 'done' ? { completedAt: date } : {}),
  }

  return { ...store, tasks: [...store.tasks, task] }
}

export function updateTask(store: Store, id: string, patch: Partial<TaskInput>): Store {
  const task = store.tasks.find((item) => item.id === id)
  if (!task) return store

  if (patch.title !== undefined) {
    const error = validateTaskTitle(patch.title)
    if (error) throw new Error(error)
  }
  if (patch.sectionId !== undefined && !sectionExists(store, patch.sectionId)) {
    throw new Error('Раздел не найден')
  }

  const date = today()
  const nextSectionId = patch.sectionId ?? task.sectionId
  const sectionChanged = nextSectionId !== task.sectionId
  const nextStatus = patch.status ?? task.status
  const statusChanged = nextStatus !== task.status

  // «Выполнена» при ручном переводе датируется сегодняшним днём;
  // выход из «Выполнена» снимает дату выполнения.
  const completedAt = statusChanged
    ? nextStatus === 'done'
      ? (task.completedAt ?? date)
      : undefined
    : task.completedAt

  // Прежний статус запоминается при входе в «Выполнена» (для снятия отметки)
  // и очищается при выходе из неё.
  const previousStatus = statusChanged
    ? nextStatus === 'done'
      ? task.status === 'done'
        ? task.previousStatus
        : task.status
      : undefined
    : task.previousStatus

  const description = Object.hasOwn(patch, 'description')
    ? patch.description?.trim() || undefined
    : task.description

  const dueDate = Object.hasOwn(patch, 'dueDate')
    ? isValidDateString(patch.dueDate)
      ? patch.dueDate
      : undefined
    : task.dueDate

  const next: Task = {
    ...task,
    title: patch.title !== undefined ? patch.title.trim() : task.title,
    description,
    sectionId: nextSectionId,
    status: nextStatus,
    previousStatus,
    dueDate,
    completedAt,
    lastStatusChangeAt: statusChanged ? date : task.lastStatusChangeAt,
    order: sectionChanged ? maxTaskOrder(store) + 1 : task.order,
    updatedAt: date,
  }

  return { ...store, tasks: store.tasks.map((item) => (item.id === id ? next : item)) }
}

export function deleteTask(store: Store, id: string): Store {
  if (!store.tasks.some((task) => task.id === id)) return store
  return { ...store, tasks: store.tasks.filter((task) => task.id !== id) }
}

/** Задачи раздела, сгруппированные по статусам (для канбан-доски). */
export function tasksByStatus(store: Store, sectionId: string): Record<Status, Task[]> {
  const grouped: Record<Status, Task[]> = {
    planned: [],
    in_progress: [],
    postponed: [],
    done: [],
  }

  for (const task of tasksInSection(store, sectionId)) grouped[task.status].push(task)
  return grouped
}

/**
 * Переводит задачу в новый статус (дrag & drop / меню «Переместить в…»).
 * Отметка датируется днём перехода; выход из «Выполнена» снимает дату.
 */
export function setTaskStatus(store: Store, id: string, status: Status): Store {
  const task = store.tasks.find((item) => item.id === id)
  if (!task || task.status === status) return store

  const date = today()
  const next: Task = {
    ...task,
    status,
    previousStatus:
      status === 'done' ? (task.status === 'done' ? task.previousStatus : task.status) : undefined,
    lastStatusChangeAt: date,
    completedAt: status === 'done' ? (task.completedAt ?? date) : undefined,
    updatedAt: date,
  }

  return { ...store, tasks: store.tasks.map((item) => (item.id === id ? next : item)) }
}

/** Перемещает задачу вверх/вниз внутри своего раздела. */
export function moveTask(store: Store, id: string, direction: -1 | 1): Store {
  const task = store.tasks.find((item) => item.id === id)
  if (!task) return store

  const siblings = tasksInSection(store, task.sectionId)
  const index = siblings.findIndex((item) => item.id === id)
  const neighbor = siblings[index + direction]
  if (!neighbor) return store

  return {
    ...store,
    tasks: store.tasks.map((item) => {
      if (item.id === task.id) return { ...item, order: neighbor.order }
      if (item.id === neighbor.id) return { ...item, order: task.order }
      return item
    }),
  }
}
