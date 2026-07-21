import { useCallback, useEffect, useReducer } from 'react'
import { brokerReducer, createInitialState, uid } from '../lib/broker'
import type { BrokerSettings, BrokerState, ConsumerGroup, PublishInput, TopicDraft } from '../types'

const STORAGE_KEY = 'eventpulse.broker.v1'

function loadState(): BrokerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as BrokerState
    if (parsed.schema !== 1 || !Array.isArray(parsed.topics) || !Array.isArray(parsed.groups)) return createInitialState()
    return {
      ...parsed,
      packets: [],
      settings: Object.assign({ running: true, autoProduce: true, produceRate: 2, tickMs: 700 }, parsed.settings),
      lastTick: Date.now(),
    }
  } catch {
    return createInitialState()
  }
}

export function useBroker() {
  const [state, dispatch] = useReducer(brokerReducer, undefined, loadState)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        // Storage can be unavailable in private browsing; the simulator still works in memory.
      }
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [state])

  useEffect(() => {
    if (!state.settings.running) return undefined
    const interval = window.setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), state.settings.tickMs)
    return () => window.clearInterval(interval)
  }, [state.settings.running, state.settings.tickMs])

  const publish = useCallback((input: PublishInput) => {
    const id = uid('msg')
    dispatch({ type: 'PUBLISH', input, id, now: Date.now() })
    return id
  }, [])

  const purgeTopic = useCallback((topicId: string) => {
    dispatch({ type: 'PURGE_TOPIC', topicId, now: Date.now() })
  }, [])

  const configureTopic = useCallback((topicId: string, partitions: number, retentionHours: number) => {
    dispatch({ type: 'CONFIGURE_TOPIC', topicId, partitions, retentionHours, now: Date.now() })
  }, [])

  const createTopic = useCallback((draft: TopicDraft) => {
    dispatch({ type: 'CREATE_TOPIC', draft, now: Date.now() })
  }, [])

  const updateGroup = useCallback((groupId: string, patch: Partial<Pick<ConsumerGroup, 'members' | 'rate' | 'failureRate' | 'maxRetries' | 'status' | 'subscriptions'>>) => {
    dispatch({ type: 'SET_GROUP', groupId, patch, now: Date.now() })
  }, [])

  const rebalance = useCallback((groupId: string, mode: 'rebalance' | 'failover') => {
    dispatch({ type: 'REBALANCE', groupId, mode, now: Date.now() })
  }, [])

  const resolveDlq = useCallback((ids: string[], mode: 'replay' | 'discard') => {
    dispatch({ type: 'RESOLVE_DLQ', ids, mode, now: Date.now() })
  }, [])

  const setSettings = useCallback((patch: Partial<BrokerSettings>) => {
    dispatch({ type: 'SET_SETTINGS', patch })
  }, [])

  const clearActivity = useCallback(() => dispatch({ type: 'CLEAR_ACTIVITY' }), [])

  const reset = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* no-op */ }
    dispatch({ type: 'RESET', state: createInitialState() })
  }, [])

  return {
    state,
    publish,
    purgeTopic,
    configureTopic,
    createTopic,
    updateGroup,
    rebalance,
    resolveDlq,
    setSettings,
    clearActivity,
    reset,
  }
}

export type BrokerController = ReturnType<typeof useBroker>
