import { useState, type FormEvent } from 'react'
import { useStore } from '../../hooks/useStore'
import { activeSections, countTasksInSection, deleteSection } from '../../lib/sections'
import { setStore } from '../../lib/store'
import type { Section } from '../../lib/types'
import { Modal } from '../ui/Modal'

type DeleteSectionModalProps = {
  section: Section
  onClose: () => void
}

function tasksWord(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'задача'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'задачи'
  return 'задач'
}

export function DeleteSectionModal({ section, onClose }: DeleteSectionModalProps) {
  const store = useStore()
  const counts = countTasksInSection(store, section.id)
  const others = activeSections(store).filter((item) => item.id !== section.id)

  const [fate, setFate] = useState<'move' | 'delete'>(others.length > 0 ? 'move' : 'delete')
  const [targetId, setTargetId] = useState(others[0]?.id ?? '')

  const titleId = 'delete-section-title'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const shouldMove = fate === 'move' && targetId !== ''
    setStore(
      deleteSection(
        store,
        section.id,
        shouldMove ? { action: 'move', targetSectionId: targetId } : { action: 'delete' },
      ),
    )
    onClose()
  }

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2 className="modal__title" id={titleId}>
          Удалить раздел «{section.name}»?
        </h2>

        {counts.total > 0 ? (
          <>
            <p>
              В разделе {counts.total} {tasksWord(counts.total)}. Что с ними сделать?
            </p>

            <fieldset className="option-group">
              <legend>Судьба задач</legend>
              <div className="radio-list">
                <label>
                  <input
                    type="radio"
                    name="section-fate"
                    checked={fate === 'move'}
                    disabled={others.length === 0}
                    onChange={() => setFate('move')}
                  />
                  Переместить в другой раздел
                </label>
                <label>
                  <input
                    type="radio"
                    name="section-fate"
                    checked={fate === 'delete'}
                    onChange={() => setFate('delete')}
                  />
                  Удалить вместе с разделом
                </label>
              </div>
            </fieldset>

            {fate === 'move' && (
              <div className="form-field">
                <label htmlFor="delete-target">Раздел-получатель</label>
                <select
                  id="delete-target"
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                >
                  {others.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.emoji} {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <p>В разделе нет задач.</p>
        )}

        <div className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="button button--danger">
            Удалить
          </button>
        </div>
      </form>
    </Modal>
  )
}
