import { TABS, type TabId } from '../lib/tabs'

type TabNavProps = {
  active: TabId
  onChange: (id: TabId) => void
}

export function TabNav({ active, onChange }: TabNavProps) {
  return (
    <nav className="tab-nav" aria-label="Основная навигация">
      <ul className="tab-nav__list">
        {TABS.map((tab) => (
          <li key={tab.id}>
            <button
              type="button"
              className="tab-nav__button"
              aria-current={tab.id === active ? 'page' : undefined}
              onClick={() => onChange(tab.id)}
            >
              {tab.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
