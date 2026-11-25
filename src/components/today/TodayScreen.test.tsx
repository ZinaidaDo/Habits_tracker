import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, parseDate, today } from '../../lib/dates'
import { weekStart } from '../../lib/progress'
import { getStore, resetStore, setStore } from '../../lib/store'
import type { Store, Task } from '../../lib/types'
import { TodayScreen } from './TodayScreen'

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

function getProgressText(): string {
  return screen.getByText(/Выполнено: \d+ из \d+/).textContent ?? ''
}

function makeTask(id: string, patch: Partial<Task>): Task {
  return {
    id,
    sectionId: 'sec-english',
    title: `Задача ${id}`,
    status: 'planned',
    order: 0,
    createdAt: today(),
    updatedAt: today(),
    ...patch,
  }
}

describe('TodayScreen — экран «Сегодня» (этап 5)', () => {
  it('показывает задачи дня, прогресс и фильтр по разделам', () => {
    render(<TodayScreen />)

    expect(screen.getByRole('heading', { level: 2, name: 'Сегодня' })).toBeInTheDocument()
    expect(screen.getByText(/Сегодня,/)).toBeInTheDocument()
    // сид: 6 задач, две отмечены сегодня
    expect(getProgressText()).toBe('Выполнено: 2 из 6')
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)
    expect(screen.getByRole('button', { name: /Английский язык/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('group', { name: 'Фильтр по разделам' })).toBeInTheDocument()
  })

  it('галочка отмечает задачу и прогресс пересчитывается мгновенно', async () => {
    const user = userEvent.setup()
    render(<TodayScreen />)

    const checkbox = screen.getByRole('checkbox', {
      name: /Прочитать статью и сделать пересказ/,
    })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)

    expect(checkbox).toBeChecked()
    expect(getProgressText()).toBe('Выполнено: 3 из 6')

    const task = getStore().tasks.find(
      (item) => item.title === 'Прочитать статью и сделать пересказ',
    )
    expect(task).toMatchObject({
      status: 'done',
      previousStatus: 'in_progress',
      completedAt: today(),
    })

    // undo-уведомление
    expect(screen.getByRole('status')).toHaveTextContent('Прочитать статью и сделать пересказ')
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeInTheDocument()
  })

  it('повторное действие снимает отметку и возвращает прежний статус', async () => {
    const user = userEvent.setup()
    render(<TodayScreen />)

    const checkbox = screen.getByRole('checkbox', {
      name: /Прочитать статью и сделать пересказ/,
    })
    await user.click(checkbox)
    await user.click(checkbox)

    expect(checkbox).not.toBeChecked()
    expect(getProgressText()).toBe('Выполнено: 2 из 6')

    const task = getStore().tasks.find(
      (item) => item.title === 'Прочитать статью и сделать пересказ',
    )
    expect(task?.status).toBe('in_progress')
    expect(task?.completedAt).toBeUndefined()
    expect(task?.previousStatus).toBeUndefined()
  })

  it('кнопка «Отменить» в уведомлении откатывает отметку', async () => {
    const user = userEvent.setup()
    render(<TodayScreen />)

    await user.click(screen.getByRole('checkbox', { name: /Прочитать статью и сделать пересказ/ }))
    expect(getProgressText()).toBe('Выполнено: 3 из 6')

    await user.click(screen.getByRole('button', { name: 'Отменить' }))

    expect(getProgressText()).toBe('Выполнено: 2 из 6')
    expect(
      getStore().tasks.find((item) => item.title === 'Прочитать статью и сделать пересказ')?.status,
    ).toBe('in_progress')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('отметка за сегодня переживает перезагрузку', async () => {
    const user = userEvent.setup()
    const first = render(<TodayScreen />)

    await user.click(screen.getByRole('checkbox', { name: /Прочитать статью и сделать пересказ/ }))
    first.unmount()

    // имитация перезагрузки: кэш сброшен, стор читается из localStorage
    resetStore()
    render(<TodayScreen />)

    expect(
      screen.getByRole('checkbox', { name: /Прочитать статью и сделать пересказ/ }),
    ).toBeChecked()
    expect(
      getStore().tasks.find((item) => item.title === 'Прочитать статью и сделать пересказ')
        ?.completedAt,
    ).toBe(today())
  })

  it('переключатель дней: вчера показывает вчерашние задачи, вперёд заблокирован', async () => {
    const user = userEvent.setup()
    const yesterday = addDays(today(), -1)

    const base: Store = getStore()
    setStore({
      ...base,
      tasks: [
        makeTask('t1', { title: 'Вчерашняя отметка', status: 'done', completedAt: yesterday }),
        makeTask('t2', { title: 'Срок был вчера', status: 'planned', dueDate: yesterday }),
        makeTask('t3', { title: 'Осталось на сегодня', status: 'in_progress' }),
      ],
    })
    render(<TodayScreen />)

    // сегодня: две невыполненные задачи в очереди
    expect(getProgressText()).toBe('Выполнено: 0 из 2')
    expect(screen.getByRole('button', { name: 'Следующий день' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Предыдущий день' }))

    expect(screen.getByText(/Вчера,/)).toBeInTheDocument()
    expect(getProgressText()).toBe('Выполнено: 1 из 2')
    expect(screen.getByRole('checkbox', { name: /Вчерашняя отметка/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Следующий день' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'К сегодняшнему дню' }))
    expect(screen.getByText(/Сегодня,/)).toBeInTheDocument()
    expect(getProgressText()).toBe('Выполнено: 0 из 2')
  })

  it('фильтр по разделам скрывает их задачи и меняет прогресс', async () => {
    const user = userEvent.setup()
    render(<TodayScreen />)

    const peChip = screen.getByRole('button', { name: /Физкультура/ })
    await user.click(peChip)

    expect(peChip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(getProgressText()).toBe('Выполнено: 2 из 4')

    await user.click(peChip)
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)
    expect(getProgressText()).toBe('Выполнено: 2 из 6')
  })

  it('полоса «За неделю» показывает прогресс недели и пересчитывается', async () => {
    const user = userEvent.setup()
    render(<TodayScreen />)

    // сид: 2 выполненные задачи входят и в день, и в неделю
    expect(screen.getByText('За неделю: 2 из 6')).toBeInTheDocument()
    const weekBar = screen.getByRole('progressbar', { name: 'Прогресс недели' })
    expect(weekBar).toHaveAttribute('aria-valuenow', '2')
    expect(weekBar).toHaveAttribute('aria-valuemax', '6')

    await user.click(screen.getByRole('checkbox', { name: /Прочитать статью и сделать пересказ/ }))

    expect(screen.getByText('За неделю: 3 из 6')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Прогресс недели' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    )
    expect(screen.getByRole('progressbar', { name: 'Прогресс дня' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    )

    await user.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(screen.getByText('За неделю: 2 из 6')).toBeInTheDocument()
  })

  it('задачи, выполненные ранее на этой неделе, считаются только в недельном прогрессе', () => {
    const base: Store = getStore()
    // выбираем неделю так, чтобы её начало было раньше сегодняшнего дня
    const weekday = parseDate(today()).getDay()
    const firstDayOfWeek: 0 | 1 = weekday === 1 ? 0 : 1
    const earlier = weekStart(today(), firstDayOfWeek)
    expect(earlier < today()).toBe(true)

    setStore({
      ...base,
      settings: { ...base.settings, firstDayOfWeek },
      tasks: [
        makeTask('t1', { status: 'done', completedAt: earlier }),
        makeTask('t2', { status: 'planned' }), // в рабочую очередь сегодняшнего дня
      ],
    })
    render(<TodayScreen />)

    expect(getProgressText()).toBe('Выполнено: 0 из 1')
    expect(screen.getByText('За неделю: 1 из 2')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Прогресс недели' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    expect(screen.getByRole('progressbar', { name: 'Прогресс недели' })).toHaveAttribute(
      'aria-valuemax',
      '2',
    )
  })

  it('пустой день показывает подсказку', async () => {
    const user = userEvent.setup()
    const base: Store = getStore()
    setStore({ ...base, tasks: [] })
    render(<TodayScreen />)

    expect(screen.getByText(/На сегодня задач нет/)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Предыдущий день' }))
    expect(screen.getByText(/В этот день задач не было/)).toBeInTheDocument()
  })
})
