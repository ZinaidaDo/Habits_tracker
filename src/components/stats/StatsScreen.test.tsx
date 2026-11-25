import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, today } from '../../lib/dates'
import { getStore, resetStore, setStore } from '../../lib/store'
import type { Store, Task } from '../../lib/types'
import { StatsScreen } from './StatsScreen'

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

function makeTask(id: string, sectionId: string, patch: Partial<Task> = {}): Task {
  return {
    id,
    sectionId,
    title: `Задача ${id}`,
    status: 'planned',
    order: 0,
    createdAt: today(),
    updatedAt: today(),
    ...patch,
  }
}

/** Все интерактивные ячейки heatmap (кнопки-дни). */
function heatCells(): HTMLButtonElement[] {
  const grid = screen.getByRole('group', { name: 'Календарь активности за 12 недель' })
  return [...grid.querySelectorAll<HTMLButtonElement>('button[data-day]')]
}

describe('StatsScreen — экран «Статистика» (этап 7)', () => {
  it('показывает заголовок, фильтр разделов и карточки метрик', () => {
    render(<StatsScreen />)

    expect(screen.getByRole('heading', { level: 2, name: 'Статистика' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Фильтр по разделам' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Все разделы/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Английский язык/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Физкультура/ })).toBeInTheDocument()

    expect(screen.getByText('Серия сейчас')).toBeInTheDocument()
    expect(screen.getByText('Лучшая серия')).toBeInTheDocument()
    expect(screen.getByText('Выполнено за 7 дней')).toBeInTheDocument()
    expect(screen.getByText('Выполнено за 30 дней')).toBeInTheDocument()
  })

  it('метрики совпадают с ручным подсчётом по сиду', () => {
    render(<StatsScreen />)

    // сид: 2 задачи отмечены сегодня, вчерашних отметок нет → серия 1 день
    // (текст «1 день» в двух карточках: текущая и лучшая серии)
    expect(screen.getAllByText('1 день')).toHaveLength(2)

    // 7 дней: сегодняшняя очередь (6 задач) + 2 выполненные сегодня → 2 из 6 = 33%
    expect(screen.getAllByText('33%')).toHaveLength(2)
    expect(screen.getAllByText('2 из 6')).toHaveLength(2)
  })

  it('heatmap содержит 12 недель ячеек и легенду', () => {
    render(<StatsScreen />)

    expect(screen.getByRole('heading', { name: 'Активность за 12 недель' })).toBeInTheDocument()
    // 84 дня сетки; часть будущих — невидимые span, кнопок меньше
    const cells = heatCells()
    expect(cells.length).toBeGreaterThan(70)
    expect(cells.length).toBeLessThanOrEqual(84)
    expect(screen.getByText('Меньше')).toBeInTheDocument()
    expect(screen.getByText('Больше')).toBeInTheDocument()
  })

  it('клик по дню heatmap открывает список задач этого дня', async () => {
    const user = userEvent.setup()
    const yesterday = addDays(today(), -1)
    const base: Store = getStore()
    setStore({
      ...base,
      tasks: [
        makeTask('t1', 'sec-english', {
          title: 'Вчерашняя работа',
          status: 'done',
          completedAt: yesterday,
        }),
        makeTask('t2', 'sec-algebra', { title: 'Срок был вчера', dueDate: yesterday }),
      ],
    })
    render(<StatsScreen />)

    const cell = screen.getByRole('button', { name: new RegExp(formatRu(yesterday)) })
    await user.click(cell)

    expect(screen.getByText('Вчерашняя работа')).toBeInTheDocument()
    expect(screen.getByText('Срок был вчера')).toBeInTheDocument()
    expect(screen.getByText('Выполнено: 1 из 2')).toBeInTheDocument()
  })

  it('день без задач показывает пустое состояние списка', async () => {
    const user = userEvent.setup()
    render(<StatsScreen />)

    // пустой день в сетке (задачи сидa только сегодня)
    const emptyCell = heatCells().find((cell) =>
      cell.getAttribute('aria-label')?.includes('задач не было'),
    )
    expect(emptyCell).toBeDefined()
    await user.click(emptyCell!)

    expect(screen.getByText('В этот день задач не было.')).toBeInTheDocument()
  })

  it('фильтр по разделу меняет метрики, список дня и столбики', async () => {
    const user = userEvent.setup()
    render(<StatsScreen />)

    const peChip = screen.getByRole('button', { name: /Физкультура/ })
    await user.click(peChip)

    expect(peChip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Все разделы/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // у Физкультуры нет отметок → обе серии 0 дней
    expect(screen.getAllByText('0 дней')).toHaveLength(2)
    // список дня: только задачи Физкультуры (2 из 6 сидa)
    expect(screen.getByText('Выполнено: 0 из 2')).toBeInTheDocument()
    expect(screen.queryByText('Выучить 20 новых слов')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Английский язык/ }))
    expect(screen.getByText('Выполнено: 1 из 2')).toBeInTheDocument()
    expect(screen.getByText('Выучить 20 новых слов')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Все разделы/ }))
    expect(screen.getByText('Выполнено: 2 из 6')).toBeInTheDocument()
  })

  it('столбики за 30 дней: по одному на день с подписями периодов', () => {
    render(<StatsScreen />)

    expect(screen.getByRole('heading', { name: 'Последние 30 дней' })).toBeInTheDocument()
    const bars = screen.getByRole('list', { name: /Выполнение по дням за 30 дней/ })
    expect(bars).toBeInTheDocument()
    expect(bars.querySelectorAll('li')).toHaveLength(30)
    expect(screen.getByText(formatRu(addDays(today(), -29)))).toBeInTheDocument()
    expect(screen.getByText(formatRu(today()))).toBeInTheDocument()
  })

  it('пустой стор показывает подсказку вместо графиков', () => {
    const base: Store = getStore()
    setStore({ ...base, tasks: [] })
    render(<StatsScreen />)

    expect(screen.getByText(/Пока нет задач/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Календарь активности за 12 недель' })).toBeNull()
    expect(screen.queryByRole('list', { name: /Выполнение по дням/ })).toBeNull()
  })

  it('клавиатура: стрелки перемещают фокус по ячейкам heatmap', async () => {
    const user = userEvent.setup()
    render(<StatsScreen />)

    const todayCell = screen.getByRole('button', { name: new RegExp(formatRu(today())) })
    expect(todayCell).toHaveAttribute('tabindex', '0')
    todayCell.focus()

    // колонка = неделя: влево/вправо — ±7 дней, вверх/вниз — ±1 день
    await user.keyboard('{ArrowLeft}')
    expect(
      screen.getByRole('button', { name: new RegExp(formatRu(addDays(today(), -7))) }),
    ).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(
      screen.getByRole('button', { name: new RegExp(formatRu(addDays(today(), -6))) }),
    ).toHaveFocus()

    await user.keyboard('{ArrowUp}{ArrowRight}')
    expect(todayCell).toHaveFocus()
  })

  it('клик по сегодняшней ячейке подсвечивает её (aria-pressed)', async () => {
    const user = userEvent.setup()
    render(<StatsScreen />)

    const todayCell = screen.getByRole('button', { name: new RegExp(formatRu(today())) })
    expect(todayCell).toHaveAttribute('aria-pressed', 'true')

    const yesterdayCell = screen.getByRole('button', {
      name: new RegExp(formatRu(addDays(today(), -1))),
    })
    await user.click(yesterdayCell)
    expect(yesterdayCell).toHaveAttribute('aria-pressed', 'true')
    expect(todayCell).toHaveAttribute('aria-pressed', 'false')
  })
})

/** ДД.ММ.ГГГГ — формат formatDateRu без импорта (читаемость теста). */
function formatRu(day: string): string {
  const [year, month, date] = day.split('-')
  return `${date}.${month}.${year}`
}
