import { migrate, SCHEMA_VERSION } from './migrate'
import { createDefaultSections, createSeedTasks } from './seed'
import type { Store } from './types'

export const STORAGE_KEY = 'task-tracker'

export type StoreListener = (store: Store) => void

let cache: Store | null = null
const listeners = new Set<StoreListener>()

type CreateDefaultOptions = {
  /** Сид-задачи — только для разработки; по умолчанию включены в DEV. */
  seedTasks?: boolean
}

export function createDefaultStore(options: CreateDefaultOptions = {}): Store {
  const withSeedTasks = options.seedTasks ?? import.meta.env.DEV

  return {
    schemaVersion: SCHEMA_VERSION,
    sections: createDefaultSections(),
    tasks: withSeedTasks ? createSeedTasks() : [],
    settings: { theme: 'system', firstDayOfWeek: 0 },
  }
}

function readPersistedStore(): Store | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  return migrate(parsed)
}

function persist(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Хранилище недоступно (приватный режим, квота) — продолжаем работу в памяти
  }
}

/** Текущее состояние: читается из localStorage при первом обращении. */
export function getStore(): Store {
  if (cache === null) {
    const persisted = readPersistedStore()
    cache = persisted ?? createDefaultStore()
    persist(cache) // сохраняем нормализованную версию
  }
  return cache
}

/** Обновляет состояние, сохраняет его и уведомляет подписчиков. */
export function setStore(update: Store | ((prev: Store) => Store)): Store {
  const prev = getStore()
  const next = typeof update === 'function' ? update(prev) : update
  if (next === prev) return prev

  cache = next
  persist(next)
  for (const listener of [...listeners]) listener(next)
  return next
}

/** Подписка на изменения; возвращает функцию отписки. */
export function subscribeStore(listener: StoreListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Сброс кэша и подписчиков (используется в тестах). */
export function resetStore(): void {
  cache = null
  listeners.clear()
}
