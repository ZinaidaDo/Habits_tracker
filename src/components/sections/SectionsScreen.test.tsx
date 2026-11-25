import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { getStore, resetStore } from '../../lib/store'
import { SectionsScreen } from './SectionsScreen'

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

function getSidebar() {
  return screen.getByRole('complementary', { name: 'Разделы' })
}

/** Кнопки-выборы разделов: aria-label вида «Имя, задач: N». */
function getSelectButtons() {
  return within(getSidebar())
    .getAllByRole('button')
    .filter((button) => /задач: \d+$/.test(button.getAttribute('aria-label') ?? ''))
    .map((button) => button.getAttribute('aria-label'))
}

describe('SectionsScreen — разделы (этап 2)', () => {
  it('показывает три раздела по умолчанию со счётчиками задач', () => {
    render(<SectionsScreen />)

    expect(getSelectButtons()).toEqual([
      'Английский язык, задач: 2',
      'Алгебра, задач: 2',
      'Физкультура, задач: 2',
    ])
    expect(getStore().sections).toHaveLength(3)
  })

  it('создаёт новый раздел через форму', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)

    await user.click(screen.getByRole('button', { name: 'Добавить раздел' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Название'), 'История')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getStore().sections).toHaveLength(4)
    expect(getSelectButtons()).toContain('История, задач: 0')
  })

  it('не создаёт раздел с пустым именем и показывает ошибку', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)

    await user.click(screen.getByRole('button', { name: 'Добавить раздел' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Введите название раздела')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(getStore().sections).toHaveLength(3)

    // ошибка исчезает при вводе, валидное имя создаёт раздел
    await user.type(within(dialog).getByLabelText('Название'), 'История')
    expect(within(dialog).queryByRole('alert')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getStore().sections).toHaveLength(4)
  })

  it('переименовывает существующий раздел', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)

    await user.click(within(getSidebar()).getByRole('button', { name: 'Редактировать «Алгебра»' }))
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByLabelText('Название')
    await user.clear(input)
    await user.type(input, 'Математика')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(
      within(getSidebar()).getByRole('button', { name: 'Математика, задач: 2' }),
    ).toBeInTheDocument()
    expect(within(getSidebar()).queryByRole('button', { name: /^Алгебра/ })).toBeNull()
    expect(getStore().sections.find((section) => section.id === 'sec-algebra')?.name).toBe(
      'Математика',
    )
  })

  it('перемещает раздел вверх, меняя порядок', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)

    await user.click(
      within(getSidebar()).getByRole('button', { name: 'Переместить «Алгебра» вверх' }),
    )

    expect(getSelectButtons()).toEqual([
      'Алгебра, задач: 2',
      'Английский язык, задач: 2',
      'Физкультура, задач: 2',
    ])
    expect(
      within(getSidebar()).getByRole('button', { name: 'Переместить «Алгебра» вверх' }),
    ).toBeDisabled()
  })

  it('удаляет раздел с переносом задач — задачи не теряются', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)
    const totalBefore = getStore().tasks.length

    await user.click(within(getSidebar()).getByRole('button', { name: 'Удалить «Алгебра»' }))
    const dialog = screen.getByRole('dialog')
    // по умолчанию выбран перенос в первый доступный раздел
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))

    expect(getStore().sections).toHaveLength(2)
    expect(getStore().tasks).toHaveLength(totalBefore)
    expect(
      within(getSidebar()).getByRole('button', { name: 'Английский язык, задач: 4' }),
    ).toBeInTheDocument()
  })

  it('удаляет раздел вместе с задачами — по явному выбору', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)
    const totalBefore = getStore().tasks.length

    await user.click(within(getSidebar()).getByRole('button', { name: 'Удалить «Физкультура»' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: 'Удалить вместе с разделом' }))
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))

    expect(getStore().sections).toHaveLength(2)
    expect(getStore().tasks).toHaveLength(totalBefore - 2)
    expect(within(getSidebar()).queryByRole('button', { name: /^Физкультура/ })).toBeNull()
  })

  it('архивирует и возвращает раздел', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)

    await user.click(
      within(getSidebar()).getByRole('button', { name: 'Отправить «Физкультура» в архив' }),
    )

    expect(within(getSidebar()).queryByRole('button', { name: /^Физкультура/ })).toBeNull()
    expect(
      within(getSidebar()).getByRole('button', { name: 'Вернуть «Физкультура» из архива' }),
    ).toBeInTheDocument()
    expect(within(getSidebar()).getByText('Архив')).toBeInTheDocument()

    await user.click(
      within(getSidebar()).getByRole('button', { name: 'Вернуть «Физкультура» из архива' }),
    )
    expect(
      within(getSidebar()).getByRole('button', { name: 'Физкультура, задач: 2' }),
    ).toBeInTheDocument()
  })

  it('закрывает модалку по Escape и возвращает фокус', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)

    const addButton = screen.getByRole('button', { name: 'Добавить раздел' })
    await user.click(addButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(addButton).toHaveFocus()
  })

  it('после удаления всех разделов показывает пустое состояние и позволяет создать новый', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)

    for (const name of ['Английский язык', 'Алгебра', 'Физкультура']) {
      await user.click(within(getSidebar()).getByRole('button', { name: `Удалить «${name}»` }))
      const dialog = screen.getByRole('dialog')
      const deleteRadio = within(dialog).queryByRole('radio', {
        name: 'Удалить вместе с разделом',
      })
      if (deleteRadio) await user.click(deleteRadio)
      await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))
    }

    expect(getStore().sections).toHaveLength(0)
    expect(getStore().tasks).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Нет разделов' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Создать раздел' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Название'), 'Новый старт')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(getStore().sections).toHaveLength(1)
    expect(
      within(getSidebar()).getByRole('button', { name: 'Новый старт, задач: 0' }),
    ).toBeInTheDocument()
  })
})

/** Карточка задачи в колонке статуса (вид «Канбан» по умолчанию). */
function getCard(statusLabel: string) {
  const column = screen.getByRole('region', { name: `Колонка: ${statusLabel}` })
  return within(column).getByRole('listitem')
}

describe('SectionsScreen — перенос между разделами и прогресс (этап 6)', () => {
  it('меню «Переместить в раздел…» переносит задачу, undo возвращает её', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)

    const card = getCard('В работе')
    await user.selectOptions(
      within(card).getByRole('combobox', { name: /другой раздел/ }),
      'sec-algebra',
    )

    const moved = getStore().tasks.find(
      (task) => task.title === 'Прочитать статью и сделать пересказ',
    )
    expect(moved?.sectionId).toBe('sec-algebra')
    expect(
      within(getSidebar()).getByRole('button', { name: 'Алгебра, задач: 3' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('→ «Алгебра»')

    await user.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(
      getStore().tasks.find((task) => task.title === 'Прочитать статью и сделать пересказ')
        ?.sectionId,
    ).toBe('sec-english')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('меню переноса работает и в виде «Список»', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)
    await user.click(screen.getByRole('button', { name: 'Список' }))

    const panel = screen.getByRole('region', { name: 'Задачи' })
    const firstItem = within(panel).getAllByRole('listitem')[0]
    await user.selectOptions(
      within(firstItem).getByRole('combobox', { name: /другой раздел/ }),
      'sec-pe',
    )

    expect(getStore().tasks.find((task) => task.title === 'Выучить 20 новых слов')?.sectionId).toBe(
      'sec-pe',
    )
  })

  it('drag & drop карточки на раздел: подсветка, перенос и undo', () => {
    render(<SectionsScreen />)
    const card = getCard('В работе')
    const target = screen.getByRole('button', { name: 'Алгебра, задач: 2' }).closest('li')
    expect(target).not.toBeNull()

    const dataTransfer = {
      data: '',
      types: ['text/plain'],
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
    fireEvent.dragOver(target as HTMLElement, { dataTransfer })
    expect(target).toHaveClass('section-item--drop-target')

    fireEvent.drop(target as HTMLElement, { dataTransfer })
    expect(target).not.toHaveClass('section-item--drop-target')

    expect(
      getStore().tasks.find((task) => task.title === 'Прочитать статью и сделать пересказ')
        ?.sectionId,
    ).toBe('sec-algebra')
    expect(
      within(getSidebar()).getByRole('button', { name: 'Алгебра, задач: 3' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(
      getStore().tasks.find((task) => task.title === 'Прочитать статью и сделать пересказ')
        ?.sectionId,
    ).toBe('sec-english')
  })

  it('перенос в архивный раздел требует подтверждения, отмена ничего не меняет', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)
    await user.click(
      within(getSidebar()).getByRole('button', { name: 'Отправить «Физкультура» в архив' }),
    )

    // текущий раздел — Английский: берём задачу «В работе»
    const card = getCard('В работе')
    const select = within(card).getByRole('combobox', { name: /другой раздел/ })
    await user.selectOptions(select, 'sec-pe')

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(/архивный раздел «Физкультура»/)
    expect(
      getStore().tasks.find((task) => task.title === 'Прочитать статью и сделать пересказ')
        ?.sectionId,
    ).toBe('sec-english')

    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    expect(
      getStore().tasks.find((task) => task.title === 'Прочитать статью и сделать пересказ')
        ?.sectionId,
    ).toBe('sec-english')

    await user.selectOptions(select, 'sec-pe')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Перенести' }))
    expect(
      getStore().tasks.find((task) => task.title === 'Прочитать статью и сделать пересказ')
        ?.sectionId,
    ).toBe('sec-pe')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('проценты по разделам совпадают с ручным подсчётом и пересчитываются', async () => {
    const user = userEvent.setup()
    render(<SectionsScreen />)

    // ручной подсчёт по сид-данным: Английский 1/2, Алгебра 1/2, Физкультура 0/2
    const percents = within(getSidebar())
      .getAllByText(/^\d+%$/)
      .map((element) => element.textContent)
    expect([...percents].sort()).toEqual(['0%', '50%', '50%'])

    // карточка выбранного раздела: полоса с теми же числами
    expect(
      screen.getByRole('progressbar', { name: 'Прогресс раздела Английский язык' }),
    ).toHaveAttribute('aria-valuenow', '1')
    expect(
      screen.getByRole('progressbar', { name: 'Прогресс раздела Английский язык' }),
    ).toHaveAttribute('aria-valuemax', '2')

    // перенос меняет проценты мгновенно, undo возвращает
    const card = getCard('В работе')
    await user.selectOptions(
      within(card).getByRole('combobox', { name: /другой раздел/ }),
      'sec-algebra',
    )
    // Английский: 1 выполненная из 1 оставшейся
    expect(within(getSidebar()).getAllByText('100%')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(within(getSidebar()).queryByText('100%')).toBeNull()
  })
})
