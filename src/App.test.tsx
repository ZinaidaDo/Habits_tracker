import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { TABS } from './lib/tabs'

describe('App — каркас (этап 0)', () => {
  it('отрисовывает заголовок приложения и 4 вкладки', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: /трекер учебных задач/i }),
    ).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: /основная навигация/i })
    expect(within(nav).getAllByRole('button')).toHaveLength(TABS.length)
  })

  it('по умолчанию открыт экран «Сегодня»', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 2, name: 'Сегодня' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сегодня' })).toHaveAttribute('aria-current', 'page')
  })

  it('переключает вкладки и обновляет заголовок экрана', async () => {
    const user = userEvent.setup()
    render(<App />)

    for (const tab of TABS) {
      await user.click(screen.getByRole('button', { name: tab.title }))

      expect(screen.getByRole('heading', { level: 2, name: tab.title })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: tab.title })).toHaveAttribute(
        'aria-current',
        'page',
      )
    }
  })

  it('вкладки доступны с клавиатуры: Tab и Enter', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Сегодня' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Доска' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { level: 2, name: 'Доска' })).toBeInTheDocument()
  })
})
