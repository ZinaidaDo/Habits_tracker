import { useState } from 'react'
import type { TabId } from '../lib/tabs'

export function useActiveTab(initialTab: TabId = 'today') {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  return { activeTab, setActiveTab }
}
