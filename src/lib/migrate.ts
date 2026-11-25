import { isValidDateString, today } from './dates'
import { STATUSES, type Section, type Settings, type Status, type Store, type Task } from './types'

export const SCHEMA_VERSION = 1

type RawRecord = Record<string, unknown>
type Migration = (data: RawRecord) => RawRecord

/**
 * Пошаговые миграции: ключ — исходная версия, значение — преобразование
 * в следующую версию. Добавляйте записи по мере роста схемы (1 → 2 и т.д.).
 */
const MIGRATIONS: Record<number, Migration> = {
  // v0 — данные без schemaVersion (ранние версии или ручное редактирование)
  0: (data) => ({ ...data, schemaVersion: 1 }),
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readVersion(data: RawRecord): number {
  return typeof data.schemaVersion === 'number' && Number.isInteger(data.schemaVersion)
    ? data.schemaVersion
    : 0
}

function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
}

function optionalDateString(value: unknown): string | undefined {
  return isValidDateString(value) ? value : undefined
}

/**
 * Приводит произвольные данные к валидному Store.
 * Возвращает null, если данные неисправимы — вызывающая сторона
 * подставит данные по умолчанию.
 */
export function migrate(raw: unknown): Store | null {
  if (!isRecord(raw)) return null

  let data = raw
  let version = readVersion(data)

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) return null

    const next = step(data)
    const nextVersion = readVersion(next)
    if (nextVersion <= version) return null // защита от зацикливания

    data = next
    version = nextVersion
  }

  if (version > SCHEMA_VERSION) return null // данные из более новой версии приложения

  return parseStore(data)
}

function parseStore(data: RawRecord): Store | null {
  if (!Array.isArray(data.sections) || !Array.isArray(data.tasks)) return null

  return {
    schemaVersion: SCHEMA_VERSION,
    sections: data.sections
      .map(parseSection)
      .filter((section): section is Section => section !== null),
    tasks: data.tasks.map(parseTask).filter((task): task is Task => task !== null),
    settings: parseSettings(data.settings),
  }
}

function parseSection(value: unknown): Section | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.id === '') return null
  if (typeof value.name !== 'string' || value.name.trim() === '') return null

  return {
    id: value.id,
    name: value.name,
    color: typeof value.color === 'string' ? value.color : '#2f6fed',
    emoji: typeof value.emoji === 'string' ? value.emoji : '📘',
    order: typeof value.order === 'number' && Number.isFinite(value.order) ? value.order : 0,
    archived: value.archived === true,
    createdAt: isValidDateString(value.createdAt) ? value.createdAt : today(),
  }
}

function parseTask(value: unknown): Task | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.id === '') return null
  if (typeof value.sectionId !== 'string' || value.sectionId === '') return null
  if (typeof value.title !== 'string' || value.title.trim() === '') return null
  if (!isStatus(value.status)) return null

  return {
    id: value.id,
    sectionId: value.sectionId,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : undefined,
    status: value.status,
    previousStatus: isStatus(value.previousStatus) ? value.previousStatus : undefined,
    dueDate: optionalDateString(value.dueDate),
    completedAt: optionalDateString(value.completedAt),
    lastStatusChangeAt: optionalDateString(value.lastStatusChangeAt),
    order: typeof value.order === 'number' && Number.isFinite(value.order) ? value.order : 0,
    createdAt: isValidDateString(value.createdAt) ? value.createdAt : today(),
    updatedAt: isValidDateString(value.updatedAt) ? value.updatedAt : today(),
  }
}

function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) return { theme: 'system', firstDayOfWeek: 0 }

  const theme =
    value.theme === 'light' || value.theme === 'dark' || value.theme === 'system'
      ? value.theme
      : 'system'
  const firstDayOfWeek: 0 | 1 = value.firstDayOfWeek === 1 ? 1 : 0

  return { theme, firstDayOfWeek }
}
