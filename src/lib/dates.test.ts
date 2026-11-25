import { describe, expect, it } from 'vitest'
import { addDays, formatDate, formatDateRu, isValidDateString, parseDate, today } from './dates'

describe('даты', () => {
  it('today возвращает сегодняшнюю локальную дату YYYY-MM-DD', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(today()).toBe(formatDate(new Date()))
  })

  it('formatDate дополняет месяц и день нулями', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(formatDate(new Date(2026, 10, 23))).toBe('2026-11-23')
  })

  it('addDays переходит через границы месяцев и годов', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29') // високосный год
  })

  it('addDays с нулём и обратным сдвигом — обратима', () => {
    expect(addDays('2026-06-15', 0)).toBe('2026-06-15')
    expect(addDays(addDays('2026-06-15', 7), -7)).toBe('2026-06-15')
  })

  it('isValidDateString принимает только существующие даты', () => {
    expect(isValidDateString('2026-02-28')).toBe(true)
    expect(isValidDateString('2026-02-31')).toBe(false)
    expect(isValidDateString('2026-13-01')).toBe(false)
    expect(isValidDateString('26-01-01')).toBe(false)
    expect(isValidDateString('2026-01-01T00:00:00Z')).toBe(false)
    expect(isValidDateString(42)).toBe(false)
    expect(isValidDateString(null)).toBe(false)
  })

  it('parseDate создаёт локальную дату (полдень)', () => {
    const date = parseDate('2026-06-15')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(5)
    expect(date.getDate()).toBe(15)
    expect(date.getHours()).toBe(12)
  })

  it('formatDateRu преобразует в ДД.ММ.ГГГГ', () => {
    expect(formatDateRu('2026-01-05')).toBe('05.01.2026')
    expect(formatDateRu('2026-11-22')).toBe('22.11.2026')
    expect(formatDateRu('невалидно')).toBe('невалидно')
  })
})
