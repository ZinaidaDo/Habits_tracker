import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Контрастность дизайн-токенов (WCAG 2.1, AA: текст ≥ 4.5:1).
 * Значения читаются из tokens.css, чтобы тест реагировал на смену цветов.
 */

const css = readFileSync(resolve('src/styles/tokens.css'), 'utf8')

function parseBlock(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  expect(start, `селектор ${selector} не найден в tokens.css`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  const vars: Record<string, string> = {}
  for (const line of css.slice(open + 1, close).split('\n')) {
    const match = line.match(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/)
    if (match) vars[match[1]] = match[2]
  }
  return vars
}

const light = parseBlock(':root {')
const dark = parseBlock(":root[data-theme='dark'] {")

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(fg: string, bg: string): number {
  const a = luminance(fg)
  const b = luminance(bg)
  const [lighter, darker] = a > b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}

type Pair = [label: string, fgVar: string, bgVar: string]

const LIGHT_PAIRS: Pair[] = [
  ['основной текст на фоне', '--color-text', '--color-bg'],
  ['основной текст на поверхности', '--color-text', '--color-surface'],
  ['приглушённый текст на фоне', '--color-text-muted', '--color-bg'],
  ['приглушённый текст на поверхности', '--color-text-muted', '--color-surface'],
  ['приглушённый текст на ховере', '--color-text-muted', '--color-surface-hover'],
  ['текст на primary-кнопке', '--color-primary-contrast', '--color-primary'],
  ['текст на опасной кнопке', '--color-on-danger', '--color-danger'],
]

const DARK_PAIRS: Pair[] = LIGHT_PAIRS

function expectPairs(vars: Record<string, string>, pairs: Pair[]): void {
  for (const [label, fgVar, bgVar] of pairs) {
    const fg = vars[fgVar]
    const bg = vars[bgVar]
    expect(fg, `нет токена ${fgVar}`).toBeTruthy()
    expect(bg, `нет токена ${bgVar}`).toBeTruthy()
    expect(contrast(fg, bg), `${label}: ${fg} на ${bg}`).toBeGreaterThanOrEqual(4.5)
  }
}

describe('контраст дизайн-токенов (WCAG AA ≥ 4.5:1)', () => {
  it('светлая тема', () => {
    expectPairs(light, LIGHT_PAIRS)
  })

  it('тёмная тема', () => {
    expectPairs(dark, DARK_PAIRS)
  })

  it('обе темы задают все нужные токены', () => {
    for (const vars of [light, dark]) {
      for (const [, fgVar, bgVar] of LIGHT_PAIRS) {
        expect(vars[fgVar]).toBeTruthy()
        expect(vars[bgVar]).toBeTruthy()
      }
    }
  })
})
