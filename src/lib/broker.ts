import type {
  Activity,
  ActivityType,
  BrokerAction,
  BrokerNode,
  BrokerState,
  ConsumerGroup,
  DlqRecord,
  EventMessage,
  Partition,
  PublishInput,
  Topic,
  TopicDraft,
} from '../types'

export const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#38bdf8', '#f43f5e', '#c084fc']

export interface EventTemplate {
  id: string
  topicId: string
  label: string
  description: string
  key: string
  value: Record<string, unknown>
  headers: Record<string, string>
}

const topicBlueprints = [
  {
    id: 'user-signup',
    name: 'user.signup.v1',
    description: 'Identity lifecycle events from the account boundary.',
    color: COLORS[0],
    retentionHours: 72,
  },
  {
    id: 'orders-processed',
    name: 'orders.processed',
    description: 'Order state transitions emitted by checkout services.',
    color: COLORS[1],
    retentionHours: 48,
  },
  {
    id: 'payments-charged',
    name: 'payments.charged',
    description: 'Payment authorization and capture facts with strict retry rules.',
    color: COLORS[2],
    retentionHours: 168,
  },
  {
    id: 'inventory-updated',
    name: 'inventory.updated',
    description: 'Stock reservations and warehouse availability changes.',
    color: COLORS[3],
    retentionHours: 24,
  },
]

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'user-registered',
    topicId: 'user-signup',
    label: 'UserRegistered',
    description: 'A new account completed the registration boundary.',
    key: 'usr_8f42c1',
    value: {
      eventType: 'UserRegistered',
      eventId: 'evt_01J8M4K2N6',
      userId: 'usr_8f42c1',
      email: 'maya.chen@example.dev',
      plan: 'builder',
      region: 'us-east-1',
      occurredAt: '2026-02-18T14:32:08.441Z',
    },
    headers: { source: 'identity-api', schema: 'user.signup.v1', 'content-type': 'application/json' },
  },
  {
    id: 'user-verified',
    topicId: 'user-signup',
    label: 'UserVerified',
    description: 'The email ownership challenge was completed.',
    key: 'usr_1c90bd',
    value: {
      eventType: 'UserVerified',
      eventId: 'evt_01J8M4Q8PT',
      userId: 'usr_1c90bd',
      verificationMethod: 'email_link',
      verifiedAt: '2026-02-18T14:34:19.012Z',
      riskScore: 0.04,
    },
    headers: { source: 'identity-worker', schema: 'user.signup.v1', 'content-type': 'application/json' },
  },
  {
    id: 'marketing-opt-in',
    topicId: 'user-signup',
    label: 'MarketingOptIn',
    description: 'A consent change for lifecycle notifications.',
    key: 'usr_4be720',
    value: {
      eventType: 'MarketingOptIn',
      eventId: 'evt_01J8M4S1AA',
      userId: 'usr_4be720',
      channel: 'product_email',
      consented: true,
      consentVersion: '2026-02-01',
    },
    headers: { source: 'preference-service', schema: 'user.signup.v1', 'content-type': 'application/json' },
  },
  {
    id: 'order-processed',
    topicId: 'orders-processed',
    label: 'OrderProcessed',
    description: 'Checkout accepted an order and reserved its workflow.',
    key: 'ord_734921',
    value: {
      eventType: 'OrderProcessed',
      eventId: 'evt_01J8M51F0K',
      orderId: 'ord_734921',
      customerId: 'usr_8f42c1',
      currency: 'USD',
      total: 248.5,
      items: [{ sku: 'keyboard-75', quantity: 1 }, { sku: 'desk-mat-xl', quantity: 1 }],
      occurredAt: '2026-02-18T14:36:02.105Z',
    },
    headers: { source: 'checkout-api', schema: 'orders.v2', traceparent: '00-4bf92f3577b34da6a325ce6b0e0a89-00f067aa0ba902b7-01' },
  },
  {
    id: 'order-fulfilled',
    topicId: 'orders-processed',
    label: 'OrderFulfilled',
    description: 'The warehouse handed an order to the carrier.',
    key: 'ord_735104',
    value: {
      eventType: 'OrderFulfilled',
      eventId: 'evt_01J8M56R9D',
      orderId: 'ord_735104',
      warehouse: 'wh_east_02',
      carrier: 'northstar',
      trackingId: 'NS-884201739',
      fulfilledAt: '2026-02-18T14:39:44.810Z',
    },
    headers: { source: 'fulfillment-worker', schema: 'orders.v2', 'content-type': 'application/json' },
  },
  {
    id: 'order-cancelled',
    topicId: 'orders-processed',
    label: 'OrderCancelled',
    description: 'An order was cancelled before fulfillment.',
    key: 'ord_735118',
    value: {
      eventType: 'OrderCancelled',
      eventId: 'evt_01J8M5A2VC',
      orderId: 'ord_735118',
      reason: 'customer_requested',
      refundRequired: true,
      cancelledAt: '2026-02-18T14:41:11.530Z',
    },
    headers: { source: 'order-command-api', schema: 'orders.v2', 'content-type': 'application/json' },
  },
  {
    id: 'payment-authorized',
    topicId: 'payments-charged',
    label: 'PaymentAuthorized',
    description: 'A payment provider authorized the requested amount.',
    key: 'pay_91ab20',
    value: {
      eventType: 'PaymentAuthorized',
      eventId: 'evt_01J8M5D7JH',
      paymentId: 'pay_91ab20',
      orderId: 'ord_734921',
      provider: 'stripe-sandbox',
      amount: 248.5,
      currency: 'USD',
      authorizationCode: 'AUTH-720194',
    },
    headers: { source: 'payments-api', schema: 'payments.v3', 'content-type': 'application/json', 'idempotency-key': 'checkout_ord_734921' },
  },
  {
    id: 'payment-captured',
    topicId: 'payments-charged',
    label: 'PaymentCaptured',
    description: 'Funds were captured after the fulfillment policy passed.',
    key: 'pay_91ab20',
    value: {
      eventType: 'PaymentCaptured',
      eventId: 'evt_01J8M5J4QW',
      paymentId: 'pay_91ab20',
      orderId: 'ord_734921',
      amount: 248.5,
      currency: 'USD',
      capturedAt: '2026-02-18T14:43:22.008Z',
    },
    headers: { source: 'ledger-worker', schema: 'payments.v3', 'content-type': 'application/json' },
  },
  {
    id: 'payment-failed',
    topicId: 'payments-charged',
    label: 'PaymentFailed',
    description: 'A provider declined a charge and returned a retry classification.',
    key: 'pay_91af77',
    value: {
      eventType: 'PaymentFailed',
      eventId: 'evt_01J8M5N8XZ',
      paymentId: 'pay_91af77',
      orderId: 'ord_735118',
      provider: 'stripe-sandbox',
      declineCode: 'insufficient_funds',
      retryable: false,
      amount: 89.99,
      currency: 'USD',
    },
    headers: { source: 'payments-api', schema: 'payments.v3', 'content-type': 'application/json', 'x-simulate-failure': 'false' },
  },
  {
    id: 'stock-reserved',
    topicId: 'inventory-updated',
    label: 'StockReserved',
    description: 'Inventory was reserved for a checkout session.',
    key: 'sku_keyboard-75',
    value: {
      eventType: 'StockReserved',
      eventId: 'evt_01J8M5R3LM',
      sku: 'keyboard-75',
      warehouse: 'wh_east_02',
      quantity: 1,
      reservationId: 'rsv_510002',
      expiresAt: '2026-02-18T14:58:02.105Z',
    },
    headers: { source: 'inventory-api', schema: 'inventory.v1', 'content-type': 'application/json' },
  },
  {
    id: 'stock-adjusted',
    topicId: 'inventory-updated',
    label: 'StockAdjusted',
    description: 'A cycle count corrected available inventory.',
    key: 'sku_desk-mat-xl',
    value: {
      eventType: 'StockAdjusted',
      eventId: 'evt_01J8M5V6NB',
      sku: 'desk-mat-xl',
      warehouse: 'wh_west_01',
      delta: 12,
      available: 184,
      reason: 'cycle_count',
    },
    headers: { source: 'warehouse-sync', schema: 'inventory.v1', 'content-type': 'application/json' },
  },
  {
    id: 'stock-released',
    topicId: 'inventory-updated',
    label: 'StockReleased',
    description: 'An expired reservation returned stock to the available pool.',
    key: 'sku_keyboard-75',
    value: {
      eventType: 'StockReleased',
      eventId: 'evt_01J8M5Y9FD',
      sku: 'keyboard-75',
      warehouse: 'wh_east_02',
      quantity: 1,
      reservationId: 'rsv_510014',
      releaseReason: 'reservation_expired',
    },
    headers: { source: 'inventory-worker', schema: 'inventory.v1', 'content-type': 'application/json' },
  },
]

const groupBlueprints = [
  {
    id: 'orders-api',
    name: 'orders-api',
    description: 'Synchronous order read-model projector. Prefers low latency over batching.',
    subscriptions: ['orders-processed', 'payments-charged'],
    members: 3,
    rate: 7,
    failureRate: 0.025,
    maxRetries: 3,
  },
  {
    id: 'analytics-worker',
    name: 'analytics-worker',
    description: 'Batch-oriented event enrichment for the product analytics warehouse.',
    subscriptions: ['user-signup', 'orders-processed', 'payments-charged', 'inventory-updated'],
    members: 2,
    rate: 4,
    failureRate: 0.018,
    maxRetries: 3,
  },
  {
    id: 'notification-service',
    name: 'notification-service',
    description: 'Sends lifecycle email and webhook notifications with retry backoff.',
    subscriptions: ['user-signup', 'orders-processed'],
    members: 2,
    rate: 5,
    failureRate: 0.04,
    maxRetries: 2,
  },
  {
    id: 'fraud-detection',
    name: 'fraud-detection',
    description: 'Scores payment facts and deliberately routes poison events to the DLQ.',
    subscriptions: ['payments-charged'],
    members: 2,
    rate: 6,
    failureRate: 0.035,
    maxRetries: 3,
  },
]

export function uid(prefix = 'id') {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${random}`
}

export function partitionKey(topicId: string, partitionId: number) {
  return `${topicId}:${partitionId}`
}

export function hashKey(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

export function messageSize(value: string, key = '') {
  return new TextEncoder().encode(value).length + new TextEncoder().encode(key).length
}

export function getTopic(state: BrokerState, topicId: string) {
  return state.topics.find((topic) => topic.id === topicId)
}

export function getGroup(state: BrokerState, groupId: string) {
  return state.groups.find((group) => group.id === groupId)
}

export function getPartitionLag(group: ConsumerGroup, topic: Topic, partition: Partition) {
  const committed = group.committed[partitionKey(topic.id, partition.id)] ?? 0
  const firstRetained = partition.log[0]?.offset ?? partition.nextOffset
  return Math.max(0, partition.nextOffset - Math.max(committed, firstRetained))
}

export function getGroupLag(state: BrokerState, group: ConsumerGroup) {
  return state.topics.reduce((total, topic) => {
    if (!group.subscriptions.includes(topic.id)) return total
    return total + topic.partitions.reduce((sum, partition) => sum + getPartitionLag(group, topic, partition), 0)
  }, 0)
}

export function getTopicLag(state: BrokerState, topicId: string) {
  const topic = getTopic(state, topicId)
  if (!topic) return 0
  return state.groups.reduce((sum, group) => {
    if (!group.subscriptions.includes(topicId)) return sum
    return sum + topic.partitions.reduce((inner, partition) => inner + getPartitionLag(group, topic, partition), 0)
  }, 0)
}

export function getTotalLag(state: BrokerState) {
  return state.groups.reduce((sum, group) => sum + getGroupLag(state, group), 0)
}

export function getMemberAssignments(state: BrokerState, group: ConsumerGroup) {
  const assignments: Record<number, string[]> = {}
  for (let i = 0; i < group.members; i += 1) assignments[i] = []
  const partitions = state.topics.flatMap((topic) => group.subscriptions.includes(topic.id)
    ? topic.partitions.map((partition) => ({ topic, partition }))
    : [])
  partitions.forEach(({ topic, partition }, index) => {
    const member = index % Math.max(1, group.members)
    assignments[member]?.push(`${topic.name} · p${partition.id}`)
  })
  return assignments
}

function addActivity(draft: BrokerState, type: ActivityType, message: string, now: number, extra: Partial<Activity> = {}) {
  draft.activity.unshift({ id: uid('log'), type, message, timestamp: now, ...extra })
  if (draft.activity.length > 120) draft.activity.length = 120
}

function makePartition(topicId: string, id: number, nodes: BrokerNode[]): Partition {
  const brokerId = nodes[(id + topicId.length) % nodes.length]?.id ?? `broker-${(id % 3) + 1}`
  const brokerIndex = Math.max(0, nodes.findIndex((node) => node.id === brokerId))
  return {
    id,
    brokerId,
    replicas: [brokerId, nodes[(brokerIndex + 1) % nodes.length]?.id ?? 'broker-2', nodes[(brokerIndex + 2) % nodes.length]?.id ?? 'broker-3'],
    nextOffset: 0,
    log: [],
  }
}

interface AppendOptions {
  animate?: boolean
  log?: boolean
  id?: string
}

function appendMessage(draft: BrokerState, input: PublishInput, now: number, options: AppendOptions = {}) {
  const topic = getTopic(draft, input.topicId)
  if (!topic || topic.partitions.length === 0) return undefined
  const partitionId = input.partitionId !== undefined && topic.partitions.some((partition) => partition.id === input.partitionId)
    ? input.partitionId
    : input.key
      ? hashKey(input.key) % topic.partitions.length
      : topic.roundRobin % topic.partitions.length
  const partition = topic.partitions.find((item) => item.id === partitionId) ?? topic.partitions[0]
  topic.roundRobin = (partition.id + 1) % topic.partitions.length
  const message: EventMessage = {
    id: options.id ?? uid('msg'),
    topicId: topic.id,
    partitionId: partition.id,
    offset: partition.nextOffset,
    key: input.key,
    value: input.value,
    headers: { ...input.headers },
    timestamp: now,
    size: messageSize(input.value, input.key),
    deliveries: {},
  }
  partition.nextOffset += 1
  partition.log.push(message)
  if (partition.log.length > 100) partition.log.splice(0, partition.log.length - 100)
  draft.sequence += 1
  draft.stats.published += 1
  if (options.animate !== false) {
    draft.packets.push({ id: uid('packet'), messageId: message.id, topicId: topic.id, partitionId: partition.id, key: message.key, createdAt: now })
    if (draft.packets.length > 40) draft.packets.splice(0, draft.packets.length - 40)
  }
  if (options.log !== false) {
    addActivity(draft, 'publish', `PUBLISH ${topic.name} · p${partition.id} @ ${message.offset}`, now, {
      topicId: topic.id,
      partitionId: partition.id,
      offset: message.offset,
    })
  }
  return message
}

function templateValue(template: EventTemplate, now: number, sequence: number) {
  return JSON.stringify({
    ...template.value,
    eventId: `evt_live_${sequence.toString(36).padStart(6, '0')}`,
    occurredAt: new Date(now).toISOString(),
  }, null, 2)
}

function automaticInput(draft: BrokerState, now: number): PublishInput | undefined {
  if (!draft.topics.length) return undefined
  const topic = draft.topics[Math.floor(Math.random() * draft.topics.length)]
  const templates = EVENT_TEMPLATES.filter((template) => template.topicId === topic.id)
  const template = templates[Math.floor(Math.random() * Math.max(1, templates.length))]
  if (!template) {
    return {
      topicId: topic.id,
      key: `event_${draft.sequence + 1}`,
      value: JSON.stringify({ eventType: 'GenericEvent', sequence: draft.sequence + 1, emittedAt: new Date(now).toISOString() }),
      headers: { source: 'eventpulse.auto-producer' },
    }
  }
  const key = `${template.key.split('_')[0]}_${Math.random().toString(36).slice(2, 8)}`
  return {
    topicId: topic.id,
    key,
    value: templateValue(template, now, draft.sequence + 1),
    headers: { ...template.headers, source: 'eventpulse.auto-producer' },
  }
}

function makeGroup(blueprint: typeof groupBlueprints[number], now: number): ConsumerGroup {
  return {
    ...blueprint,
    subscriptions: [...blueprint.subscriptions],
    maxMembers: 8,
    generation: 1,
    status: 'active',
    rebalanceTicks: 0,
    committed: {},
    credit: 0,
    cursor: 0,
    consumed: 0,
    failures: 0,
    throughput: 0,
    throughputHistory: [],
    lastRebalance: now,
    memberEpoch: 1,
  }
}

function seedDlq(draft: BrokerState, topicId: string, groupId: string, reason: string, now: number) {
  const topic = getTopic(draft, topicId)
  const group = getGroup(draft, groupId)
  const message = topic?.partitions.flatMap((partition) => partition.log).find((candidate) => {
    const committed = group?.committed[partitionKey(topicId, candidate.partitionId)] ?? 0
    return candidate.offset < committed
  })
  if (!topic || !group || !message) return
  if (message.deliveries[groupId]?.status === 'delivered') {
    group.consumed = Math.max(0, group.consumed - 1)
    draft.stats.consumed = Math.max(0, draft.stats.consumed - 1)
  }
  message.deliveries[groupId] = { attempts: group.maxRetries, status: 'dead', updatedAt: now - 8000, error: reason }
  group.failures += group.maxRetries
  draft.stats.failed += group.maxRetries
  draft.dlq.push({
    id: uid('dlq'),
    message: JSON.parse(JSON.stringify(message)) as EventMessage,
    groupId,
    reason,
    failedAt: now - 8000,
    attempts: group.maxRetries,
    status: 'open',
  })
}

export function createInitialState(): BrokerState {
  const now = Date.now()
  const nodes: BrokerNode[] = [
    { id: 'broker-1', host: '10.0.1.11:9092', rack: 'us-east-1a', status: 'online', load: 38 },
    { id: 'broker-2', host: '10.0.1.12:9092', rack: 'us-east-1b', status: 'online', load: 46 },
    { id: 'broker-3', host: '10.0.1.13:9092', rack: 'us-east-1c', status: 'online', load: 31 },
  ]
  const draft: BrokerState = {
    schema: 1,
    topics: topicBlueprints.map((blueprint) => ({
      ...blueprint,
      partitions: [0, 1, 2].map((id) => makePartition(blueprint.id, id, nodes)),
      roundRobin: 0,
      createdAt: now - 86400000,
    })),
    groups: groupBlueprints.map((blueprint) => makeGroup(blueprint, now)),
    dlq: [],
    activity: [],
    packets: [],
    history: [],
    stats: { published: 0, consumed: 0, failed: 0 },
    settings: { running: true, autoProduce: true, produceRate: 2, tickMs: 700 },
    nodes,
    producerCredit: 0,
    sequence: 0,
    startedAt: now,
    lastTick: now,
  }

  draft.topics.forEach((topic, topicIndex) => {
    const templates = EVENT_TEMPLATES.filter((template) => template.topicId === topic.id)
    for (let i = 0; i < 9; i += 1) {
      const template = templates[i % templates.length]
      appendMessage(draft, {
        topicId: topic.id,
        key: `${template.key}_${i + topicIndex}`,
        value: JSON.stringify({ ...template.value, eventId: `evt_seed_${topicIndex}_${i}`, occurredAt: new Date(now - (9 - i) * 3500).toISOString() }, null, 2),
        headers: { ...template.headers, 'x-cluster-snapshot': 'true' },
      }, now - (9 - i) * 3500, { animate: false, log: false, id: `msg_seed_${topicIndex}_${i}` })
    }
  })

  draft.groups.forEach((group, groupIndex) => {
    draft.topics.forEach((topic) => {
      if (!group.subscriptions.includes(topic.id)) return
      topic.partitions.forEach((partition) => {
        const lag = group.id === 'analytics-worker'
          ? (partition.id === 1 ? 3 : 1)
          : group.id === 'notification-service'
            ? (partition.id === 2 ? 2 : 0)
            : (partition.id + groupIndex) % 2
        const committed = Math.max(0, partition.nextOffset - lag)
        group.committed[partitionKey(topic.id, partition.id)] = committed
        partition.log.forEach((message) => {
          if (message.offset < committed) {
            message.deliveries[group.id] = { attempts: 1, status: 'delivered', updatedAt: now - 4000 }
            group.consumed += 1
            draft.stats.consumed += 1
          }
        })
      })
    })
  })

  seedDlq(draft, 'payments-charged', 'fraud-detection', 'Provider response timed out after 3000ms; retry budget exhausted.', now)
  seedDlq(draft, 'orders-processed', 'notification-service', 'Webhook endpoint returned HTTP 503 for every retry attempt.', now)
  seedDlq(draft, 'user-signup', 'analytics-worker', 'Schema validation failed: missing required property userId.', now)
  addActivity(draft, 'system', 'Cluster snapshot loaded · 3 brokers · 12 partitions · 4 consumer groups', now)
  draft.history = [{ timestamp: now, published: 0, consumed: 0, lag: getTotalLag(draft), dlq: draft.dlq.length }]
  return draft
}

function subscribedPartitions(draft: BrokerState, group: ConsumerGroup) {
  return draft.topics.flatMap((topic) => group.subscriptions.includes(topic.id)
    ? topic.partitions.map((partition) => ({ topic, partition }))
    : [])
}

function failureReason(topic: Topic, group: ConsumerGroup) {
  if (topic.id === 'payments-charged') return `${group.name}: payment provider timeout after 3000ms.`
  if (topic.id === 'user-signup') return `${group.name}: schema registry rejected the event envelope.`
  if (topic.id === 'orders-processed') return `${group.name}: downstream webhook returned HTTP 503.`
  return `${group.name}: downstream dependency unavailable; retry scheduled.`
}

function shouldFail(message: EventMessage, group: ConsumerGroup) {
  if (message.headers['x-simulate-failure']?.toLowerCase() === 'true') return true
  try {
    const parsed = JSON.parse(message.value) as { forceFailure?: boolean }
    if (parsed.forceFailure === true) return true
  } catch {
    return true
  }
  return Math.random() < group.failureRate
}

function processOne(draft: BrokerState, group: ConsumerGroup, topic: Topic, partition: Partition, now: number) {
  const key = partitionKey(topic.id, partition.id)
  let committed = group.committed[key] ?? 0
  const firstRetained = partition.log[0]?.offset ?? partition.nextOffset
  if (committed < firstRetained) {
    committed = firstRetained
    group.committed[key] = committed
  }
  if (committed >= partition.nextOffset) return false
  const message = partition.log.find((candidate) => candidate.offset === committed)
  if (!message) return false
  const previous = message.deliveries[group.id]
  if (previous?.status === 'retrying' && previous.nextAttemptAt && now < previous.nextAttemptAt) return false
  const attempts = (previous?.attempts ?? 0) + 1
  const failed = shouldFail(message, group)
  if (failed) {
    const reason = failureReason(topic, group)
    group.failures += 1
    draft.stats.failed += 1
    if (attempts >= group.maxRetries) {
      message.deliveries[group.id] = { attempts, status: 'dead', updatedAt: now, error: reason }
      group.committed[key] = committed + 1
      const record: DlqRecord = {
        id: uid('dlq'),
        message: JSON.parse(JSON.stringify(message)) as EventMessage,
        groupId: group.id,
        reason,
        failedAt: now,
        attempts,
        status: 'open',
      }
      draft.dlq.unshift(record)
      if (draft.dlq.length > 80) draft.dlq.length = 80
      addActivity(draft, 'dlq', `DLQ ${group.name} · ${topic.name} p${partition.id} @ ${message.offset}`, now, {
        topicId: topic.id,
        partitionId: partition.id,
        offset: message.offset,
        groupId: group.id,
      })
    } else {
      const backoff = Math.min(5000, 600 * 2 ** (attempts - 1))
      message.deliveries[group.id] = { attempts, status: 'retrying', updatedAt: now, nextAttemptAt: now + backoff, error: reason }
      addActivity(draft, 'retry', `RETRY ${group.name} · attempt ${attempts}/${group.maxRetries} · backoff ${backoff}ms · ${topic.name} @ ${message.offset}`, now, {
        topicId: topic.id,
        partitionId: partition.id,
        offset: message.offset,
        groupId: group.id,
      })
    }
    return true
  }
  message.deliveries[group.id] = { attempts, status: 'delivered', updatedAt: now }
  group.committed[key] = committed + 1
  group.consumed += 1
  draft.stats.consumed += 1
  addActivity(draft, 'ack', `ACK ${group.name} · ${topic.name} p${partition.id} @ ${message.offset}`, now, {
    topicId: topic.id,
    partitionId: partition.id,
    offset: message.offset,
    groupId: group.id,
  })
  return true
}

function completeRebalanceIfReady(draft: BrokerState, group: ConsumerGroup, now: number) {
  if (group.status !== 'rebalancing') return false
  group.rebalanceTicks -= 1
  if (group.rebalanceTicks <= 0) {
    group.rebalanceTicks = 0
    group.status = 'active'
    group.credit = 0
    addActivity(draft, 'rebalance', `REBALANCE COMPLETE ${group.name} · generation ${group.generation} · ${group.members} members online`, now, { groupId: group.id })
  }
  return true
}

function tick(state: BrokerState, now: number) {
  if (!state.settings.running) return state
  const draft = structuredClone(state) as BrokerState
  const dt = Math.min(2.5, Math.max(0.1, (now - state.lastTick) / 1000))
  draft.packets = draft.packets.filter((packet) => now - packet.createdAt < 2400)
  draft.topics.forEach((topic) => {
    const cutoff = now - topic.retentionHours * 60 * 60 * 1000
    topic.partitions.forEach((partition) => {
      const before = partition.log.length
      partition.log = partition.log.filter((message) => message.timestamp >= cutoff)
      const expired = before - partition.log.length
      if (expired > 0) addActivity(draft, 'system', `RETENTION ${topic.name} · ${expired} expired records removed from p${partition.id}`, now, { topicId: topic.id, partitionId: partition.id })
    })
  })
  let produced = 0
  let consumed = 0
  if (draft.settings.autoProduce) {
    draft.producerCredit += draft.settings.produceRate * dt
    const count = Math.min(12, Math.floor(draft.producerCredit))
    draft.producerCredit -= count
    for (let i = 0; i < count; i += 1) {
      const input = automaticInput(draft, now)
      if (input && appendMessage(draft, input, now)) produced += 1
    }
  } else {
    draft.producerCredit = 0
  }

  draft.groups.forEach((group) => {
    if (completeRebalanceIfReady(draft, group, now)) {
      group.throughput = Math.max(0, group.throughput * 0.8)
      return
    }
    if (group.status !== 'active') {
      group.throughput = Math.max(0, group.throughput * 0.8)
      return
    }
    group.credit = Math.min(20, group.credit + group.rate * dt)
    let budget = Math.floor(group.credit)
    if (budget <= 0) {
      group.throughput = Math.max(0, group.throughput * 0.8)
      return
    }
    group.credit -= budget
    const partitions = subscribedPartitions(draft, group)
    let groupConsumed = 0
    let progress = true
    while (budget > 0 && progress && partitions.length) {
      progress = false
      for (let i = 0; i < partitions.length && budget > 0; i += 1) {
        const target = partitions[(i + group.cursor) % partitions.length]
        const before = group.consumed
        const attempted = processOne(draft, group, target.topic, target.partition, now)
        if (attempted) {
          budget -= 1
          progress = true
          if (group.consumed > before) {
            groupConsumed += 1
            consumed += 1
          }
        }
      }
      group.cursor = (group.cursor + 1) % Math.max(1, partitions.length)
    }
    group.throughput = Math.round((group.throughput * 0.62 + (groupConsumed / dt) * 0.38) * 10) / 10
  })

  draft.groups.forEach((group) => {
    group.throughputHistory = [...(group.throughputHistory ?? []), group.throughput].slice(-48)
  })

  draft.nodes.forEach((node, index) => {
    const assigned = draft.topics.reduce((sum, topic) => sum + topic.partitions.filter((partition) => partition.brokerId === node.id).length, 0)
    node.load = Math.max(12, Math.min(94, Math.round(assigned * 4 + 18 + ((draft.sequence + index * 7) % 13))))
  })
  draft.history.push({
    timestamp: now,
    published: Math.round((produced / dt) * 10) / 10,
    consumed: Math.round((consumed / dt) * 10) / 10,
    lag: getTotalLag(draft),
    dlq: draft.dlq.filter((record) => record.status === 'open').length,
  })
  if (draft.history.length > 48) draft.history.splice(0, draft.history.length - 48)
  draft.lastTick = now
  return draft
}

function createTopic(draft: BrokerState, input: TopicDraft, now: number) {
  const name = input.name.trim()
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,60}$/.test(name)) return
  if (!name || draft.topics.some((topic) => topic.name === name)) return
  const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`
  const partitionCount = Number.isFinite(input.partitions) ? Math.max(1, Math.min(6, Math.round(input.partitions))) : 3
  const retention = Number.isFinite(input.retentionHours) ? Math.max(1, Math.min(168, Math.round(input.retentionHours))) : 72
  const topic: Topic = {
    id,
    name,
    description: input.description.trim() || 'Custom event stream created in the EventPulse workspace.',
    color: COLORS[draft.topics.length % COLORS.length],
    partitions: Array.from({ length: partitionCount }, (_, index) => makePartition(id, index, draft.nodes)),
    retentionHours: retention,
    roundRobin: 0,
    createdAt: now,
  }
  draft.topics.push(topic)
  addActivity(draft, 'system', `TOPIC CREATED ${topic.name} · ${topic.partitions.length} partitions · RF 3`, now, { topicId: topic.id })
}

export function brokerReducer(state: BrokerState, action: BrokerAction): BrokerState {
  if (action.type === 'RESET') return action.state
  if (action.type === 'SET_SETTINGS') return { ...state, settings: { ...state.settings, ...action.patch } }
  if (action.type === 'CLEAR_ACTIVITY') return { ...state, activity: [] }
  const draft = structuredClone(state) as BrokerState
  const now = 'now' in action ? action.now : Date.now()
  switch (action.type) {
    case 'TICK':
      return tick(state, now)
    case 'PUBLISH':
      appendMessage(draft, action.input, now, { id: action.id })
      draft.lastTick = now
      return draft
    case 'PURGE_TOPIC': {
      const topic = getTopic(draft, action.topicId)
      if (!topic) return state
      const removed = topic.partitions.reduce((sum, partition) => sum + partition.log.length, 0)
      topic.partitions.forEach((partition) => { partition.log = [] })
      draft.groups.forEach((group) => {
        if (!group.subscriptions.includes(topic.id)) return
        topic.partitions.forEach((partition) => { group.committed[partitionKey(topic.id, partition.id)] = partition.nextOffset })
      })
      draft.packets = draft.packets.filter((packet) => packet.topicId !== topic.id)
      addActivity(draft, 'purge', `PURGE ${topic.name} · ${removed} retained messages cleared · offsets preserved`, now, { topicId: topic.id })
      return draft
    }
    case 'CONFIGURE_TOPIC': {
      const topic = getTopic(draft, action.topicId)
      if (!topic) return state
      const count = Number.isFinite(action.partitions) ? Math.max(1, Math.min(6, Math.round(action.partitions))) : topic.partitions.length
      const oldCount = topic.partitions.length
      if (count > oldCount) {
        for (let i = oldCount; i < count; i += 1) topic.partitions.push(makePartition(topic.id, i, draft.nodes))
      } else if (count < oldCount) {
        const removed = topic.partitions.slice(count)
        topic.partitions = topic.partitions.slice(0, count)
        draft.groups.forEach((group) => removed.forEach((partition) => { delete group.committed[partitionKey(topic.id, partition.id)] }))
        draft.packets = draft.packets.filter((packet) => !(packet.topicId === topic.id && packet.partitionId >= count))
      }
      topic.retentionHours = Number.isFinite(action.retentionHours) ? Math.max(1, Math.min(168, Math.round(action.retentionHours))) : topic.retentionHours
      if (count !== oldCount) {
        draft.groups.forEach((group) => {
          if (!group.subscriptions.includes(topic.id)) return
          group.generation += 1
          group.status = 'rebalancing'
          group.rebalanceTicks = 2
          group.lastRebalance = now
        })
      }
      addActivity(draft, 'system', `TOPIC CONFIG ${topic.name} · ${oldCount} → ${count} partitions · retention ${topic.retentionHours}h`, now, { topicId: topic.id })
      return draft
    }
    case 'CREATE_TOPIC':
      createTopic(draft, action.draft, now)
      return draft
    case 'SET_GROUP': {
      const group = getGroup(draft, action.groupId)
      if (!group) return state
      const oldMembers = group.members
      const oldSubscriptions = [...group.subscriptions]
      Object.assign(group, action.patch)
      group.subscriptions = group.subscriptions.filter((topicId) => draft.topics.some((topic) => topic.id === topicId))
      group.members = Math.max(1, Math.min(group.maxMembers, Math.round(group.members)))
      group.rate = Math.max(0.5, Math.min(40, group.rate))
      group.failureRate = Math.max(0, Math.min(0.5, group.failureRate))
      group.maxRetries = Math.max(1, Math.min(8, Math.round(group.maxRetries)))
      const subscriptionsChanged = oldSubscriptions.join('|') !== group.subscriptions.join('|')
      if (subscriptionsChanged) {
        draft.topics.filter((topic) => !group.subscriptions.includes(topic.id)).forEach((topic) => topic.partitions.forEach((partition) => { delete group.committed[partitionKey(topic.id, partition.id)] }))
      }
      if (oldMembers !== group.members || subscriptionsChanged) {
        group.generation += 1
        group.memberEpoch += 1
        group.status = 'rebalancing'
        group.rebalanceTicks = 2
        group.lastRebalance = now
        addActivity(draft, 'rebalance', subscriptionsChanged
          ? `SUBSCRIPTION CHANGE ${group.name} · ${group.subscriptions.length} topics · rebalance started`
          : `MEMBERSHIP CHANGE ${group.name} · ${oldMembers} → ${group.members} members · rebalance started`, now, { groupId: group.id })
      } else if (action.patch.status) {
        addActivity(draft, 'system', `${action.patch.status === 'paused' ? 'PAUSE' : 'RESUME'} ${group.name} · offset commits ${action.patch.status === 'paused' ? 'held' : 'enabled'}`, now, { groupId: group.id })
      }
      return draft
    }
    case 'REBALANCE': {
      const group = getGroup(draft, action.groupId)
      if (!group) return state
      group.generation += 1
      group.memberEpoch += 1
      group.status = 'rebalancing'
      group.rebalanceTicks = action.mode === 'failover' ? 4 : 3
      group.lastRebalance = now
      addActivity(draft, 'rebalance', action.mode === 'failover'
        ? `FAILOVER DRILL ${group.name} · member heartbeat lost · assignments frozen for recovery`
        : `REBALANCE ${group.name} · generation ${group.generation} · cooperative assignment started`, now, { groupId: group.id })
      return draft
    }
    case 'RESOLVE_DLQ': {
      const selected = new Set(action.ids)
      const records = draft.dlq.filter((record) => selected.has(record.id) && record.status === 'open')
      records.forEach((record) => {
        if (action.mode === 'replay') {
          const original = record.message
          const replay = appendMessage(draft, {
            topicId: original.topicId,
            key: original.key,
            value: original.value,
            partitionId: original.partitionId,
            headers: {
              ...original.headers,
              'x-dlq-replay': 'true',
              'x-original-dlq-id': record.id,
              'x-original-offset': String(original.offset),
            },
          }, now)
          record.status = 'replayed'
          record.resolvedAt = now
          record.replayedMessageId = replay?.id
          addActivity(draft, 'system', `DLQ REPLAY ${record.id} → ${original.topicId} · original offset ${original.offset}`, now, { topicId: original.topicId, groupId: record.groupId })
        } else {
          record.status = 'discarded'
          record.resolvedAt = now
          addActivity(draft, 'system', `DLQ DISCARD ${record.id} · operator acknowledged ${record.reason}`, now, { topicId: record.message.topicId, groupId: record.groupId })
        }
      })
      return draft
    }
    default:
      return state
  }
}

export function formatCompact(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return String(Math.round(value))
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(timestamp)
}

export function topicForMessage(state: BrokerState, message: EventMessage) {
  return getTopic(state, message.topicId)
}

export function allMessages(state: BrokerState) {
  return state.topics.flatMap((topic) => topic.partitions.flatMap((partition) => partition.log))
}
