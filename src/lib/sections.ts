import { today } from './dates'
import { generateId } from './id'
import type { Section, Store } from './types'

export const SECTION_NAME_MAX = 60

export type SectionInput = {
  name: string
  emoji: string
  color: string
}

/** Что делать с задачами при удалении раздела — выбор пользователя. */
export type TaskFate = { action: 'move'; targetSectionId: string } | { action: 'delete' }

/** null — имя корректно, иначе текст ошибки для пользователя. */
export function validateSectionName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Введите название раздела'
  if (trimmed.length > SECTION_NAME_MAX) {
    return `Название — не длиннее ${SECTION_NAME_MAX} символов`
  }
  return null
}

function byOrder(a: Section, b: Section): number {
  return a.order - b.order
}

export function activeSections(store: Store): Section[] {
  return store.sections.filter((section) => !section.archived).sort(byOrder)
}

export function archivedSections(store: Store): Section[] {
  return store.sections.filter((section) => section.archived).sort(byOrder)
}

export function countTasksInSection(
  store: Store,
  sectionId: string,
): { total: number; done: number } {
  let total = 0
  let done = 0
  for (const task of store.tasks) {
    if (task.sectionId !== sectionId) continue
    total += 1
    if (task.status === 'done') done += 1
  }
  return { total, done }
}

export function createSection(store: Store, input: SectionInput): Store {
  const error = validateSectionName(input.name)
  if (error) throw new Error(error)

  const maxOrder = store.sections.reduce((max, section) => Math.max(max, section.order), -1)
  const section: Section = {
    id: generateId(),
    name: input.name.trim(),
    color: input.color,
    emoji: input.emoji,
    order: maxOrder + 1,
    archived: false,
    createdAt: today(),
  }

  return { ...store, sections: [...store.sections, section] }
}

export function updateSection(store: Store, id: string, patch: Partial<SectionInput>): Store {
  if (!store.sections.some((section) => section.id === id)) return store

  if (patch.name !== undefined) {
    const error = validateSectionName(patch.name)
    if (error) throw new Error(error)
  }

  return {
    ...store,
    sections: store.sections.map((section) =>
      section.id === id
        ? {
            ...section,
            name: patch.name !== undefined ? patch.name.trim() : section.name,
            emoji: patch.emoji ?? section.emoji,
            color: patch.color ?? section.color,
          }
        : section,
    ),
  }
}

/** Перемещает раздел вверх/внутри своей группы (активные и архивные отдельно). */
export function moveSection(store: Store, id: string, direction: -1 | 1): Store {
  const target = store.sections.find((section) => section.id === id)
  if (!target) return store

  const group = store.sections
    .filter((section) => section.archived === target.archived)
    .sort(byOrder)
  const index = group.findIndex((section) => section.id === id)
  const neighbor = group[index + direction]
  if (!neighbor) return store

  return {
    ...store,
    sections: store.sections.map((section) => {
      if (section.id === target.id) return { ...section, order: neighbor.order }
      if (section.id === neighbor.id) return { ...section, order: target.order }
      return section
    }),
  }
}

export function setSectionArchived(store: Store, id: string, archived: boolean): Store {
  if (!store.sections.some((section) => section.id === id)) return store

  return {
    ...store,
    sections: store.sections.map((section) =>
      section.id === id ? { ...section, archived } : section,
    ),
  }
}

/**
 * Удаляет раздел; судьба его задач задаётся явно (fate):
 * перенос в другой раздел или удаление вместе с разделом.
 */
export function deleteSection(store: Store, id: string, fate: TaskFate): Store {
  const target = store.sections.find((section) => section.id === id)
  if (!target) return store

  let tasks = store.tasks

  if (fate.action === 'move') {
    const destination = store.sections.find(
      (section) => section.id === fate.targetSectionId && section.id !== id,
    )
    if (!destination) throw new Error('Раздел-получатель не найден')

    const date = today()
    tasks = tasks.map((task) =>
      task.sectionId === id ? { ...task, sectionId: destination.id, updatedAt: date } : task,
    )
  } else {
    tasks = tasks.filter((task) => task.sectionId !== id)
  }

  return {
    ...store,
    sections: store.sections.filter((section) => section.id !== id),
    tasks,
  }
}
