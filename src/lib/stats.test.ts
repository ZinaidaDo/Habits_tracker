import { describe, expect, it } from 'vitest'
import { addDays, parseDate, today } from './dates'
import { dayTasks } from './day'
import { weekStart } from './progress'
import {
  dailySeries,
  dayStat,
  heatmapGrid,
  intensity,
  pluralDays,
  rangeProgress,
  streaks,
} from './stats'
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

describe('dayStat / intensity', () => {
  // день в прошлом (сегодня − 7), чтобы очередь сегодняшнего дня не влияла
  const day = addDays(today(), -7)

  it('доля выполненных задач дня совпадает с ручным подсчётом', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: day }),
      makeTask('t2', 'a', { status: 'done', completedAt: day }),
      makeTask('t3', 'b', { status: 'planned', dueDate: day }),
      makeTask('t4', 'b', { status: 'done', completedAt: addDays(day, 1) }), // другой день
    ])

    // ручно: день — t1 (done), t2 (done), t3 (planned) → 2 из 3, 67%
    expect(dayStat(store, day)).toEqual({ day, done: 2, total: 3, percent: 67 })
    // пустой день
    expect(dayStat(store, addDays(day, -5))).toEqual({
      day: addDays(day, -5),
      done: 0,
      total: 0,
      percent: 0,
    })
  })

  it('фильтр по разделу считает только задачи этого раздела', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: day }),
      makeTask('t2', 'a', { status: 'planned', dueDate: day }),
      makeTask('t3', 'b', { status: 'done', completedAt: day }),
    ])

    expect(dayStat(store, day, 'a')).toEqual({ day, done: 1, total: 2, percent: 50 })
    expect(dayStat(store, day, 'b')).toEqual({ day, done: 1, total: 1, percent: 100 })
    expect(dayStat(store, day, 'missing')).toEqual({ day, done: 0, total: 0, percent: 0 })
  })

  it('интенсивность: нет задач — none, иначе уровень по доле', () => {
    expect(intensity({ day, done: 0, total: 0, percent: 0 })).toBe('none')
    expect(intensity({ day, done: 0, total: 4, percent: 0 })).toBe(0)
    expect(intensity({ day, done: 1, total: 4, percent: 25 })).toBe(1)
    expect(intensity({ day, done: 2, total: 4, percent: 50 })).toBe(2)
    expect(intensity({ day, done: 3, total: 4, percent: 75 })).toBe(3)
    expect(intensity({ day, done: 4, total: 4, percent: 100 })).toBe(4)
  })
})

describe('heatmapGrid', () => {
  const now = today()
  const lastStart = weekStart(now, 1)
  const firstStart = addDays(lastStart, -11 * 7)

  it('сетка 12 недель × 7 дней: первый день — начало недели, последний — сегодня', () => {
    const grid = heatmapGrid(makeStore([]), now, 1)

    expect(grid).toHaveLength(12)
    for (const week of grid) expect(week).toHaveLength(7)
    expect(grid[0][0].day).toBe(firstStart)
    expect(grid[11][6].day).toBe(addDays(lastStart, 6))
  })

  it('дни после сегодня помечены future и пусты, прошлые — со статистикой', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: now }),
      makeTask('t2', 'b', { status: 'planned', dueDate: now }),
    ])
    const grid = heatmapGrid(store, now, 1)

    const futureCells = grid.flat().filter((cell) => cell.future)
    const pastCells = grid.flat().filter((cell) => !cell.future)

    // в текущей неделе после сегодня — оставшиеся дни до конца недели
    const offsetInWeek = (parseDate(now).getDay() + 6) % 7 // понедельник = 0
    expect(futureCells.length).toBe(6 - offsetInWeek)
    for (const cell of futureCells) {
      expect(cell.day > now).toBe(true)
      expect(cell.total).toBe(0)
    }
    for (const cell of pastCells) {
      expect(cell.day <= now).toBe(true)
    }
    const todayCell = pastCells.find((cell) => cell.day === now)
    expect(todayCell).toMatchObject({ done: 1, total: 2, future: false })
  })

  it('начало сетки зависит от первого дня недели', () => {
    const sundayStart = weekStart(now, 0)
    const gridSunday = heatmapGrid(makeStore([]), now, 0)
    expect(gridSunday[0][0].day).toBe(addDays(sundayStart, -11 * 7))
    expect(gridSunday[11][6].day).toBe(addDays(sundayStart, 6))
  })

  it('фильтр по разделу меняет интенсивность ячеек', () => {
    const day = addDays(now, -3)
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: day }),
      makeTask('t2', 'a', { status: 'planned', dueDate: day }),
      makeTask('t3', 'b', { status: 'done', completedAt: day }),
    ])

    const gridAll = heatmapGrid(store, now, 1)
    const gridA = heatmapGrid(store, now, 1, 'a')
    const cellOf = (grid: ReturnType<typeof heatmapGrid>) =>
      grid.flat().find((cell) => cell.day === day)

    expect(cellOf(gridAll)).toMatchObject({ done: 2, total: 3, percent: 67 })
    expect(cellOf(gridA)).toMatchObject({ done: 1, total: 2, percent: 50 })
  })
})

describe('streaks', () => {
  const now = today()

  it('серия растёт от сегодняшней отметки и обрывается пропуском дня', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: now }),
      makeTask('t2', 'a', { status: 'done', completedAt: addDays(now, -1) }),
      makeTask('t3', 'a', { status: 'done', completedAt: addDays(now, -2) }),
      // пропуск: addDays(now, -3) без отметок
      makeTask('t4', 'a', { status: 'done', completedAt: addDays(now, -4) }),
    ])

    // ручная серия: сегодня, вчера, позавчера → 3; пропуск обрывает
    expect(streaks(store)).toEqual({ current: 3, best: 3 })
  })

  it('сегодня без отметки, но вчера серия ждёт сегодняшнего дня', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: addDays(now, -1) }),
      makeTask('t2', 'a', { status: 'done', completedAt: addDays(now, -2) }),
    ])

    expect(streaks(store)).toEqual({ current: 2, best: 2 })
  })

  it('лучшая серия — максимум подряд, даже если текущая короче', () => {
    const store = makeStore([
      // текущая серия: сегодня
      makeTask('t1', 'a', { status: 'done', completedAt: now }),
      // пропуск вчера, затем 5 дней подряд
      makeTask('t2', 'a', { status: 'done', completedAt: addDays(now, -2) }),
      makeTask('t3', 'a', { status: 'done', completedAt: addDays(now, -3) }),
      makeTask('t4', 'a', { status: 'done', completedAt: addDays(now, -4) }),
      makeTask('t5', 'a', { status: 'done', completedAt: addDays(now, -5) }),
      makeTask('t6', 'a', { status: 'done', completedAt: addDays(now, -6) }),
      // одна отметка вне серии
      makeTask('t7', 'a', { status: 'done', completedAt: addDays(now, -10) }),
    ])

    expect(streaks(store)).toEqual({ current: 1, best: 5 })
  })

  it('две отметки в один день не удлиняют серию', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: now }),
      makeTask('t2', 'a', { status: 'done', completedAt: now }),
      makeTask('t3', 'a', { status: 'done', completedAt: addDays(now, -1) }),
    ])

    expect(streaks(store)).toEqual({ current: 2, best: 2 })
  })

  it('без отметок серия нулевая; фильтр раздела учитывает только его отметки', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: now }),
      makeTask('t2', 'b', { status: 'done', completedAt: addDays(now, -1) }),
      makeTask('t3', 'a', { status: 'planned' }),
    ])

    expect(streaks(makeStore([]))).toEqual({ current: 0, best: 0 })
    // раздел a: только сегодня → 1; раздел b: только вчера (сегодня нет) → 1
    expect(streaks(store, 'a')).toEqual({ current: 1, best: 1 })
    expect(streaks(store, 'b')).toEqual({ current: 1, best: 1 })
  })

  it('серия на границе месяцев и лет считается по календарю', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: '2026-03-01' }),
      makeTask('t2', 'a', { status: 'done', completedAt: '2026-02-28' }),
      makeTask('t3', 'a', { status: 'done', completedAt: '2026-02-27' }),
      makeTask('t4', 'a', { status: 'done', completedAt: '2026-01-31' }), // пропуск — не в серии
    ])

    expect(streaks(store, null, '2026-03-01')).toEqual({ current: 3, best: 3 })
  })
})

describe('rangeProgress', () => {
  const now = today()

  it('процент за период без дублей совпадает с ручным подсчётом', () => {
    const from = addDays(now, -6)
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: from }),
      makeTask('t2', 'a', { status: 'planned', dueDate: addDays(now, -3) }),
      // t3 выполнена и в понедельник, и в среду — считается один раз
      makeTask('t3', 'b', { status: 'done', completedAt: addDays(now, -5) }),
      makeTask('t4', 'b', { status: 'done', completedAt: addDays(now, -1) }),
      makeTask('t5', 'b', { status: 'done', completedAt: addDays(now, -20) }), // вне периода
    ])

    // ручной подсчёт: t1(done), t2(planned), t3(done), t4(done) → 3 из 4, 75%
    expect(rangeProgress(store, from, now)).toEqual({ done: 3, total: 4, percent: 75 })
    expect(rangeProgress(store, from, now, 'a')).toEqual({ done: 1, total: 2, percent: 50 })
    expect(rangeProgress(store, from, now, 'b')).toEqual({ done: 2, total: 2, percent: 100 })
    expect(rangeProgress(store, addDays(now, -1), addDays(now, -1))).toEqual({
      done: 1,
      total: 1,
      percent: 100,
    })
  })

  it('пустой период — 0%', () => {
    const store = makeStore([makeTask('t1', 'a', { status: 'done', completedAt: now })])
    expect(rangeProgress(store, addDays(now, -5), addDays(now, -2))).toEqual({
      done: 0,
      total: 0,
      percent: 0,
    })
  })
})

describe('dailySeries', () => {
  const now = today()

  it('ряд за N дней идёт от старых к новым и содержит каждый день ровно раз', () => {
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: now }),
      makeTask('t2', 'a', { status: 'planned', dueDate: addDays(now, -2) }),
    ])

    const series = dailySeries(store, now, 30)
    expect(series).toHaveLength(30)
    expect(series[0].day).toBe(addDays(now, -29))
    expect(series[29].day).toBe(now)
    expect(new Set(series.map((stat) => stat.day)).size).toBe(30)

    // ручная сверка: сегодня t1 (done) + рабочая очередь с t2 (planned) → 1 из 2
    const todayStat = series[series.length - 1]
    expect(todayStat).toMatchObject({ done: 1, total: 2, percent: 50 })
    const twoDaysAgo = series.find((stat) => stat.day === addDays(now, -2))
    expect(twoDaysAgo).toMatchObject({ done: 0, total: 1, percent: 0 })
  })

  it('фильтр по разделу влияет на ряд', () => {
    const day = addDays(now, -1)
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: day }),
      makeTask('t2', 'b', { status: 'planned', dueDate: day }),
    ])

    const seriesA = dailySeries(store, now, 7, 'a')
    const seriesB = dailySeries(store, now, 7, 'b')
    expect(seriesA.find((stat) => stat.day === day)).toMatchObject({ done: 1, total: 1 })
    expect(seriesB.find((stat) => stat.day === day)).toMatchObject({ done: 0, total: 1 })
  })
})

describe('pluralDays', () => {
  it('склоняет «день» по правилам русского языка', () => {
    expect(pluralDays(0)).toBe('0 дней')
    expect(pluralDays(1)).toBe('1 день')
    expect(pluralDays(2)).toBe('2 дня')
    expect(pluralDays(4)).toBe('4 дня')
    expect(pluralDays(5)).toBe('5 дней')
    expect(pluralDays(11)).toBe('11 дней')
    expect(pluralDays(21)).toBe('21 день')
    expect(pluralDays(22)).toBe('22 дня')
    expect(pluralDays(100)).toBe('100 дней')
  })
})

describe('heatmap и streak устойчивы к локальным датам', () => {
  it('ячейки heatmap — валидные локальные даты без сдвигов', () => {
    const now = today()
    const grid = heatmapGrid(makeStore([]), now, 1)

    for (const cell of grid.flat()) {
      const [year, month, day] = cell.day.split('-').map(Number)
      const date = new Date(year, month - 1, day, 12)
      expect(date.getFullYear()).toBe(year)
      expect(date.getMonth() + 1).toBe(month)
      expect(date.getDate()).toBe(day)
    }
  })

  it('задача дня heatmap совпадает с dayTasks того же дня', () => {
    const day = addDays(today(), -4)
    const store = makeStore([
      makeTask('t1', 'a', { status: 'done', completedAt: day }),
      makeTask('t2', 'b', { status: 'planned', dueDate: day }),
    ])
    const manual = dayTasks(store, day)
    expect(dayStat(store, day).total).toBe(manual.length)
    expect(dayStat(store, day).done).toBe(manual.filter((task) => task.status === 'done').length)
  })
})
