import { describe, expect, it } from 'vitest'
import { addDays, today } from './dates'
import { dayTasks } from './day'
import { sectionProgress, tasksProgress, weekProgress, weekStart, weekTasks } from './progress'
import type { Section, Store, Task } from './types'

function makeSection(id: string, order: number): Section {
  return {
    id,
    name: `Раздел ${id}`,
    color: '#000000',
    emoji: '📘',
    order,
    archived: false,
    createdAt: '2026-01-01',
  }
}

function makeTask(id: string, sectionId: string, patch: Partial<Task> = {}): Task {
  return {
    id,
    sectionId,
    title: `Задача ${id}`,
    status: 'planned',
    order: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...patch,
  }
}

function makeStore(tasks: Task[]): Store {
  return {
    schemaVersion: 1,
    sections: [makeSection('a', 0), makeSection('b', 1)],
    tasks,
    settings: { theme: 'system', firstDayOfWeek: 1 },
  }
}

describe('tasksProgress / sectionProgress', () => {
  it('считает выполненные, процент округляется, пустой список — 0%', () => {
    expect(tasksProgress([])).toEqual({ done: 0, total: 0, percent: 0 })
    expect(
      tasksProgress([
        makeTask('t1', 'a', { status: 'done' }),
        makeTask('t2', 'a'),
        makeTask('t3', 'a', { status: 'done' }),
      ]),
    ).toEqual({ done: 2, total: 3, percent: 67 })
  })

  it('прогресс раздела совпадает с ручным подсчётом по его задачам', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done' }),
      makeTask('t2', 'a', { status: 'done' }),
      makeTask('t3', 'a', { status: 'in_progress' }),
      makeTask('t4', 'b'),
    ])

    // ручной подсчёт по тестовым данным
    const manualA = { done: 2, total: 3, percent: 67 }
    const manualB = { done: 0, total: 1, percent: 0 }
    expect(sectionProgress(store, 'a')).toEqual(manualA)
    expect(sectionProgress(store, 'b')).toEqual(manualB)
    expect(sectionProgress(store, 'missing')).toEqual({ done: 0, total: 0, percent: 0 })
  })
})

describe('weekStart', () => {
  it('понедельник — начало недели при firstDayOfWeek = 1', () => {
    expect(weekStart('2026-11-23', 1)).toBe('2026-11-23') // понедельник
    expect(weekStart('2026-11-25', 1)).toBe('2026-11-23') // среда
    expect(weekStart('2026-11-22', 1)).toBe('2026-11-16') // воскресенье → прошлый понедельник
  })

  it('воскресенье — начало недели при firstDayOfWeek = 0', () => {
    expect(weekStart('2026-11-22', 0)).toBe('2026-11-22')
    expect(weekStart('2026-11-23', 0)).toBe('2026-11-22')
    expect(weekStart('2026-11-25', 0)).toBe('2026-11-22')
  })
})

describe('weekTasks / weekProgress', () => {
  // неделя в прошлом (день = сегодня − 7), чтобы очередь сегодняшнего дня
  // не попадала в диапазон и результат не зависел от календаря
  const day = addDays(today(), -7)
  const start = weekStart(day, 1)

  const store = makeStore([
    makeTask('t1', 'a', { status: 'done', completedAt: start }),
    makeTask('t2', 'a', { status: 'planned', dueDate: day }),
    makeTask('t3', 'b', { status: 'done', completedAt: day }),
    makeTask('t4', 'b', { status: 'done', completedAt: addDays(start, -1) }), // прошлая неделя
    makeTask('t5', 'b', { status: 'in_progress' }), // без дат — в неделю не попадает
    makeTask('t6', 'a', { status: 'done', completedAt: addDays(day, 1) }), // после дня
  ])

  it('собирает задачи всех дней недели без дублей', () => {
    expect(weekTasks(store, day, 1).map((task) => task.id)).toEqual(['t1', 't2', 't3'])
  })

  it('прогресс недели совпадает с ручным подсчётом', () => {
    // вручную: неделя — t1 (выполнена), t2 (не выполнена), t3 (выполнена)
    expect(weekProgress(store, day, 1)).toEqual({ done: 2, total: 3, percent: 67 })
  })

  it('вклад дня не превышает неделю: день ⊂ неделя', () => {
    const dayTasksIds = dayTasks(store, start).map((task) => task.id)
    const weekIds = new Set(weekTasks(store, start, 1).map((task) => task.id))
    for (const id of dayTasksIds) expect(weekIds.has(id)).toBe(true)
  })
})
