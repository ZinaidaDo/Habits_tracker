import { afterEach, describe, expect, it } from 'vitest'
import { applyTheme, exportFileName, importStore, serializeStore } from './settings'
import { createDefaultStore, setStore, resetStore, getStore } from './store'
import type { Store } from './types'

afterEach(() => {
  localStorage.clear()
  resetStore()
  document.documentElement.removeAttribute('data-theme')
})

function sampleStore(): Store {
  const base = createDefaultStore()
  return {
    ...base,
    settings: { theme: 'dark', firstDayOfWeek: 1 },
    tasks: base.tasks.map((task, index) =>
      index === 0 ? { ...task, dueDate: '2026-12-31' } : task,
    ),
  }
}

describe('serializeStore / importStore', () => {
  it('экспорт → импорт восстанавливает состояние 1:1', () => {
    const original = sampleStore()

    const result = importStore(serializeStore(original))

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.store).toEqual(original)
  })

  it('импорт применяем к стору целиком (разделы, задачи, настройки)', () => {
    const original = sampleStore()
    setStore(original)

    const result = importStore(serializeStore(original))
    expect(result.ok).toBe(true)
    if (result.ok) {
      setStore(result.store)
      expect(getStore()).toEqual(original)
    }
  })

  it('битый JSON отклоняется с понятным сообщением, стор не меняется', () => {
    const original = sampleStore()
    setStore(original)

    const result = importStore('{не json')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/JSON/)
    expect(getStore()).toEqual(original)
  })

  it('чужой файл (валидный JSON не из трекера) отклоняется', () => {
    const original = sampleStore()
    setStore(original)

    for (const text of ['[1, 2, 3]', '"просто строка"', '{"foo": 1}', 'null']) {
      const result = importStore(text)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/не данные трекера|не прочитан/)
    }
    expect(getStore()).toEqual(original)
  })

  it('файл из более новой версии схемы отклоняется', () => {
    const result = importStore(JSON.stringify({ ...sampleStore(), schemaVersion: 99 }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/новой верси/)
  })

  it('файл без schemaVersion мигрирует (v0 → текущая)', () => {
    const original = sampleStore()
    const raw = JSON.parse(serializeStore(original)) as Record<string, unknown>
    delete raw.schemaVersion

    const result = importStore(JSON.stringify(raw))

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.store).toEqual(original)
  })

  it('невалидные элементы отфильтровываются, валидные сохраняются', () => {
    const valid = JSON.parse(serializeStore(sampleStore())) as Record<string, unknown>
    const withJunk = {
      ...valid,
      sections: [...(valid.sections as unknown[]), { bad: true }],
      tasks: [...(valid.tasks as unknown[]), 42],
    }

    const result = importStore(JSON.stringify(withJunk))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.store.sections).toHaveLength(3)
      expect(result.store.tasks).toHaveLength(6)
    }
  })
})

describe('exportFileName', () => {
  it('имя файла содержит локальную дату', () => {
    expect(exportFileName('2026-11-25')).toBe('task-tracker-2026-11-25.json')
  })
})

describe('applyTheme', () => {
  it('system снимает data-theme, light/dark задают явно', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})
