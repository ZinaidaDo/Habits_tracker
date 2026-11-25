import { describe, expect, it } from 'vitest'
import { addDays, today } from './dates'
import { dayProgress, dayTasks, isFutureDay, markTask, unmarkTask } from './day'
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

function makeTask(id: string, sectionId: string, order: number, patch: Partial<Task> = {}): Task {
  return {
    id,
    sectionId,
    title: `Задача ${id}`,
    status: 'planned',
    order,
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
    settings: { theme: 'system', firstDayOfWeek: 0 },
  }
}

describe('dayTasks', () => {
  it('сегодня: активные + отмеченные сегодня + со сроком сегодня, без дублей', () => {
    const day = today()
    const store = makeStore([
      makeTask('t1', 'a', 0, { status: 'in_progress' }), // рабочая очередь
      makeTask('t2', 'a', 1, { status: 'done', completedAt: day }), // отмечена сегодня
      makeTask('t3', 'b', 2, { dueDate: day }), // срок сегодня
      makeTask('t4', 'b', 3, { status: 'done', completedAt: addDays(day, -1) }), // чужой день
      makeTask('t5', 'b', 4, { dueDate: day, status: 'done', completedAt: day }), // и то и другое
    ])

    expect(dayTasks(store, day).map((task) => task.id)).toEqual(['t1', 't2', 't3', 't5'])
  })

  it('прошлый день: только отметки и сроки этого дня', () => {
    const day = addDays(today(), -1)
    const store = makeStore([
      makeTask('t1', 'a', 0, { status: 'done', completedAt: day }),
      makeTask('t2', 'a', 1, { dueDate: day, status: 'in_progress' }),
      makeTask('t3', 'b', 2, { status: 'in_progress' }), // активная, но не этого дня
      makeTask('t4', 'b', 3, { status: 'done', completedAt: today() }),
    ])

    expect(dayTasks(store, day).map((task) => task.id)).toEqual(['t1', 't2'])
  })

  it('исключает задачи удалённых разделов', () => {
    const store = makeStore([makeTask('t1', 'ghost', 0)])
    expect(dayTasks(store, today())).toEqual([])
  })
})

describe('dayProgress', () => {
  it('считает выполненные из общего числа', () => {
    const day = today()
    const tasks = [
      makeTask('t1', 'a', 0, { status: 'done', completedAt: day }),
      makeTask('t2', 'a', 1, { status: 'in_progress' }),
      makeTask('t3', 'b', 2, { status: 'planned' }),
    ]
    expect(dayProgress(tasks)).toEqual({ done: 1, total: 3 })
    expect(dayProgress([])).toEqual({ done: 0, total: 0 })
  })
})

describe('markTask', () => {
  it('ставит отметку с датой и запоминает прежний статус', () => {
    const day = addDays(today(), -1)
    const store = makeStore([makeTask('t1', 'a', 0, { status: 'in_progress' })])

    const next = markTask(store, 't1', day)
    const task = next.tasks[0]

    expect(task.status).toBe('done')
    expect(task.previousStatus).toBe('in_progress')
    expect(task.completedAt).toBe(day)
    expect(task.lastStatusChangeAt).toBe(day)
    // исходный стор не мутируется
    expect(store.tasks[0].status).toBe('in_progress')
  })

  it('запрещает будущие даты', () => {
    const store = makeStore([makeTask('t1', 'a', 0)])
    expect(isFutureDay(addDays(today(), 1))).toBe(true)
    expect(isFutureDay(today())).toBe(false)
    expect(() => markTask(store, 't1', addDays(today(), 1))).toThrow(/будущую дату/)
  })

  it('неизвестная задача и повторная отметка — без изменений', () => {
    const store = makeStore([makeTask('t1', 'a', 0, { status: 'done', completedAt: today() })])
    expect(markTask(store, 'missing', today())).toBe(store)
    expect(markTask(store, 't1', today())).toBe(store)
  })
})

describe('unmarkTask', () => {
  it('возвращает прежний статус и снимает дату', () => {
    const day = today()
    const store = makeStore([
      makeTask('t1', 'a', 0, {
        status: 'done',
        previousStatus: 'postponed',
        completedAt: day,
      }),
    ])

    const task = unmarkTask(store, 't1').tasks[0]
    expect(task.status).toBe('postponed')
    expect(task.completedAt).toBeUndefined()
    expect(task.previousStatus).toBeUndefined()
  })

  it('без прежнего статуса возвращает «В работе»', () => {
    const store = makeStore([makeTask('t1', 'a', 0, { status: 'done', completedAt: today() })])
    expect(unmarkTask(store, 't1').tasks[0].status).toBe('in_progress')
  })

  it('недоданная задача не меняется', () => {
    const store = makeStore([makeTask('t1', 'a', 0, { status: 'planned' })])
    expect(unmarkTask(store, 't1')).toBe(store)
  })
})
