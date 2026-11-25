import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore, setStore, STORAGE_KEY } from '../lib/store'
import { useStore } from './useStore'

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

describe('useStore', () => {
  it('возвращает текущее состояние', () => {
    const { result } = renderHook(() => useStore())

    expect(result.current.sections).toHaveLength(3)
    expect(result.current.schemaVersion).toBe(1)
  })

  it('перерисовывается при setStore', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      setStore((prev) => ({ ...prev, settings: { ...prev.settings, theme: 'dark' } }))
    })

    expect(result.current.settings.theme).toBe('dark')
  })

  it('читает данные, записанные до рендера (имитация перезагрузки)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        sections: [{ id: 'sec-x', name: 'Сохранённый раздел' }],
        tasks: [],
        settings: { theme: 'light', firstDayOfWeek: 1 },
      }),
    )

    const { result } = renderHook(() => useStore())

    expect(result.current.sections).toHaveLength(1)
    expect(result.current.settings).toEqual({ theme: 'light', firstDayOfWeek: 1 })
  })
})
