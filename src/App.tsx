import { SectionsScreen } from './components/sections/SectionsScreen'
import { SettingsScreen } from './components/settings/SettingsScreen'
import { StatsScreen } from './components/stats/StatsScreen'
import { TabNav } from './components/TabNav'
import { TodayScreen } from './components/today/TodayScreen'
import { useActiveTab } from './hooks/useActiveTab'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const { activeTab, setActiveTab } = useActiveTab()
  useTheme()

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__logo" aria-hidden="true">
          📚
        </span>
        <h1 className="app__title">Трекер учебных задач</h1>
      </header>

      <TabNav active={activeTab} onChange={setActiveTab} />

      <main className="app__main">
        {activeTab === 'board' ? (
          <SectionsScreen />
        ) : activeTab === 'today' ? (
          <TodayScreen />
        ) : activeTab === 'stats' ? (
          <StatsScreen />
        ) : (
          <SettingsScreen />
        )}
      </main>
    </div>
  )
}
