import { today } from './dates'
import { generateId } from './id'
import type { Section, Status, Task } from './types'

/** Три раздела по умолчанию (этап 2 делает их редактируемыми). */
const DEFAULT_SECTIONS = [
  { id: 'sec-english', name: 'Английский язык', color: '#2f6fed', emoji: '🇬🇧' },
  { id: 'sec-algebra', name: 'Алгебра', color: '#1f9d55', emoji: '📐' },
  { id: 'sec-pe', name: 'Физкультура', color: '#b9740a', emoji: '🏃' },
] as const

type SeedTask = {
  sectionId: string
  title: string
  status: Status
}

/** Учебные задачи для разработки/демо (создаются только в DEV-режиме). */
const SEED_TASKS: readonly SeedTask[] = [
  { sectionId: 'sec-english', title: 'Выучить 20 новых слов', status: 'done' },
  { sectionId: 'sec-english', title: 'Прочитать статью и сделать пересказ', status: 'in_progress' },
  { sectionId: 'sec-algebra', title: 'Решить 10 задач на квадратные уравнения', status: 'planned' },
  { sectionId: 'sec-algebra', title: 'Повторить формулы сокращённого умножения', status: 'done' },
  { sectionId: 'sec-pe', title: 'Пробежка 2 км', status: 'postponed' },
  { sectionId: 'sec-pe', title: 'Комплекс ОРЯ, 2 подхода', status: 'planned' },
]

export function createDefaultSections(): Section[] {
  const date = today()

  return DEFAULT_SECTIONS.map((section, index) => ({
    id: section.id,
    name: section.name,
    color: section.color,
    emoji: section.emoji,
    order: index,
    archived: false,
    createdAt: date,
  }))
}

export function createSeedTasks(): Task[] {
  const date = today()

  return SEED_TASKS.map((task, index) => ({
    id: generateId(),
    sectionId: task.sectionId,
    title: task.title,
    status: task.status,
    order: index,
    lastStatusChangeAt: date,
    createdAt: date,
    updatedAt: date,
    ...(task.status === 'done' ? { completedAt: date } : {}),
  }))
}
