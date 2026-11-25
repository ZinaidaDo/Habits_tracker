import { describe, expect, it } from 'vitest'
import { today } from './dates'
import {
  activeSections,
  archivedSections,
  countTasksInSection,
  createSection,
  deleteSection,
  moveSection,
  SECTION_NAME_MAX,
  setSectionArchived,
  updateSection,
  validateSectionName,
} from './sections'
import type { Section, Store, Task } from './types'

function makeTask(id: string, sectionId: string, status: Task['status'] = 'planned'): Task {
  return {
    id,
    sectionId,
    title: `Задача ${id}`,
    status,
    order: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }
}

function makeSection(id: string, order: number, archived = false): Section {
  return {
    id,
    name: `Раздел ${id}`,
    color: '#000000',
    emoji: '📘',
    order,
    archived,
    createdAt: '2026-01-01',
  }
}

function makeStore(): Store {
  return {
    schemaVersion: 1,
    sections: [
      makeSection('a', 0),
      makeSection('b', 1),
      makeSection('c', 2),
      makeSection('old', 3, true),
    ],
    tasks: [
      makeTask('t1', 'b'),
      makeTask('t2', 'b'),
      makeTask('t3', 'b', 'done'),
      makeTask('t4', 'a'),
    ],
    settings: { theme: 'system', firstDayOfWeek: 0 },
  }
}

describe('validateSectionName', () => {
  it('отклоняет пустое имя и одни пробелы', () => {
    expect(validateSectionName('')).not.toBeNull()
    expect(validateSectionName('   ')).not.toBeNull()
  })

  it('принимает имя в пределах лимита', () => {
    expect(validateSectionName('Алгебра')).toBeNull()
    expect(validateSectionName('  История  ')).toBeNull()
    expect(validateSectionName('А'.repeat(SECTION_NAME_MAX))).toBeNull()
    expect(validateSectionName('А'.repeat(SECTION_NAME_MAX + 1))).not.toBeNull()
  })
})

describe('createSection', () => {
  it('добавляет раздел в конец с сегодняшней датой', () => {
    const store = makeStore()
    const next = createSection(store, { name: '  История  ', emoji: '📜', color: '#abcdef' })

    expect(next.sections).toHaveLength(5)
    expect(next.sections[4]).toMatchObject({
      name: 'История',
      emoji: '📜',
      color: '#abcdef',
      order: 4,
      archived: false,
      createdAt: today(),
    })
    expect(store.sections).toHaveLength(4) // исходный стор не мутирован
  })

  it('бросает ошибку на пустом имени', () => {
    expect(() => createSection(makeStore(), { name: ' ', emoji: 'x', color: '#000' })).toThrow()
  })
})

describe('updateSection', () => {
  it('меняет имя, иконку и цвет; не трогает остальные', () => {
    const store = makeStore()
    const next = updateSection(store, 'b', { name: ' Математика ', emoji: '🧮', color: '#123456' })

    expect(next.sections[1]).toMatchObject({
      name: 'Математика',
      emoji: '🧮',
      color: '#123456',
      order: 1,
    })
    expect(next.sections[0]).toEqual(store.sections[0])
  })

  it('неизвестный id — без изменений (тот же объект)', () => {
    const store = makeStore()
    expect(updateSection(store, 'нет-такого', { name: 'X' })).toBe(store)
  })

  it('бросает ошибку на пустом имени', () => {
    expect(() => updateSection(makeStore(), 'b', { name: '' })).toThrow()
  })
})

describe('moveSection', () => {
  it('перемещает вверх, меняя порядок местами', () => {
    const store = makeStore()
    const next = moveSection(store, 'b', -1)

    expect(activeSections(next).map((section) => section.id)).toEqual(['b', 'a', 'c'])
    expect(new Set(next.sections.map((section) => section.order)).size).toBe(4) // порядки уникальны
  })

  it('перемещает вниз и останавливается на границе', () => {
    const store = makeStore()

    expect(activeSections(moveSection(store, 'a', 1)).map((s) => s.id)).toEqual(['b', 'a', 'c'])
    expect(moveSection(store, 'c', 1)).toBe(store)
    expect(moveSection(store, 'a', -1)).toBe(store)
  })

  it('не пересекает группу активных и архивных', () => {
    const store = makeStore()

    // «old» — единственный архивный, двигать некуда
    expect(moveSection(store, 'old', -1)).toBe(store)
    // активный раздел не соседствует с архивным при обмене
    const next = moveSection(store, 'c', 1)
    expect(next.sections.find((section) => section.id === 'old')?.order).toBe(3)
    expect(next.sections.find((section) => section.id === 'c')?.order).toBe(2)
  })
})

describe('setSectionArchived', () => {
  it('архивирует и возвращает раздел', () => {
    const store = makeStore()

    const archived = setSectionArchived(store, 'a', true)
    expect(activeSections(archived).map((s) => s.id)).toEqual(['b', 'c'])
    expect(archivedSections(archived).map((s) => s.id)).toEqual(['a', 'old']) // сортировка по order

    const restored = setSectionArchived(archived, 'a', false)
    expect(activeSections(restored).map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('неизвестный id — без изменений', () => {
    const store = makeStore()
    expect(setSectionArchived(store, 'нет', true)).toBe(store)
  })
})

describe('deleteSection', () => {
  it('с fate: move переносит задачи и сохраняет их количество', () => {
    const store = makeStore()
    const next = deleteSection(store, 'b', { action: 'move', targetSectionId: 'a' })

    expect(next.sections.map((s) => s.id)).toEqual(['a', 'c', 'old'])
    expect(next.tasks).toHaveLength(4)
    // t1, t2, t3 переехали в «a», t4 и так был там
    expect(next.tasks.filter((task) => task.sectionId === 'a')).toHaveLength(4)
    expect(next.tasks.find((task) => task.id === 't4')?.sectionId).toBe('a')
  })

  it('с fate: delete удаляет задачи раздела', () => {
    const store = makeStore()
    const next = deleteSection(store, 'b', { action: 'delete' })

    expect(next.sections.map((s) => s.id)).toEqual(['a', 'c', 'old'])
    expect(next.tasks.map((task) => task.id)).toEqual(['t4'])
  })

  it('неизвестный id — без изменений', () => {
    const store = makeStore()
    expect(deleteSection(store, 'нет', { action: 'delete' })).toBe(store)
  })

  it('перенос в несуществующий или в сам себя — ошибка', () => {
    const store = makeStore()
    expect(() => deleteSection(store, 'b', { action: 'move', targetSectionId: 'нет' })).toThrow()
    expect(() => deleteSection(store, 'b', { action: 'move', targetSectionId: 'b' })).toThrow()
  })
})

describe('countTasksInSection', () => {
  it('считает всего и выполненных', () => {
    const store = makeStore()

    expect(countTasksInSection(store, 'b')).toEqual({ total: 3, done: 1 })
    expect(countTasksInSection(store, 'a')).toEqual({ total: 1, done: 0 })
    expect(countTasksInSection(store, 'нет')).toEqual({ total: 0, done: 0 })
  })
})

describe('сортировка', () => {
  it('activeSections и archivedSections сортируют по order', () => {
    const store = makeStore()
    store.sections = [
      makeSection('x', 5),
      makeSection('y', 1),
      makeSection('z', 3, true),
      makeSection('w', 0, true),
    ]

    expect(activeSections(store).map((s) => s.id)).toEqual(['y', 'x'])
    expect(archivedSections(store).map((s) => s.id)).toEqual(['w', 'z'])
  })
})
