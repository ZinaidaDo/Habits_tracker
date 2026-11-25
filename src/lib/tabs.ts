export const TABS = [
  { id: 'today', title: 'Сегодня' },
  { id: 'board', title: 'Доска' },
  { id: 'stats', title: 'Статистика' },
  { id: 'settings', title: 'Настройки' },
] as const

export type TabId = (typeof TABS)[number]['id']
