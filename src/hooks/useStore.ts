import { useSyncExternalStore } from 'react'
import { getStore, subscribeStore } from '../lib/store'
import type { Store } from '../lib/types'

/** React-привязка к стору: перерисовывается при любом setStore. */
export function useStore(): Store {
  return useSyncExternalStore(subscribeStore, getStore)
}
