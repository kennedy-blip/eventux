export type ViewId = 'topology' | 'producer' | 'consumers' | 'dlq'

export type DeliveryStatus = 'pending' | 'delivered' | 'retrying' | 'dead'

export interface DeliveryState {
  attempts: number
  status: DeliveryStatus
  updatedAt: number
  nextAttemptAt?: number
  error?: string
}

export interface EventMessage {
  id: string
  topicId: string
  partitionId: number
  offset: number
  key: string
  value: string
  headers: Record<string, string>
  timestamp: number
  size: number
  deliveries: Record<string, DeliveryState>
}

export interface Partition {
  id: number
  brokerId: string
  replicas: string[]
  nextOffset: number
  log: EventMessage[]
}

export interface Topic {
  id: string
  name: string
  description: string
  color: string
  partitions: Partition[]
  retentionHours: number
  roundRobin: number
  createdAt: number
}

export type GroupStatus = 'active' | 'paused' | 'rebalancing'

export interface ConsumerGroup {
  id: string
  name: string
  description: string
  subscriptions: string[]
  members: number
  maxMembers: number
  generation: number
  status: GroupStatus
  rebalanceTicks: number
  committed: Record<string, number>
  rate: number
  failureRate: number
  maxRetries: number
  credit: number
  cursor: number
  consumed: number
  failures: number
  throughput: number
  throughputHistory: number[]
  lastRebalance: number
  memberEpoch: number
}

export type DlqStatus = 'open' | 'replayed' | 'discarded'

export interface DlqRecord {
  id: string
  message: EventMessage
  groupId: string
  reason: string
  failedAt: number
  attempts: number
  status: DlqStatus
  resolvedAt?: number
  replayedMessageId?: string
}

export type ActivityType = 'publish' | 'ack' | 'retry' | 'dlq' | 'system' | 'rebalance' | 'purge'

export interface Activity {
  id: string
  type: ActivityType
  message: string
  timestamp: number
  topicId?: string
  partitionId?: number
  offset?: number
  groupId?: string
}

export interface Packet {
  id: string
  messageId: string
  topicId: string
  partitionId: number
  key: string
  createdAt: number
}

export interface MetricPoint {
  timestamp: number
  published: number
  consumed: number
  lag: number
  dlq: number
}

export interface BrokerNode {
  id: string
  host: string
  rack: string
  status: 'online' | 'degraded'
  load: number
}

export interface BrokerSettings {
  running: boolean
  autoProduce: boolean
  produceRate: number
  tickMs: number
}

export interface BrokerStats {
  published: number
  consumed: number
  failed: number
}

export interface BrokerState {
  schema: number
  topics: Topic[]
  groups: ConsumerGroup[]
  dlq: DlqRecord[]
  activity: Activity[]
  packets: Packet[]
  history: MetricPoint[]
  stats: BrokerStats
  settings: BrokerSettings
  nodes: BrokerNode[]
  producerCredit: number
  sequence: number
  startedAt: number
  lastTick: number
}

export interface PublishInput {
  topicId: string
  key: string
  value: string
  headers: Record<string, string>
  partitionId?: number
}

export interface TopicDraft {
  name: string
  description: string
  partitions: number
  retentionHours: number
}

export type BrokerAction =
  | { type: 'TICK'; now: number }
  | { type: 'PUBLISH'; input: PublishInput; now: number; id?: string }
  | { type: 'PURGE_TOPIC'; topicId: string; now: number }
  | { type: 'CONFIGURE_TOPIC'; topicId: string; partitions: number; retentionHours: number; now: number }
  | { type: 'CREATE_TOPIC'; draft: TopicDraft; now: number }
  | { type: 'SET_GROUP'; groupId: string; patch: Partial<Pick<ConsumerGroup, 'members' | 'rate' | 'failureRate' | 'maxRetries' | 'status' | 'subscriptions'>>; now: number }
  | { type: 'REBALANCE'; groupId: string; mode: 'rebalance' | 'failover'; now: number }
  | { type: 'RESOLVE_DLQ'; ids: string[]; mode: 'replay' | 'discard'; now: number }
  | { type: 'SET_SETTINGS'; patch: Partial<BrokerSettings> }
  | { type: 'CLEAR_ACTIVITY' }
  | { type: 'RESET'; state: BrokerState }
