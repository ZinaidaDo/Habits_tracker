import type { CSSProperties, DragEvent } from 'react'
import type { Progress } from '../../lib/progress'
import type { Section } from '../../lib/types'

type SectionListItemProps = {
  section: Section
  counts: { total: number; done: number }
  progress: Progress
  isActive: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  /** Подсветка при перетаскивании задачи на этот раздел. */
  isDropTarget: boolean
  onSelect: () => void
  onEdit: () => void
  onToggleArchive: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onDragOver: (event: DragEvent<HTMLLIElement>) => void
  onDragLeave: (event: DragEvent<HTMLLIElement>) => void
  onDrop: (event: DragEvent<HTMLLIElement>) => void
}

export function SectionListItem({
  section,
  counts,
  progress,
  isActive,
  canMoveUp,
  canMoveDown,
  isDropTarget,
  onSelect,
  onEdit,
  onToggleArchive,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: SectionListItemProps) {
  const { name, emoji, color, archived } = section

  const label = (
    <>
      <span className="section-item__row">
        <span className="section-item__emoji" aria-hidden="true">
          {emoji}
        </span>
        <span className="section-item__name">{name}</span>
        <span className="section-item__count" aria-hidden={!archived}>
          <span className="visually-hidden">Задач: </span>
          {counts.total}
        </span>
      </span>
      <span className="section-item__progress">
        <span className="section-item__bar-track" aria-hidden="true">
          <span className="section-item__bar" style={{ width: `${progress.percent}%` }} />
        </span>
        <span className="section-item__percent">{progress.percent}%</span>
      </span>
    </>
  )

  return (
    <li
      className={[
        'section-item',
        isActive && !archived ? 'section-item--active' : '',
        isDropTarget ? 'section-item--drop-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--section-color': color } as CSSProperties}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {archived ? (
        <div className="section-item__label">{label}</div>
      ) : (
        <button
          type="button"
          className="section-item__select"
          aria-label={`${name}, задач: ${counts.total}`}
          aria-current={isActive ? 'true' : undefined}
          onClick={onSelect}
        >
          {label}
        </button>
      )}

      <div className="section-item__actions">
        {!archived && (
          <>
            <button
              type="button"
              className="section-item__action"
              aria-label={`Переместить «${name}» вверх`}
              disabled={!canMoveUp}
              onClick={onMoveUp}
            >
              ↑
            </button>
            <button
              type="button"
              className="section-item__action"
              aria-label={`Переместить «${name}» вниз`}
              disabled={!canMoveDown}
              onClick={onMoveDown}
            >
              ↓
            </button>
            <button
              type="button"
              className="section-item__action"
              aria-label={`Редактировать «${name}»`}
              onClick={onEdit}
            >
              ✎
            </button>
            <button
              type="button"
              className="section-item__action"
              aria-label={`Отправить «${name}» в архив`}
              onClick={onToggleArchive}
            >
              🗄
            </button>
          </>
        )}
        {archived && (
          <button
            type="button"
            className="section-item__action"
            aria-label={`Вернуть «${name}» из архива`}
            onClick={onToggleArchive}
          >
            ↩
          </button>
        )}
        <button
          type="button"
          className="section-item__action"
          aria-label={`Удалить «${name}»`}
          onClick={onDelete}
        >
          🗑
        </button>
      </div>
    </li>
  )
}
