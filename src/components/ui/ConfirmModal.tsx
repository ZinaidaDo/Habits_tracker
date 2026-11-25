import { Modal } from './Modal'

type ConfirmModalProps = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Универсальное окно подтверждения (удаление и другие необратимые действия). */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  danger = true,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const titleId = 'confirm-modal-title'

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm()
        }}
      >
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        <p className="confirm-message">{message}</p>

        <div className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="submit"
            className={`button ${danger ? 'button--danger' : 'button--primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
