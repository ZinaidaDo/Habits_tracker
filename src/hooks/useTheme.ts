import { useEffect } from 'react'
import { useStore } from './useStore'
import { applyTheme } from '../lib/settings'

/**
 * Применяет тему из стора к <html data-theme>: 'system' снимает атрибут
 * (работает prefers-color-scheme), 'light'/'dark' задают явно.
 * Атрибут переживает перезагрузку, потому что тема читается из localStorage.
 */
export function useTheme(): void {
  const { theme } = useStore().settings

  useEffect(() => {
    applyTheme(theme)
  }, [theme])
}
