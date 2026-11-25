import { migrate } from './migrate'
import type { Store, ThemeSetting } from './types'

/** Сериализация стора в JSON для экспорта (человекочитаемый, с отступом). */
export function serializeStore(store: Store): string {
  return JSON.stringify(store, null, 2)
}

export type ImportResult = { ok: true; store: Store } | { ok: false; error: string }

const IMPORT_ERRORS = {
  json: 'Файл не прочитан: это не корректный JSON.',
  shape: 'Файл не подходит: это не данные трекера (нет разделов и задач).',
  version: 'Файл создан более новой версией приложения — импорт невозможен.',
} as const

/**
 * Импорт стора из JSON-текста с валидацией схемы.
 * Любая ошибка → { ok: false } с понятным сообщением; вызывающая сторона
 * не трогает текущие данные.
 */
export function importStore(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: IMPORT_ERRORS.json }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: IMPORT_ERRORS.shape }
  }

  const record = parsed as Record<string, unknown>
  const version = typeof record.schemaVersion === 'number' ? record.schemaVersion : 0
  if (version > 1) return { ok: false, error: IMPORT_ERRORS.version }

  const store = migrate(parsed)
  if (store === null) return { ok: false, error: IMPORT_ERRORS.shape }

  return { ok: true, store }
}

/** Имя файла экспорта: task-tracker-YYYY-MM-DD.json (локальная дата). */
export function exportFileName(day: string): string {
  return `task-tracker-${day}.json`
}

/**
 * Применение темы к <html>:
 * 'system' — атрибут снимается (решает prefers-color-scheme),
 * 'light'/'dark' — data-theme задаётся явно.
 */
export function applyTheme(theme: ThemeSetting): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}
