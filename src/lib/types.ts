export const STATUSES = ['planned', 'in_progress', 'postponed', 'done'] as const

export type Status = (typeof STATUSES)[number]

export const STATUS_LABELS: Record<Status, string> = {
  planned: 'Запланирована',
  in_progress: 'В работе',
  postponed: 'Отложена',
  done: 'Выполнена',
}

export type Section = {
  id: string
  name: string
  color: string
  emoji: string
  order: number
  archived: boolean
  createdAt: string // YYYY-MM-DD
}

export type Task = {
  id: string
  sectionId: string
  title: string
  description?: string
  status: Status
  /** Статус до перевода в «Выполнена» — возвращается при снятии отметки. */
  previousStatus?: Status
  dueDate?: string // YYYY-MM-DD
  completedAt?: string // YYYY-MM-DD — дата отметки «выполнено»
  lastStatusChangeAt?: string // YYYY-MM-DD
  order: number
  createdAt: string // YYYY-MM-DD
  updatedAt: string // YYYY-MM-DD
}

export type ThemeSetting = 'system' | 'light' | 'dark'

export type Settings = {
  theme: ThemeSetting
  firstDayOfWeek: 0 | 1
}

export type Store = {
  schemaVersion: number
  sections: Section[]
  tasks: Task[]
  settings: Settings
}
