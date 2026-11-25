const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Локальная дата → строка YYYY-MM-DD (без сдвигов часовых поясов). */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Сегодняшняя локальная дата в формате YYYY-MM-DD. */
export function today(): string {
  return formatDate(new Date())
}

/**
 * Строка YYYY-MM-DD → локальный Date (полдень, чтобы переход на летнее время
 * не сдвигал дату). Вызывайте только после isValidDateString.
 */
export function parseDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

/** Существующая календарная дата в формате YYYY-MM-DD (отсекает 2026-02-31). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  return formatDate(parseDate(value)) === value
}

/** Строка YYYY-MM-DD → ДД.ММ.ГГГГ для отображения; иначе исходная строка. */
export function formatDateRu(dateString: string): string {
  if (!isValidDateString(dateString)) return dateString
  const [year, month, day] = dateString.split('-')
  return `${day}.${month}.${year}`
}

/** Сдвиг даты на N дней; поддерживает отрицательные значения. */
export function addDays(dateString: string, days: number): string {
  const date = parseDate(dateString)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}
