import { useMemo, useState, type CSSProperties } from 'react'
import { AlertTriangle, ArrowDown, ArrowRight, Braces, CheckCircle2, ChevronDown, CirclePlus, Clock3, Code2, FileJson, Gauge, Hash, Layers3, Send, Server, Settings2, Sparkles, UsersRound, X } from 'lucide-react'
import type { BrokerController } from '../hooks/useBroker'
import { EVENT_TEMPLATES, allMessages, formatBytes, formatCompact, formatTime, getTopicLag, hashKey } from '../lib/broker'
import type { EventMessage } from '../types'
import { cn } from '../utils/cn'
import { Badge, CopyButton, FieldLabel, MetricCard, Panel, SectionHeading, StatusDot, Toggle } from './Shared'

interface Props {
  broker: BrokerController
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

type HeaderRow = { id: number; key: string; value: string }

const logColors = { publish: '#8b5cf6', ack: '#10b981', retry: '#f59e0b', dlq: '#f43f5e', system: '#38bdf8', rebalance: '#f59e0b', purge: '#f43f5e' }

function rowsFor(headers: Record<string, string>): HeaderRow[] {
  return Object.entries(headers).map(([key, value], index) => ({ id: Date.now() + index, key, value }))
}

export default function EventProducer({ broker, onToast }: Props) {
  const { state } = broker
  const firstTemplate = EVENT_TEMPLATES[0]
  const [topicId, setTopicId] = useState(firstTemplate.topicId)
  const [partition, setPartition] = useState('auto')
  const [eventKey, setEventKey] = useState(firstTemplate.key)
  const [payload, setPayload] = useState(JSON.stringify(firstTemplate.value, null, 2))
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(rowsFor(firstTemplate.headers))
  const [burst, setBurst] = useState(1)
  const [lastPublished, setLastPublished] = useState<string | null>(null)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const topic = state.topics.find((item) => item.id === topicId) ?? state.topics[0]
  const templates = EVENT_TEMPLATES.filter((template) => template.topicId === topic?.id)
  const validation = useMemo(() => {
    try {
      const parsed = JSON.parse(payload)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { valid: false, error: 'Payload must be a JSON object, not an array or primitive.' }
      return { valid: true, error: '' }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Invalid JSON payload.' }
    }
  }, [payload])
  const headers = useMemo(() => Object.fromEntries(headerRows.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value])), [headerRows])
  const previewPartition = topic ? partition === 'auto'
    ? eventKey ? hashKey(eventKey) % topic.partitions.length : topic.roundRobin % topic.partitions.length
    : Number(partition) : 0
  const topicMessages = useMemo(() => topic ? allMessages(state).filter((message) => message.topicId === topic.id).sort((a, b) => b.timestamp - a.timestamp || b.offset - a.offset) : [], [state, topic])
  const topicLogs = state.activity.filter((item) => item.topicId === topic?.id || (!item.topicId && item.type === 'system'))
  const visibleLogs = showAllLogs ? topicLogs : topicLogs.slice(0, 9)
  const topicPackets = state.packets.filter((packet) => packet.topicId === topic?.id)
  const subscribedGroups = state.groups.filter((group) => group.subscriptions.includes(topic?.id ?? ''))

  const loadTemplate = (templateId: string) => {
    const template = EVENT_TEMPLATES.find((item) => item.id === templateId)
    if (!template) return
    setTopicId(template.topicId)
    setEventKey(template.key)
    setPayload(JSON.stringify(template.value, null, 2))
    setHeaderRows(rowsFor(template.headers))
    setPartition('auto')
  }

  const changeTopic = (nextTopic: string) => {
    setTopicId(nextTopic)
    const nextTemplate = EVENT_TEMPLATES.find((template) => template.topicId === nextTopic)
    if (nextTemplate) {
      setEventKey(nextTemplate.key)
      setPayload(JSON.stringify(nextTemplate.value, null, 2))
      setHeaderRows(rowsFor(nextTemplate.headers))
    } else {
      setEventKey(`event_${Date.now().toString(36)}`)
      setPayload(JSON.stringify({ eventType: 'CustomEvent', emittedAt: new Date().toISOString(), data: {} }, null, 2))
      setHeaderRows(rowsFor({ source: 'eventpulse.producer', 'content-type': 'application/json' }))
    }
    setPartition('auto')
  }

  const publishRouted = () => {
    if (!topic) return
    if (!validation.valid) { onToast(validation.error, 'error'); return }
    const count = Math.max(1, Math.min(20, burst))
    for (let index = 0; index < count; index += 1) {
      const id = broker.publish({
        topicId: topic.id,
        key: eventKey.trim(),
        value: payload,
        headers: { ...headers, ...(count > 1 ? { 'x-burst-index': String(index + 1) } : {}) },
        partitionId: partition === 'auto' ? undefined : Number(partition),
      })
      setLastPublished(id)
    }
    onToast(`${count > 1 ? `${count} events` : 'Event'} published to ${topic.name} · P${previewPartition}`, 'success')
  }

  const updateHeader = (id: number, field: 'key' | 'value', value: string) => setHeaderRows((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row))
  const addHeader = () => setHeaderRows((rows) => [...rows, { id: Date.now(), key: '', value: '' }])
  const removeHeader = (id: number) => setHeaderRows((rows) => rows.filter((row) => row.id !== id))
  const setFailureInjection = (enabled: boolean) => {
    setHeaderRows((rows) => {
      const without = rows.filter((row) => row.key !== 'x-simulate-failure')
      return enabled ? [...without, { id: Date.now(), key: 'x-simulate-failure', value: 'true' }] : without
    })
  }
  const failureInjected = headers['x-simulate-failure'] === 'true'

  if (!topic) return null

  return (
    <div className="view-enter space-y-5">
      <SectionHeading eyebrow="02 / event ingress" title="Producer stream & payload studio" description="Compose a real event, choose its routing lane, and watch independent consumer acknowledgements arrive as the broker advances offsets." actions={<Badge tone={state.settings.autoProduce ? 'violet' : 'neutral'}><Sparkles size={11} />{state.settings.autoProduce ? `Auto producer · ${state.settings.produceRate}/s` : 'Manual producer'}</Badge>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events published" value={formatCompact(state.stats.published)} detail="Since cluster snapshot" icon={Send} accent="#8b5cf6" spark={state.history.map((point) => point.published)} />
        <MetricCard label="Consumed / sec" value={state.history[state.history.length - 1]?.consumed.toFixed(1) ?? '0.0'} detail={`${formatCompact(state.stats.consumed)} total acknowledgements`} icon={CheckCircle2} accent="#10b981" spark={state.history.map((point) => point.consumed)} />
        <MetricCard label="Selected topic lag" value={getTopicLag(state, topic.id)} detail={`${subscribedGroups.length} subscribed groups · ${topic.partitions.length} lanes`} icon={Gauge} accent="#f59e0b" />
        <MetricCard label="Payload size" value={formatBytes(new TextEncoder().encode(payload).length + new TextEncoder().encode(eventKey).length)} detail={validation.valid ? 'Valid JSON object' : 'Fix payload before publish'} icon={FileJson} accent={validation.valid ? '#38bdf8' : '#f43f5e'} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(350px,.88fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2"><Code2 size={16} className="text-violet-400" /><div><div className="text-sm font-medium text-slate-200">Payload studio</div><div className="mt-0.5 font-mono text-[10px] text-slate-600">application/json · UTF-8</div></div></div><CopyButton value={payload} label="Copy JSON" /></div>
          <div className="border-b border-slate-800/70 px-4 py-3 sm:px-5"><div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-600"><Layers3 size={12} />Start from an authored event</div><div className="flex flex-wrap gap-2">{templates.map((template) => <button type="button" key={template.id} className="template-chip" onClick={() => loadTemplate(template.id)} title={template.description}><Braces size={12} />{template.label}</button>)}</div></div>
          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[1.4fr_.8fr]"><div><FieldLabel>Destination topic</FieldLabel><div className="relative"><select className="input appearance-none pr-9 font-mono text-xs" value={topic.id} onChange={(event) => changeTopic(event.target.value)}>{state.topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3.5 text-slate-500" /></div></div><div><FieldLabel hint="key hash by default">Partition route</FieldLabel><div className="relative"><select className="input appearance-none pr-9 font-mono text-xs" value={partition} onChange={(event) => setPartition(event.target.value)}><option value="auto">Auto · hash / round-robin</option>{topic.partitions.map((item) => <option key={item.id} value={item.id}>Partition {item.id}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3.5 text-slate-500" /></div></div></div>
            <div><FieldLabel hint="empty key → round robin">Event key</FieldLabel><div className="relative"><Hash size={14} className="pointer-events-none absolute left-3 top-3.5 text-slate-600" /><input className="input pl-9 font-mono text-xs" value={eventKey} onChange={(event) => setEventKey(event.target.value)} placeholder="user_123 or order_456" /></div></div>
            <div><div className="mb-2 flex items-center justify-between"><FieldLabel>JSON value</FieldLabel><span className={cn('flex items-center gap-1.5 font-mono text-[10px]', validation.valid ? 'text-emerald-400' : 'text-rose-400')}>{validation.valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}{validation.valid ? 'VALID' : 'INVALID'}</span></div><textarea spellCheck={false} className={cn('code-editor', !validation.valid && 'code-editor-invalid')} value={payload} onChange={(event) => setPayload(event.target.value)} aria-label="JSON event payload" />{!validation.valid && <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-rose-400"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{validation.error}</p>}</div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-3.5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-medium text-slate-300"><Settings2 size={13} className="text-slate-500" />Event headers</div><button type="button" className="icon-text-button" onClick={addHeader}><CirclePlus size={13} />Add header</button></div><div className="space-y-2">{headerRows.map((row) => <div key={row.id} className="flex items-center gap-2"><input className="input h-9 min-w-0 flex-1 font-mono text-[11px]" placeholder="header-name" value={row.key} onChange={(event) => updateHeader(row.id, 'key', event.target.value)} /><span className="text-slate-700">:</span><input className="input h-9 min-w-0 flex-1 font-mono text-[11px]" placeholder="value" value={row.value} onChange={(event) => updateHeader(row.id, 'value', event.target.value)} /><button type="button" className="icon-button h-8 w-8 shrink-0" onClick={() => removeHeader(row.id)} aria-label={`Remove ${row.key || 'header'}`}><X size={13} /></button></div>)}{!headerRows.length && <p className="py-1 text-xs text-slate-600">No custom headers. Add trace, schema, or idempotency metadata.</p>}</div><div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3"><div><div className="flex items-center gap-1.5 text-[11px] text-amber-300/90"><AlertTriangle size={12} />Failure injection</div><div className="mt-1 text-[10px] text-slate-600">Force retries, then route to DLQ.</div></div><Toggle label="Inject consumer failure" checked={failureInjected} onChange={setFailureInjection} /></div></div>
            <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-[10px] text-slate-600"><span className="font-mono">{formatBytes(new TextEncoder().encode(payload).length)}</span><span>·</span><span>route P{previewPartition}</span>{lastPublished && <span className="hidden truncate font-mono text-violet-400/70 md:inline">· {lastPublished}</span>}</div><div className="flex items-center gap-2"><select className="input h-10 w-[76px] px-2 font-mono text-xs" aria-label="Burst count" value={burst} onChange={(event) => setBurst(Number(event.target.value))}>{[1, 3, 5, 10, 20].map((count) => <option key={count} value={count}>×{count}</option>)}</select><button type="button" className="button button-primary min-w-[148px] justify-center" onClick={publishRouted} disabled={!validation.valid}><Send size={14} />Publish Event</button></div></div>
          </div>
        </Panel>

        <div className="min-w-0 space-y-5">
          <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3.5"><div className="flex items-center gap-2 text-sm font-medium text-slate-200"><GitRouteIcon />Route preview</div><Badge tone="violet">P{previewPartition}</Badge></div><div className="p-4 sm:p-5"><div className="route-preview"><div className="route-preview-node"><div className="route-preview-icon violet"><Send size={15} /></div><div><div className="text-[10px] uppercase tracking-[0.13em] text-slate-600">Producer</div><div className="mt-1 font-mono text-[11px] text-slate-300">payload-studio</div></div></div><div className="route-preview-connector"><span /><ArrowDown size={13} /></div><div className="route-preview-node"><div className="route-preview-icon" style={{ color: topic.color, backgroundColor: `${topic.color}12`, borderColor: `${topic.color}35` }}><Layers3 size={15} /></div><div className="min-w-0"><div className="text-[10px] uppercase tracking-[0.13em] text-slate-600">Topic</div><div className="mt-1 truncate font-mono text-[11px] text-slate-300">{topic.name}</div></div><span className="ml-auto font-mono text-[10px] text-slate-600">{topic.partitions.length} lanes</span></div><div className="route-preview-connector"><span /><ArrowDown size={13} /></div><div className="partition-route-large"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.13em] text-slate-600">Partition routing</span><span className="font-mono text-[10px] text-slate-500">hash({eventKey || '∅'}) % {topic.partitions.length}</span></div><div className="grid grid-cols-3 gap-2">{topic.partitions.map((item) => <div key={item.id} className={cn('route-partition', item.id === previewPartition && 'route-partition-active')} style={{ '--topic-color': topic.color } as CSSProperties}><span className="font-mono text-[11px]">P{item.id}</span><span className="mt-1 block font-mono text-[9px] text-slate-600">{item.brokerId.replace('broker-', 'B')}</span>{topicPackets.filter((packet) => packet.partitionId === item.id).map((packet) => <span key={packet.id} className="route-packet" />)}</div>)}</div></div><div className="route-preview-connector"><span /><ArrowDown size={13} /></div><div className="route-preview-node"><div className="route-preview-icon emerald"><UsersRound size={15} /></div><div><div className="text-[10px] uppercase tracking-[0.13em] text-slate-600">Subscribers</div><div className="mt-1 font-mono text-[11px] text-slate-300">{subscribedGroups.length} consumer groups</div></div><span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400"><StatusDot pulse />ack async</span></div></div></div></Panel>

          <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3.5"><div className="flex items-center gap-2 text-sm font-medium text-slate-200"><CheckCircle2 size={14} className="text-emerald-400" />Delivery confirmations</div><span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600"><StatusDot pulse={state.settings.running} />LIVE LOG</span></div><div className="max-h-[330px] divide-y divide-slate-800/60 overflow-y-auto">{visibleLogs.map((item) => <div key={item.id} className="flex gap-2.5 px-4 py-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: logColors[item.type] }} /><div className="min-w-0 flex-1"><p className="break-words font-mono text-[10px] leading-5 text-slate-400">{item.message}</p><div className="mt-0.5 font-mono text-[9px] text-slate-700">{formatTime(item.timestamp)}{item.groupId && ` · ${item.groupId}`}</div></div></div>)}{!visibleLogs.length && <div className="px-4 py-8 text-center text-xs text-slate-600">Publish an event to open a confirmation stream.</div>}</div>{topicLogs.length > 9 && <button type="button" className="w-full border-t border-slate-800/70 py-2.5 text-[10px] text-slate-500 transition hover:bg-slate-800/30 hover:text-slate-300" onClick={() => setShowAllLogs(!showAllLogs)}>{showAllLogs ? 'Show latest only' : `Show all ${topicLogs.length} events`}</button>}</Panel>
        </div>
      </div>

      <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3.5 sm:px-5"><div><div className="eyebrow">Producer auto-pilot</div><h3 className="mt-1 text-sm font-medium text-slate-200">Keep the cluster under realistic flow</h3></div><div className="flex items-center gap-3"><span className="font-mono text-xs text-violet-300">{state.settings.produceRate.toFixed(1)} msg/s</span><Toggle label="Enable automatic event production" checked={state.settings.autoProduce} onChange={(checked) => broker.setSettings({ autoProduce: checked })} /></div></div><div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_1.2fr]"><div><div className="mb-2 flex items-center justify-between text-xs text-slate-400"><span>Automatic publish rate</span><span className="font-mono text-[10px] text-slate-600">0.5 — 12 msg/s</span></div><input className="range-input" type="range" min="0.5" max="12" step="0.5" value={state.settings.produceRate} onChange={(event) => broker.setSettings({ produceRate: Number(event.target.value) })} /><div className="mt-2 flex justify-between font-mono text-[9px] text-slate-700"><span>quiet</span><span>burst</span></div><p className="mt-3 text-xs leading-5 text-slate-500">The auto-producer selects authored event shapes, hashes keys into real partitions, and respects the same retry and lag rules as manual publishes.</p></div><div className="grid grid-cols-3 gap-2">{subscribedGroups.map((group) => <div key={group.id} className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-3"><div className="flex items-center gap-1.5"><StatusDot color={group.status === 'active' ? '#10b981' : '#f59e0b'} /><span className="truncate font-mono text-[10px] text-slate-300">{group.name}</span></div><div className="mt-3 font-mono text-lg text-slate-200">{group.throughput.toFixed(1)}</div><div className="text-[9px] uppercase tracking-wider text-slate-600">ack / sec</div></div>)}</div></div></Panel>

      <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2 text-sm font-medium text-slate-200"><Clock3 size={14} className="text-violet-400" />Recently published to {topic.name}</div><span className="font-mono text-[10px] text-slate-600">newest first</span></div><div className="overflow-x-auto"><table className="data-table min-w-[700px]"><thead><tr><th>Offset</th><th>Key</th><th>Partition</th><th>Size</th><th>Delivery</th><th>Published</th></tr></thead><tbody>{topicMessages.slice(0, 8).map((message) => <ProducerMessageRow key={message.id} message={message} broker={broker} />)}</tbody></table>{!topicMessages.length && <div className="p-8 text-center text-xs text-slate-600">No retained events for this topic.</div>}</div></Panel>
    </div>
  )
}

function ProducerMessageRow({ message, broker }: { message: EventMessage; broker: BrokerController }) {
  const groups = broker.state.groups.filter((group) => group.subscriptions.includes(message.topicId))
  const delivered = groups.filter((group) => message.deliveries[group.id]?.status === 'delivered' || (group.committed[`${message.topicId}:${message.partitionId}`] ?? 0) > message.offset).length
  const dead = groups.filter((group) => message.deliveries[group.id]?.status === 'dead').length
  return <tr><td className="font-mono text-xs text-violet-300">@{String(message.offset).padStart(4, '0')}</td><td className="max-w-[230px] truncate font-mono text-[11px] text-slate-300">{message.key || '(unkeyed)'}</td><td className="font-mono text-xs text-slate-400">P{message.partitionId}</td><td className="font-mono text-[11px] text-slate-500">{formatBytes(message.size)}</td><td><div className="flex items-center gap-2"><span className={cn('font-mono text-[11px]', dead ? 'text-rose-400' : delivered === groups.length ? 'text-emerald-400' : 'text-amber-400')}>{dead ? `${dead} DLQ` : `${delivered}/${groups.length} ACK`}</span>{message.deliveries && Object.values(message.deliveries).some((delivery) => delivery.status === 'retrying') && <span className="text-[10px] text-amber-500">retrying</span>}</div></td><td className="font-mono text-[11px] text-slate-600">{formatTime(message.timestamp)}</td></tr>
}

function GitRouteIcon() {
  return <span className="flex items-center gap-1 text-violet-400"><Server size={14} /><ArrowRight size={12} /></span>
}
