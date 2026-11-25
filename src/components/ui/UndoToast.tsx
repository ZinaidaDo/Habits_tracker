type UndoToastProps = {
  message: string
  /** Опционально: без колбэка кнопка «Отменить» не показывается. */
  onUndo?: () => void
}

/** Нижнее уведомление с отменой последнего действия. */
export function UndoToast({ message, onUndo }: UndoToastProps) {
  return (
    <div className="undo-toast" role="status">
      <span className="undo-toast__message">{message}</span>
      {onUndo && (
        <button type="button" className="undo-toast__undo" onClick={onUndo}>
          Отменить
        </button>
      )}
    </div>
  )
}
