import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { getStore, resetStore, subscribeStore } from '../../lib/store'
import { SectionsScreen } from '../sections/SectionsScreen'

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

/** Экран «Доска» в виде «Канбан» (вид по умолчанию). */
function renderBoard() {
  render(<SectionsScreen />)
}

function getColumn(label: string) {
  return screen.getByRole('region', { name: `Колонка: ${label}` })
}

function getCardTitles(statusLabel: string) {
  return within(getColumn(statusLabel))
    .queryAllByRole('listitem')
    .map((item) => within(item).getByText(/./, { selector: '.kanban-card__title' }).textContent)
}

/** Карточка колонки по названию задачи. */
function getCard(statusLabel: string, title: string) {
  const titleElement = within(getColumn(statusLabel)).getByText(title, {
    selector: '.kanban-card__title',
  })
  const card = titleElement.closest('li')
  if (!card) throw new Error(`Карточка «${title}» не найдена`)
  return card
}

/** Меню статусов на карточке (второй select — перенос в раздел). */
function statusSelect(container: HTMLElement) {
  return within(container).getByRole('combobox', { name: /другой статус/ })
}

describe('KanbanBoard — статусы (этап 4)', () => {
  it('показывает четыре колонки со счётчиками задач выбранного раздела', () => {
    renderBoard()

    expect(getCardTitles('Запланирована')).toEqual([])
    expect(getCardTitles('В работе')).toEqual(['Прочитать статью и сделать пересказ'])
    expect(getCardTitles('Отложена')).toEqual([])
    expect(getCardTitles('Выполнена')).toEqual(['Выучить 20 новых слов'])

    // счётчики колонок
    expect(getColumn('В работе')).toHaveTextContent('1')
    expect(getColumn('Выполнена')).toHaveTextContent('1')
    expect(getColumn('Запланирована')).toHaveTextContent('0')
  })

  it('меню «Переместить в…» переводит задачу в другой статус', async () => {
    const user = userEvent.setup()
    renderBoard()

    const card = within(getColumn('В работе')).getByRole('listitem')
    await user.selectOptions(statusSelect(card), 'postponed')

    expect(getCardTitles('В работе')).toEqual([])
    expect(getCardTitles('Отложена')).toEqual(['Прочитать статью и сделать пересказ'])

    const task = getStore().tasks.find(
      (item) => item.title === 'Прочитать статью и сделать пересказ',
    )
    expect(task?.status).toBe('postponed')
    expect(task?.lastStatusChangeAt).toBeTruthy()
  })

  it('все четыре статуса достижимы, «Выполнена» датируется', async () => {
    const user = userEvent.setup()
    renderBoard()

    const card = within(getColumn('В работе')).getByRole('listitem')

    await user.selectOptions(statusSelect(card), 'planned')
    expect(getCardTitles('Запланирована')).toContain('Прочитать статью и сделать пересказ')

    await user.selectOptions(
      statusSelect(getCard('Запланирована', 'Прочитать статью и сделать пересказ')),
      'postponed',
    )
    expect(getCardTitles('Отложена')).toContain('Прочитать статью и сделать пересказ')

    await user.selectOptions(
      statusSelect(getCard('Отложена', 'Прочитать статью и сделать пересказ')),
      'done',
    )
    expect(getCardTitles('Выполнена')).toContain('Прочитать статью и сделать пересказ')

    const task = getStore().tasks.find(
      (item) => item.title === 'Прочитать статью и сделать пересказ',
    )
    expect(task?.status).toBe('done')
    expect(task?.completedAt).toBeTruthy()

    // выход из «Выполнена» снимает дату выполнения
    await user.selectOptions(
      statusSelect(getCard('Выполнена', 'Прочитать статью и сделать пересказ')),
      'planned',
    )
    const undone = getStore().tasks.find(
      (item) => item.title === 'Прочитать статью и сделать пересказ',
    )
    expect(undone?.completedAt).toBeUndefined()
  })

  it('перетаскивание: подсветка приёмника и перемещение drop-ом', () => {
    renderBoard()
    const card = within(getColumn('В работе')).getByRole('listitem')

    const dataTransfer = {
      data: '',
      setData(type: string, value: string) {
        if (type === 'text/plain') this.data = value
      },
      getData(type: string) {
        return type === 'text/plain' ? this.data : ''
      },
      effectAllowed: 'move',
      dropEffect: 'move',
    }

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(getColumn('Запланирована'), { dataTransfer })

    // визуальное выделение колонки-приёмника
    expect(getColumn('Запланирована')).toHaveClass('kanban-column--drop-target')
    expect(getColumn('В работе')).not.toHaveClass('kanban-column--drop-target')

    fireEvent.drop(getColumn('Запланирована'), { dataTransfer })

    expect(getCardTitles('Запланирована')).toEqual(['Прочитать статью и сделать пересказ'])
    expect(getColumn('Запланирована')).not.toHaveClass('kanban-column--drop-target')
    expect(
      getStore().tasks.find((item) => item.title === 'Прочитать статью и сделать пересказ')?.status,
    ).toBe('planned')
  })

  it('перезагрузка: статусы переживают перечитывание стора', async () => {
    const user = userEvent.setup()
    renderBoard()

    const card = within(getColumn('В работе')).getByRole('listitem')
    await user.selectOptions(statusSelect(card), 'done')

    // имитация перезагрузки: кэш сброшен, стор читается из localStorage
    resetStore()

    expect(
      getStore().tasks.find((item) => item.title === 'Прочитать статью и сделать пересказ')?.status,
    ).toBe('done')
    expect(
      within(getColumn('Выполнена')).getByText('Прочитать статью и сделать пересказ'),
    ).toBeInTheDocument()
  })

  it('откат оптимистичного обновления при ошибке записи', async () => {
    const user = userEvent.setup()
    renderBoard()

    // слушатель, падающий при первой записи — имитация сбоя сохранения
    let shouldThrow = true
    const unsubscribe = subscribeStore(() => {
      if (shouldThrow) {
        shouldThrow = false
        throw new Error('write failed')
      }
    })

    const card = within(getColumn('В работе')).getByRole('listitem')
    await user.selectOptions(statusSelect(card), 'postponed')
    unsubscribe()

    // сообщение об ошибке показано, статус откачен к прежнему
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось изменить статус')
    expect(
      getStore().tasks.find((item) => item.title === 'Прочитать статью и сделать пересказ')?.status,
    ).toBe('in_progress')
    expect(getCardTitles('В работе')).toEqual(['Прочитать статью и сделать пересказ'])
  })

  it('табы колонок переключают активную колонку (мобильный режим)', async () => {
    const user = userEvent.setup()
    renderBoard()

    const doneTab = screen.getByRole('button', { name: /Выполнена/ })
    expect(doneTab).toHaveAttribute('aria-pressed', 'false')

    await user.click(doneTab)

    expect(doneTab).toHaveAttribute('aria-pressed', 'true')
    expect(getColumn('Выполнена')).toHaveClass('kanban-column--active')
    expect(getColumn('В работе')).not.toHaveClass('kanban-column--active')
  })

  it('пустая колонка показывает подсказку для drop-а', () => {
    renderBoard()

    expect(getColumn('Отложена')).toHaveTextContent('Перетащите задачу сюда')
  })

  it('создание задачи из доски попадает в колонку «Запланирована»', async () => {
    const user = userEvent.setup()
    renderBoard()

    await user.click(screen.getByRole('button', { name: 'Добавить задачу' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Название'), 'Новая с доски')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getCardTitles('Запланирована')).toContain('Новая с доски')
  })
})

describe('Доступность и адаптивность (этап 9)', () => {
  it('колонки канбана ссылаются на инструкцию DnD, смена статуса объявляется live-регионом', async () => {
    const user = userEvent.setup()
    renderBoard()

    expect(document.querySelector('.kanban__columns')).toHaveAttribute(
      'aria-describedby',
      'kanban-dnd-help',
    )
    expect(screen.getByText(/перетаскиваются между колонками мышью/)).toBeInTheDocument()

    const card = within(getColumn('В работе')).getByRole('listitem')
    await user.selectOptions(statusSelect(card), 'done')

    const live = document.querySelector('[aria-live="polite"]')
    expect(live).toHaveTextContent('«Прочитать статью и сделать пересказ» → «Выполнена»')
  })

  it('мобильный селектор разделов: кнопка «Все разделы» с aria-expanded', async () => {
    const user = userEvent.setup()
    renderBoard()

    const toggle = screen.getByRole('button', { name: 'Все разделы' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'sections-sidebar-list')

    const picker = screen.getByLabelText('Выбрать раздел')
    expect(picker).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Скрыть список' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('смена раздела через селектор переключает карточку и канбан', async () => {
    const user = userEvent.setup()
    renderBoard()

    const picker = screen.getByLabelText('Выбрать раздел') as HTMLSelectElement
    await user.selectOptions(picker, 'sec-algebra')

    expect(picker.value).toBe('sec-algebra')
    expect(screen.getByRole('region', { name: 'Колонка: Запланирована' })).toHaveTextContent(
      'Решить 10 задач на квадратные уравнения',
    )
  })
})
