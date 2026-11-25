import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStore, resetStore, setStore } from '../../lib/store'
import { serializeStore } from '../../lib/settings'
import App from '../../App'
import { SettingsScreen } from './SettingsScreen'

beforeEach(() => {
  localStorage.clear()
  resetStore()
  document.documentElement.removeAttribute('data-theme')
})

describe('SettingsScreen — экран «Настройки» (этап 8)', () => {
  it('показывает заголовок, группы настроек и опасную зону', () => {
    render(<SettingsScreen />)

    expect(screen.getByRole('heading', { level: 2, name: 'Настройки' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Тема оформления' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Первая неделя' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Экспорт в JSON' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Импорт из файла' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сбросить все данные' })).toBeInTheDocument()
  })

  it('переключение темы меняет data-theme и сохраняется в сторе', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Настройки' }))

    // по умолчанию 'system' — атрибута нет
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)

    await user.click(screen.getByRole('radio', { name: 'Тёмная' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(getStore().settings.theme).toBe('dark')

    await user.click(screen.getByRole('radio', { name: 'Светлая' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    await user.click(screen.getByRole('radio', { name: 'Системная' }))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(getStore().settings.theme).toBe('system')
  })

  it('тема переживает перезагрузку (читается из localStorage)', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Настройки' }))
    await user.click(screen.getByRole('radio', { name: 'Тёмная' }))
    first.unmount()

    // имитация перезагрузки: кэш сброшен, стор читается из localStorage
    resetStore()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Настройки' }))

    expect(getStore().settings.theme).toBe('dark')
    expect(screen.getByRole('radio', { name: 'Тёмная' })).toBeChecked()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('первая неделя меняется и сохраняется в сторе', async () => {
    const user = userEvent.setup()
    render(<SettingsScreen />)

    await user.click(screen.getByRole('radio', { name: 'Воскресенье' }))
    expect(getStore().settings.firstDayOfWeek).toBe(0)

    await user.click(screen.getByRole('radio', { name: 'Понедельник' }))
    expect(getStore().settings.firstDayOfWeek).toBe(1)
  })

  it('экспорт создаёт JSON-файл с текущим состоянием', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:export')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    render(<SettingsScreen />)
    await user.click(screen.getByRole('button', { name: 'Экспорт в JSON' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe(serializeStore(getStore()))
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
    expect(screen.getByRole('status')).toHaveTextContent('Файл экспортирован')

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('импорт валидного файла восстанавливает состояние 1:1', async () => {
    const user = userEvent.setup()
    // экспорт текущего состояния (6 задач, тема system)
    const exported = serializeStore(getStore())
    // текущий стор «запятнан» — импорт должен его заменить
    setStore({
      ...getStore(),
      tasks: [],
      settings: { theme: 'dark', firstDayOfWeek: 1 },
    })

    render(<SettingsScreen />)
    const input = screen.getByLabelText('Файл для импорта')
    const file = new File([exported], 'task-tracker-2026-11-25.json', {
      type: 'application/json',
    })
    await user.upload(input, file)

    await screen.findByText('Данные импортированы')
    expect(getStore().tasks).toHaveLength(6)
    expect(getStore().settings).toEqual({ theme: 'system', firstDayOfWeek: 0 })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('битый файл отклоняется с role="alert", текущие данные не теряются', async () => {
    const user = userEvent.setup()
    const before = getStore()
    render(<SettingsScreen />)

    const input = screen.getByLabelText('Файл для импорта')
    const file = new File(['{битый json'], 'broken.json', { type: 'application/json' })
    await user.upload(input, file)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/JSON/)
    expect(getStore()).toEqual(before)
    expect(screen.queryByText('Данные импортированы')).toBeNull()
  })

  it('чужой файл отклоняется, стор не меняется', async () => {
    const user = userEvent.setup()
    const before = getStore()
    render(<SettingsScreen />)

    const input = screen.getByLabelText('Файл для импорта')
    const file = new File(['{"hello":"world"}'], 'foreign.json', { type: 'application/json' })
    await user.upload(input, file)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/не данные трекера/)
    expect(getStore()).toEqual(before)
  })

  it('ошибка импорта исчезает после успешного импорта', async () => {
    const user = userEvent.setup()
    render(<SettingsScreen />)

    const input = screen.getByLabelText('Файл для импорта')
    await user.upload(input, new File(['oops'], 'bad.json', { type: 'application/json' }))
    await screen.findByRole('alert')

    await user.upload(
      input,
      new File([serializeStore(getStore())], 'good.json', { type: 'application/json' }),
    )
    await screen.findByText('Данные импортированы')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('сброс требует двойного подтверждения: модалка + чекбокс', async () => {
    const user = userEvent.setup()
    render(<SettingsScreen />)

    // шаг 1: кнопка открывает модалку, подтверждение неактивно
    await user.click(screen.getByRole('button', { name: 'Сбросить все данные' }))
    const dialog = screen.getByRole('dialog', { name: 'Сбросить все данные?' })
    expect(dialog).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Сбросить' })
    expect(confirm).toBeDisabled()

    // шаг 2: без чекбокса сброс не происходит
    await user.click(confirm)
    expect(getStore().tasks.length).toBeGreaterThan(0)

    // шаг 3: чекбокс включает кнопку, сброс очищает данные
    await user.click(screen.getByRole('checkbox'))
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Все данные сброшены')
    // сид-задачи создаются заново в DEV
    expect(getStore().tasks.length).toBeGreaterThan(0)
    expect(getStore().settings).toEqual({ theme: 'system', firstDayOfWeek: 0 })
  })

  it('Escape и «Отмена» закрывают модалку сброса без изменений', async () => {
    const user = userEvent.setup()
    const before = getStore()
    render(<SettingsScreen />)

    await user.click(screen.getByRole('button', { name: 'Сбросить все данные' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(getStore()).toEqual(before)

    await user.click(screen.getByRole('button', { name: 'Сбросить все данные' }))
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getStore()).toEqual(before)
  })
})
