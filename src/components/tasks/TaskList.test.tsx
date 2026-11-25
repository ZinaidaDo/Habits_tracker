import { render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { getStore, resetStore } from '../../lib/store'
import { SectionsScreen } from '../sections/SectionsScreen'

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

/** Экран «Доска» во включённом виде «Список». */
async function renderTaskList(user: UserEvent) {
  render(<SectionsScreen />)
  await user.click(screen.getByRole('button', { name: 'Список' }))
}

function getTaskPanel() {
  return screen.getByRole('region', { name: 'Задачи' })
}

function getTaskTitles() {
  return within(getTaskPanel())
    .getAllByRole('listitem')
    .map((item) => within(item).getByText(/./, { selector: '.task-item__title' }).textContent)
}

describe('TaskList — задачи раздела (этап 3)', () => {
  it('показывает задачи выбранного раздела в порядке', async () => {
    const user = userEvent.setup()
    await renderTaskList(user)

    // выбран по умолчанию первый раздел — «Английский язык»
    expect(getTaskTitles()).toEqual([
      'Выучить 20 новых слов',
      'Прочитать статью и сделать пересказ',
    ])
    expect(within(getTaskPanel()).getByText('Выполнена')).toBeInTheDocument()
    expect(within(getTaskPanel()).getByText('В работе')).toBeInTheDocument()
  })

  it('переключение раздела меняет список задач', async () => {
    const user = userEvent.setup()
    await renderTaskList(user)

    await user.click(screen.getByRole('button', { name: 'Алгебра, задач: 2' }))

    expect(getTaskTitles()).toEqual([
      'Решить 10 задач на квадратные уравнения',
      'Повторить формулы сокращённого умножения',
    ])
  })

  it('создаёт задачу через форму', async () => {
    const user = userEvent.setup()
    await renderTaskList(user)
    const totalBefore = getStore().tasks.length

    await user.click(within(getTaskPanel()).getByRole('button', { name: 'Добавить задачу' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Название'), 'Сочинение по теме')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getStore().tasks).toHaveLength(totalBefore + 1)
    expect(getTaskTitles()).toContain('Сочинение по теме')
    expect(
      within(getTaskPanel()).getByRole('button', {
        name: 'Редактировать задачу «Сочинение по теме»',
      }),
    ).toBeInTheDocument()
  })

  it('пустое название не создаёт задачу и показывает ошибку', async () => {
    const user = userEvent.setup()
    await renderTaskList(user)
    const totalBefore = getStore().tasks.length

    await user.click(within(getTaskPanel()).getByRole('button', { name: 'Добавить задачу' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Введите название задачи')
    expect(getStore().tasks).toHaveLength(totalBefore)

    await user.type(within(dialog).getByLabelText('Название'), 'Новая')
    expect(within(dialog).queryByRole('alert')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getStore().tasks).toHaveLength(totalBefore + 1)
  })

  it('редактирует задачу: название, описание, срок', async () => {
    const user = userEvent.setup()
    await renderTaskList(user)

    await user.click(
      within(getTaskPanel()).getByRole('button', {
        name: 'Редактировать задачу «Прочитать статью и сделать пересказ»',
      }),
    )
    const dialog = screen.getByRole('dialog')
    const titleInput = within(dialog).getByLabelText('Название')
    await user.clear(titleInput)
    await user.type(titleInput, 'Пересказ статьи')
    await user.type(within(dialog).getByLabelText(/Описание/), 'Кратко, 5 предложений')
    await user.type(within(dialog).getByLabelText(/Срок выполнения/), '2026-12-31')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    const task = getStore().tasks.find((item) => item.title === 'Пересказ статьи')
    expect(task).toMatchObject({
      description: 'Кратко, 5 предложений',
      dueDate: '2026-12-31',
    })
    expect(getTaskTitles()).toContain('Пересказ статьи')
    expect(within(getTaskPanel()).getByText('Срок: 31.12.2026')).toBeInTheDocument()
  })

  it('перемещает задачу вверх и вниз', async () => {
    const user = userEvent.setup()
    await renderTaskList(user)

    await user.click(
      within(getTaskPanel()).getByRole('button', {
        name: 'Переместить задачу «Прочитать статью и сделать пересказ» вверх',
      }),
    )
    expect(getTaskTitles()).toEqual([
      'Прочитать статью и сделать пересказ',
      'Выучить 20 новых слов',
    ])

    await user.click(
      within(getTaskPanel()).getByRole('button', {
        name: 'Переместить задачу «Прочитать статью и сделать пересказ» вниз',
      }),
    )
    expect(getTaskTitles()).toEqual([
      'Выучить 20 новых слов',
      'Прочитать статью и сделать пересказ',
    ])

    // границы: первая кнопка «вверх» и последняя «вниз» отключены
    const upButtons = within(getTaskPanel()).getAllByRole('button', { name: /вверх$/ })
    const downButtons = within(getTaskPanel()).getAllByRole('button', { name: /вниз$/ })
    expect(upButtons[0]).toBeDisabled()
    expect(downButtons[downButtons.length - 1]).toBeDisabled()
  })

  it('удаляет задачу только после подтверждения', async () => {
    const user = userEvent.setup()
    await renderTaskList(user)
    const totalBefore = getStore().tasks.length

    await user.click(
      within(getTaskPanel()).getByRole('button', {
        name: 'Удалить задачу «Выучить 20 новых слов»',
      }),
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/будет удалена безвозвратно/)).toBeInTheDocument()

    // отмена — задача остаётся
    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    expect(getStore().tasks).toHaveLength(totalBefore)
    expect(getTaskTitles()).toContain('Выучить 20 новых слов')

    await user.click(
      within(getTaskPanel()).getByRole('button', {
        name: 'Удалить задачу «Выучить 20 новых слов»',
      }),
    )
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getStore().tasks).toHaveLength(totalBefore - 1)
    expect(getTaskTitles()).not.toContain('Выучить 20 новых слов')
  })

  it('переносит задачу в другой раздел через форму', async () => {
    const user = userEvent.setup()
    await renderTaskList(user)

    await user.click(
      within(getTaskPanel()).getByRole('button', {
        name: 'Редактировать задачу «Выучить 20 новых слов»',
      }),
    )
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Раздел'), 'sec-algebra')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(getTaskTitles()).toEqual(['Прочитать статью и сделать пересказ'])

    await user.click(screen.getByRole('button', { name: 'Алгебра, задач: 3' }))
    expect(getTaskTitles()).toContain('Выучить 20 новых слов')
    expect(getStore().tasks.find((task) => task.title === 'Выучить 20 новых слов')?.sectionId).toBe(
      'sec-algebra',
    )
  })

  it('показывает пустое состояние раздела без задач', async () => {
    const user = userEvent.setup()
    await renderTaskList(user)

    // архивируем два раздела, оставшийся очищаем от задач
    for (const name of ['Алгебра', 'Физкультура']) {
      await user.click(screen.getByRole('button', { name: `Отправить «${name}» в архив` }))
    }
    for (const title of ['Выучить 20 новых слов', 'Прочитать статью и сделать пересказ']) {
      await user.click(
        within(getTaskPanel()).getByRole('button', { name: `Удалить задачу «${title}»` }),
      )
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }))
    }

    expect(within(getTaskPanel()).getByText(/пока нет задач/)).toBeInTheDocument()
    expect(
      within(getTaskPanel()).getByRole('button', { name: 'Добавить задачу' }),
    ).toBeInTheDocument()
  })
})
