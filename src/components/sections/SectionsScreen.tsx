import { useState, type DragEvent } from 'react'
import { useStore } from '../../hooks/useStore'
import { useUndoToast } from '../../hooks/useUndoToast'
import { sectionProgress } from '../../lib/progress'
import {
  activeSections,
  archivedSections,
  countTasksInSection,
  moveSection,
  setSectionArchived,
} from '../../lib/sections'
import { getStore, setStore } from '../../lib/store'
import { updateTask } from '../../lib/tasks'
import type { Section } from '../../lib/types'
import { KanbanBoard } from '../board/KanbanBoard'
import { TaskList } from '../tasks/TaskList'
import { ConfirmModal } from '../ui/ConfirmModal'
import { UndoToast } from '../ui/UndoToast'
import { DeleteSectionModal } from './DeleteSectionModal'
import { SectionFormModal } from './SectionFormModal'
import { SectionListItem } from './SectionListItem'

type FormState = { mode: 'create' } | { mode: 'edit'; sectionId: string }
type PendingMove = { taskId: string; sectionId: string }

export function SectionsScreen() {
  const store = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  /** Мобилка: список разделов раскрыт по кнопке «Все разделы». */
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toast = useUndoToast()

  const actives = activeSections(store)
  const archived = archivedSections(store)
  const current = actives.find((section) => section.id === selectedId) ?? actives[0] ?? null

  const editingSection =
    form?.mode === 'edit'
      ? (store.sections.find((section) => section.id === form.sectionId) ?? null)
      : null
  const deletingSection = deleteId
    ? (store.sections.find((section) => section.id === deleteId) ?? null)
    : null
  const pendingTask = pendingMove
    ? (store.tasks.find((task) => task.id === pendingMove.taskId) ?? null)
    : null
  const pendingSection = pendingMove
    ? (store.sections.find((section) => section.id === pendingMove.sectionId) ?? null)
    : null

  /** Перенос задачи в раздел: архивный раздел требует подтверждения. */
  function requestMove(taskId: string, sectionId: string) {
    const target = store.sections.find((section) => section.id === sectionId)
    const task = store.tasks.find((item) => item.id === taskId)
    if (!target || !task || task.sectionId === sectionId) return
    if (target.archived) {
      setPendingMove({ taskId, sectionId })
      return
    }
    applyMove(taskId, sectionId)
  }

  function applyMove(taskId: string, sectionId: string) {
    const prev = getStore()
    const task = prev.tasks.find((item) => item.id === taskId)
    const target = prev.sections.find((section) => section.id === sectionId)
    if (!task || !target || task.sectionId === sectionId) return

    setStore(updateTask(prev, taskId, { sectionId }))
    toast.show(`«${task.title}» → «${target.name}»`, prev)
  }

  function handleSectionDragOver(event: DragEvent<HTMLLIElement>, sectionId: string) {
    if (!event.dataTransfer.types.includes('text/plain')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetId(sectionId)
  }

  function handleSectionDragLeave(event: DragEvent<HTMLLIElement>, sectionId: string) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDropTargetId((current) => (current === sectionId ? null : current))
  }

  function handleSectionDrop(event: DragEvent<HTMLLIElement>, sectionId: string) {
    event.preventDefault()
    setDropTargetId(null)
    const taskId = event.dataTransfer.getData('text/plain')
    if (taskId) requestMove(taskId, sectionId)
  }

  function sectionItemProps(section: Section) {
    return {
      progress: sectionProgress(store, section.id),
      isDropTarget: dropTargetId === section.id,
      onDragOver: (event: DragEvent<HTMLLIElement>) => handleSectionDragOver(event, section.id),
      onDragLeave: (event: DragEvent<HTMLLIElement>) => handleSectionDragLeave(event, section.id),
      onDrop: (event: DragEvent<HTMLLIElement>) => handleSectionDrop(event, section.id),
    }
  }

  return (
    <div className="sections-screen">
      <h2 className="screen-title">Доска</h2>

      <div className="sections-screen__body">
        <aside
          className={`sections-sidebar${sidebarOpen ? ' sections-sidebar--open' : ''}`}
          aria-label="Разделы"
        >
          <div className="sections-sidebar__header">
            <h3 className="sections-sidebar__title">Разделы</h3>
            <button
              type="button"
              className="icon-button"
              aria-label="Добавить раздел"
              onClick={() => setForm({ mode: 'create' })}
            >
              +
            </button>
          </div>

          {/* Мобилка: селектор разделов вместо постоянного списка */}
          <div className="sections-sidebar__mobile">
            <label className="visually-hidden" htmlFor="section-picker">
              Выбрать раздел
            </label>
            <select
              id="section-picker"
              className="sections-sidebar__picker"
              value={current?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {actives.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.emoji} {section.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button button--ghost sections-sidebar__toggle"
              aria-expanded={sidebarOpen}
              aria-controls="sections-sidebar-list"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              {sidebarOpen ? 'Скрыть список' : 'Все разделы'}
            </button>
          </div>

          <div className="sections-sidebar__list-wrap" id="sections-sidebar-list">
            {actives.length === 0 && archived.length === 0 ? (
              <p className="empty-hint">Нет разделов. Создайте первый, чтобы добавлять задачи.</p>
            ) : (
              <>
                <ul className="sections-list">
                  {actives.map((section, index) => (
                    <SectionListItem
                      key={section.id}
                      section={section}
                      counts={countTasksInSection(store, section.id)}
                      isActive={current?.id === section.id}
                      canMoveUp={index > 0}
                      canMoveDown={index < actives.length - 1}
                      {...sectionItemProps(section)}
                      onSelect={() => setSelectedId(section.id)}
                      onEdit={() => setForm({ mode: 'edit', sectionId: section.id })}
                      onToggleArchive={() =>
                        setStore((prev) => setSectionArchived(prev, section.id, true))
                      }
                      onMoveUp={() => setStore((prev) => moveSection(prev, section.id, -1))}
                      onMoveDown={() => setStore((prev) => moveSection(prev, section.id, 1))}
                      onDelete={() => setDeleteId(section.id)}
                    />
                  ))}
                </ul>

                {archived.length > 0 && (
                  <>
                    <p className="sections-sidebar__subtitle">Архив</p>
                    <ul className="sections-list sections-list--archived">
                      {archived.map((section) => (
                        <SectionListItem
                          key={section.id}
                          section={section}
                          counts={countTasksInSection(store, section.id)}
                          isActive={false}
                          canMoveUp={false}
                          canMoveDown={false}
                          {...sectionItemProps(section)}
                          onSelect={() => setSelectedId(section.id)}
                          onEdit={() => setForm({ mode: 'edit', sectionId: section.id })}
                          onToggleArchive={() =>
                            setStore((prev) => setSectionArchived(prev, section.id, false))
                          }
                          onMoveUp={() => setStore((prev) => moveSection(prev, section.id, -1))}
                          onMoveDown={() => setStore((prev) => moveSection(prev, section.id, 1))}
                          onDelete={() => setDeleteId(section.id)}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </aside>

        <div className="sections-panel">
          {current ? (
            <>
              <CurrentSectionCard
                section={current}
                onEdit={() => setForm({ mode: 'edit', sectionId: current.id })}
                onArchive={() => setStore((prev) => setSectionArchived(prev, current.id, true))}
              />

              <div className="view-switch" role="group" aria-label="Вид задач">
                <button
                  type="button"
                  className="view-switch__button"
                  aria-pressed={view === 'kanban'}
                  onClick={() => setView('kanban')}
                >
                  Канбан
                </button>
                <button
                  type="button"
                  className="view-switch__button"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                >
                  Список
                </button>
              </div>

              {view === 'kanban' ? (
                <KanbanBoard section={current} onMoveTask={requestMove} />
              ) : (
                <TaskList section={current} onMoveTask={requestMove} />
              )}
            </>
          ) : (
            <section className="panel empty-state">
              <h3 className="empty-state__title">Нет разделов</h3>
              <p className="panel__hint">
                Создайте раздел — например, «Английский язык», — чтобы начать добавлять задачи.
              </p>
              <button
                type="button"
                className="button button--primary"
                onClick={() => setForm({ mode: 'create' })}
              >
                Создать раздел
              </button>
            </section>
          )}
        </div>
      </div>

      {form !== null && <SectionFormModal section={editingSection} onClose={() => setForm(null)} />}
      {deletingSection !== null && (
        <DeleteSectionModal section={deletingSection} onClose={() => setDeleteId(null)} />
      )}
      {pendingMove !== null && pendingTask !== null && pendingSection !== null && (
        <ConfirmModal
          title="Перенести в архивный раздел?"
          message={`«${pendingTask.title}» будет перенесена в архивный раздел «${pendingSection.name}».`}
          confirmLabel="Перенести"
          danger={false}
          onConfirm={() => {
            applyMove(pendingMove.taskId, pendingMove.sectionId)
            setPendingMove(null)
          }}
          onClose={() => setPendingMove(null)}
        />
      )}
      {toast.toast !== null && <UndoToast message={toast.toast.message} onUndo={toast.undo} />}
    </div>
  )
}

type CurrentSectionCardProps = {
  section: Section
  onEdit: () => void
  onArchive: () => void
}

function CurrentSectionCard({ section, onEdit, onArchive }: CurrentSectionCardProps) {
  const store = useStore()
  const counts = countTasksInSection(store, section.id)
  const progress = sectionProgress(store, section.id)

  return (
    <section className="panel section-card">
      <div className="section-card__head">
        <span className="section-card__emoji" aria-hidden="true">
          {section.emoji}
        </span>
        <h3 className="section-card__name">{section.name}</h3>
      </div>

      <dl className="section-card__stats">
        <div>
          <dt>Задач</dt>
          <dd>{counts.total}</dd>
        </div>
        <div>
          <dt>Выполнено</dt>
          <dd>{counts.done}</dd>
        </div>
      </dl>

      {progress.total > 0 ? (
        <div className="section-card__progress">
          <div
            className="progress"
            role="progressbar"
            aria-label={`Прогресс раздела ${section.name}`}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <div className="progress__fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="section-card__percent">{progress.percent}%</span>
        </div>
      ) : (
        <p className="panel__hint">В разделе пока нет задач.</p>
      )}

      <div className="section-card__actions">
        <button type="button" className="button button--ghost" onClick={onEdit}>
          Редактировать
        </button>
        <button type="button" className="button button--ghost" onClick={onArchive}>
          В архив
        </button>
      </div>

      <p className="panel__hint">Переключайте статусы перетаскиванием или меню на карточке.</p>
    </section>
  )
}
