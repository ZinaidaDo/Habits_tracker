import { useEffect, useState } from 'react'
import { setStore } from '../lib/store'
import type { Store } from '../lib/types'

const TOAST_TIMEOUT_MS = 5000

export type UndoToastData = { message: string; undo?: Store }

/**
 * Undo-уведомление: показывает сообщение с кнопкой «Отменить»
 * (откатывает действие по снимку стора) и скрывает его через 5 секунд.
 * Кнопка есть только если передан снимок для отката.
 */
export function useUndoToast() {
  const [toast, setToast] = useState<UndoToastData | null>(null)

  useEffect(() => {
    if (toast === null) return
    const timer = window.setTimeout(() => setToast(null), TOAST_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  function show(message: string, undo?: Store) {
    setToast({ message, undo })
  }

  function undo() {
    if (toast?.undo) setStore(toast.undo)
    setToast(null)
  }

  return { toast, show, undo: toast?.undo ? undo : undefined }
}
