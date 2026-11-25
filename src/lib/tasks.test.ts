import { describe, expect, it } from 'vitest'
import { today } from './dates'
import {
  createTask,
  deleteTask,
  moveTask,
  setTaskStatus,
  TASK_TITLE_MAX,
  tasksInSection,
  tasksByStatus,
  updateTask,
  validateTaskTitle,
} from './tasks'
import type { Section, Store, Task } from './types'

function makeSection(id: string): Section {
  return {
    id,
    name: `Раздел ${id}`,
    color: '#000000',
    emoji: '📘',
    order: 0,
    archived: false,
    createdAt: '2026-01-01',
  }
}

function makeTask(id: string, sectionId: string, order: number): Task {
  return {
    id,
    sectionId,
    title: `Задача ${id}`,
    status: 'planned',
    order,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }
}

function makeStore(): Store {
  return {
    schemaVersion: 1,
    sections: [makeSection('a'), makeSection('b')],
    tasks: [makeTask('t1', 'a', 0), makeTask('t2', 'a', 1), makeTask('t3', 'b', 2)],
    settings: { theme: 'system', firstDayOfWeek: 0 },
  }
}

describe('validateTaskTitle', () => {
  it('отклоняет пустое имя, принимает в пределах лимита', () => {
    expect(validateTaskTitle('')).not.toBeNull()
    expect(validateTaskTitle('   ')).not.toBeNull()
    expect(validateTaskTitle('Решить задачу')).toBeNull()
    expect(validateTaskTitle('А'.repeat(TASK_TITLE_MAX))).toBeNull()
    expect(validateTaskTitle('А'.repeat(TASK_TITLE_MAX + 1))).not.toBeNull()
  })
})

describe('createTask', () => {
  it('добавляет задачу в конец с сегодняшней датой', () => {
    const store = makeStore()
    const next = createTask(store, {
      title: '  Новая задача  ',
      description: '  Описание  ',
      sectionId: 'a',
      status: 'planned',
      dueDate: '2026-12-31',
    })

    expect(next.tasks).toHaveLength(4)
    expect(next.tasks[3]).toMatchObject({
      title: 'Новая задача',
      description: 'Описание',
      sectionId: 'a',
      status: 'planned',
      order: 3,
      dueDate: '2026-12-31',
      createdAt: today(),
    })
    expect(next.tasks[3].completedAt).toBeUndefined()
    expect(store.tasks).toHaveLength(3) // иммутабельность
  })

  it('при статусе «done» сразу ставит дату выполнения', () => {
    const next = createTask(makeStore(), {
      title: 'Сделано',
      sectionId: 'a',
      status: 'done',
    })

    expect(next.tasks[3].completedAt).toBe(today())
  })

  it('бросает ошибку на пустом имени и неизвестном разделе', () => {
    const store = makeStore()
    expect(() => createTask(store, { title: ' ', sectionId: 'a', status: 'planned' })).toThrow()
    expect(() => createTask(store, { title: 'X', sectionId: 'нет', status: 'planned' })).toThrow()
  })
})

describe('updateTask', () => {
  it('меняет название, описание и срок', () => {
    const store = makeStore()
    const next = updateTask(store, 't1', {
      title: ' Другое название ',
      description: 'Новое описание',
      dueDate: '2026-06-01',
    })

    expect(next.tasks[0]).toMatchObject({
      title: 'Другое название',
      description: 'Новое описание',
      dueDate: '2026-06-01',
      updatedAt: today(),
    })
    expect(next.tasks[1]).toEqual(store.tasks[1]) // не тронута
  })

  it('очищает описание и срок переданным undefined', () => {
    const store = makeStore()
    store.tasks[0] = { ...store.tasks[0], description: 'Было', dueDate: '2026-06-01' }

    const next = updateTask(store, 't1', { description: undefined, dueDate: undefined })

    expect(next.tasks[0].description).toBeUndefined()
    expect(next.tasks[0].dueDate).toBeUndefined()
  })

  it('перевод в «done» датирует, выход из «done» снимает дату', () => {
    const store = makeStore()

    const done = updateTask(store, 't1', { status: 'done' })
    expect(done.tasks[0].completedAt).toBe(today())
    expect(done.tasks[0].lastStatusChangeAt).toBe(today())

    const undone = updateTask(done, 't1', { status: 'in_progress' })
    expect(undone.tasks[0].completedAt).toBeUndefined()

    // повторный перевод в «done» после сброса датируется заново
    const redone = updateTask(undone, 't1', { status: 'done' })
    expect(redone.tasks[0].completedAt).toBe(today())
  })

  it('смена раздела переносит задачу в конец нового раздела', () => {
    const store = makeStore()
    const next = updateTask(store, 't1', { sectionId: 'b' })

    expect(next.tasks[0].sectionId).toBe('b')
    expect(next.tasks[0].order).toBe(3) // глобальный max + 1
    expect(tasksInSection(next, 'b').map((task) => task.id)).toEqual(['t3', 't1'])
    expect(tasksInSection(next, 'a').map((task) => task.id)).toEqual(['t2'])
  })

  it('неизвестный id — без изменений; пустое имя — ошибка', () => {
    const store = makeStore()
    expect(updateTask(store, 'нет', { title: 'X' })).toBe(store)
    expect(() => updateTask(store, 't1', { title: ' ' })).toThrow()
    expect(() => updateTask(store, 't1', { sectionId: 'нет' })).toThrow()
  })
})

describe('deleteTask', () => {
  it('удаляет задачу; неизвестный id — без изменений', () => {
    const store = makeStore()
    const next = deleteTask(store, 't1')

    expect(next.tasks.map((task) => task.id)).toEqual(['t2', 't3'])
    expect(deleteTask(store, 'нет')).toBe(store)
  })
})

describe('moveTask', () => {
  it('перемещает вверх/вниз внутри раздела', () => {
    const store = makeStore()

    expect(tasksInSection(moveTask(store, 't2', -1), 'a').map((t) => t.id)).toEqual(['t2', 't1'])
    expect(tasksInSection(moveTask(store, 't1', 1), 'a').map((t) => t.id)).toEqual(['t2', 't1'])
  })

  it('останавливается на границах раздела', () => {
    const store = makeStore()
    expect(moveTask(store, 't1', -1)).toBe(store)
    expect(moveTask(store, 't2', 1)).toBe(store)
    expect(moveTask(store, 'нет', -1)).toBe(store)
  })

  it('не затрагивает порядок других разделов', () => {
    const store = makeStore()
    const next = moveTask(store, 't1', 1)
    expect(next.tasks.find((task) => task.id === 't3')?.order).toBe(2)
  })
})

describe('tasksInSection', () => {
  it('возвращает задачи раздела по порядку', () => {
    const store = makeStore()
    expect(tasksInSection(store, 'a').map((task) => task.id)).toEqual(['t1', 't2'])
    expect(tasksInSection(store, 'b').map((task) => task.id)).toEqual(['t3'])
    expect(tasksInSection(store, 'нет')).toEqual([])
  })
})

describe('tasksByStatus', () => {
  it('группирует задачи раздела по четырём статусам', () => {
    const store = makeStore()
    store.tasks = [
      { ...store.tasks[0], status: 'planned' },
      { ...store.tasks[1], status: 'done' },
      { ...store.tasks[2], status: 'postponed' },
    ]

    const grouped = tasksByStatus(store, 'a')
    expect(grouped.planned.map((task) => task.id)).toEqual(['t1'])
    expect(grouped.done.map((task) => task.id)).toEqual(['t2'])
    expect(grouped.in_progress).toEqual([])
    expect(grouped.postponed).toEqual([])
    expect(tasksByStatus(store, 'нет').planned).toEqual([])
  })
})

describe('setTaskStatus', () => {
  it('переводит в новый статус и ставит lastStatusChangeAt', () => {
    const store = makeStore()
    const next = setTaskStatus(store, 't1', 'in_progress')

    expect(next.tasks[0].status).toBe('in_progress')
    expect(next.tasks[0].lastStatusChangeAt).toBe(today())
    expect(next.tasks[0].updatedAt).toBe(today())
    expect(next.tasks[0].completedAt).toBeUndefined()
    expect(store.tasks[0].status).toBe('planned') // иммутабельность
  })

  it('перевод в «done» ставит completedAt, выход — снимает', () => {
    const store = makeStore()

    const done = setTaskStatus(store, 't1', 'done')
    expect(done.tasks[0].completedAt).toBe(today())

    const undone = setTaskStatus(done, 't1', 'postponed')
    expect(undone.tasks[0].completedAt).toBeUndefined()
    expect(undone.tasks[0].lastStatusChangeAt).toBe(today())
  })

  it('тот же статус и неизвестный id — без изменений', () => {
    const store = makeStore()
    expect(setTaskStatus(store, 't1', 'planned')).toBe(store)
    expect(setTaskStatus(store, 'нет', 'done')).toBe(store)
  })
})
