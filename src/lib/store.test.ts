import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migrate, SCHEMA_VERSION } from './migrate'
import {
  createDefaultStore,
  getStore,
  resetStore,
  setStore,
  STORAGE_KEY,
  subscribeStore,
} from './store'
import type { Section, Task } from './types'

const validSection: Section = {
  id: 'sec-test',
  name: 'Тестовый раздел',
  color: '#000000',
  emoji: '🧪',
  order: 0,
  archived: false,
  createdAt: '2026-01-01',
}

const validTask: Task = {
  id: 'task-test',
  sectionId: 'sec-test',
  title: 'Тестовая задача',
  status: 'planned',
  order: 0,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

describe('данные по умолчанию', () => {
  it('при пустом сторе создаются три раздела по умолчанию', () => {
    const store = getStore()

    expect(store.sections.map((section) => section.name)).toEqual([
      'Английский язык',
      'Алгебра',
      'Физкультура',
    ])
    expect(store.schemaVersion).toBe(SCHEMA_VERSION)
    expect(store.settings).toEqual({ theme: 'system', firstDayOfWeek: 0 })
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('сид-задачи создаются только когда seedTasks: true', () => {
    expect(createDefaultStore({ seedTasks: true }).tasks.length).toBeGreaterThan(0)
    expect(createDefaultStore({ seedTasks: false }).tasks).toEqual([])
  })

  it('сид-задачи ссылаются на существующие разделы и имеют валидные статусы', () => {
    const store = createDefaultStore({ seedTasks: true })
    const sectionIds = new Set(store.sections.map((section) => section.id))

    for (const task of store.tasks) {
      expect(sectionIds.has(task.sectionId)).toBe(true)
      expect(['planned', 'in_progress', 'postponed', 'done']).toContain(task.status)
    }
  })
})

describe('чтение и запись', () => {
  it('запись переживает «перезагрузку» (сброс кэша)', () => {
    setStore((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { ...validTask, id: 'task-persisted' }],
    }))

    resetStore() // имитация перезагрузки страницы
    const reloaded = getStore()

    expect(reloaded.tasks).toContainEqual(
      expect.objectContaining({ id: 'task-persisted', title: 'Тестовая задача' }),
    )
  })

  it('битые данные откатываются к данным по умолчанию и не бросают исключение', () => {
    localStorage.setItem(STORAGE_KEY, '{это не JSON')

    let store: ReturnType<typeof getStore> | undefined
    expect(() => {
      store = getStore()
    }).not.toThrow()
    expect(store?.sections).toHaveLength(3)
  })

  it('данные из более новой версии приложения откатываются к дефолту', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, sections: [], tasks: [], settings: {} }),
    )

    expect(getStore().sections).toHaveLength(3)
  })

  it('невалидные элементы отфильтровываются, валидные — сохраняются', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        sections: [validSection, { nope: true }, null, 42, { id: '', name: 'Без id' }],
        tasks: [validTask, { id: 'x' }, null, { ...validTask, status: 'unknown' }],
        settings: { theme: 'dark', firstDayOfWeek: 1 },
      }),
    )

    const store = getStore()

    expect(store.sections).toEqual([validSection])
    expect(store.tasks).toEqual([validTask])
    expect(store.settings).toEqual({ theme: 'dark', firstDayOfWeek: 1 })
  })

  it('нормализует данные: пропуски в полях получают значения по умолчанию', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        sections: [{ id: 'sec-1', name: 'Раздел' }],
        tasks: [],
        settings: { theme: 'neon', firstDayOfWeek: 7 },
      }),
    )

    const store = getStore()

    expect(store.sections[0]).toMatchObject({ color: '#2f6fed', emoji: '📘', archived: false })
    expect(store.settings).toEqual({ theme: 'system', firstDayOfWeek: 0 })
  })

  it('падение записи в localStorage не ломает setStore', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => setStore((prev) => ({ ...prev }))).not.toThrow()

    vi.restoreAllMocks()
  })
})

describe('подписка', () => {
  it('слушатель получает новое состояние и может отписаться', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeStore(listener)

    setStore((prev) => ({ ...prev, settings: { ...prev.settings, theme: 'dark' } }))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].settings.theme).toBe('dark')

    unsubscribe()
    setStore((prev) => ({ ...prev, settings: { ...prev.settings, theme: 'light' } }))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('setStore с тем же объектом не вызывает уведомления', () => {
    const listener = vi.fn()
    subscribeStore(listener)

    const current = getStore()
    setStore(current)

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('миграции', () => {
  it('данные без schemaVersion получают текущую версию', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sections: [validSection], tasks: [], settings: {} }),
    )

    const store = getStore()

    expect(store.schemaVersion).toBe(SCHEMA_VERSION)
    expect(store.sections).toEqual([validSection])
  })

  it('migrate отклоняет неисправимые данные, но чинит частично валидные', () => {
    expect(migrate(null)).toBeNull()
    expect(migrate('строка')).toBeNull()
    expect(migrate([validSection])).toBeNull()
    expect(migrate({ sections: 'мусор' })).toBeNull()

    // Мало полей — но структура верная: версия проставляется, настройки дополняются
    expect(migrate({ sections: [], tasks: [] })).toEqual({
      schemaVersion: SCHEMA_VERSION,
      sections: [],
      tasks: [],
      settings: { theme: 'system', firstDayOfWeek: 0 },
    })
  })
})
