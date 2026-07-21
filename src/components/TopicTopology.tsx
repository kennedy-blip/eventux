import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Activity, ArrowRight, Box, ChevronRight, Clock3, Database, GitBranch, Layers3, Plus, Server, Settings2, ShieldCheck } from 'lucide-react'
import type { BrokerController } from '../hooks/useBroker'
import { allMessages, formatCompact, formatTime, getGroupLag, getPartitionLag, getTopicLag, getTotalLag } from '../lib/broker'
import type { EventMessage, Topic } from '../types'
import { cn } from '../utils/cn'
import { Badge, CopyButton, Drawer, EmptyState, FieldLabel, JsonBlock, MetricCard, Modal, Panel, ProgressBar, SectionHeading, StatusDot } from './Shared'

interface Props {
  broker: BrokerController
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

const activityColors = { publish: '#8b5cf6', ack: '#10b981', retry: '#f59e0b', dlq: '#f43f5e', system: '#38bdf8', rebalance: '#f59e0b', purge: '#f43f5e' }

export default function TopicTopology({ broker, onToast }: Props) {
  const { state } = broker
  const [selectedTopicId, setSelectedTopicId] = useState(state.topics[0]?.id ?? '')
  const [configTopic, setConfigTopic] = useState<Topic | null>(null)
  const [configPartitions, setConfigPartitions] = useState(3)
  const [configRetention, setConfigRetention] = useState(72)
  const [newTopicOpen, setNewTopicOpen] = useState(false)
  const [newTopic, setNewTopic] = useState({ name: '', description: '', partitions: 3, retentionHours: 72 })
  const [newTopicError, setNewTopicError] = useState('')
  const [messageId, setMessageId] = useState<string | null>(null)
  const selectedTopic = state.topics.find((topic) => topic.id === selectedTopicId) ?? state.topics[0]
  const selectedMessage = useMemo(() => allMessages(state).find((message) => message.id === messageId) ?? null, [state, messageId])
  const selectedMessages = selectedTopic?.partitions.flatMap((partition) => partition.log).sort((a, b) => b.timestamp - a.timestamp) ?? []
  const subscribedGroups = selectedTopic ? state.groups.filter((group) => group.subscriptions.includes(selectedTopic.id)) : []

  useEffect(() => {
    if (!state.topics.some((topic) => topic.id === selectedTopicId)) setSelectedTopicId(state.topics[0]?.id ?? '')
  }, [state.topics, selectedTopicId])

  useEffect(() => {
    if (configTopic) {
      setConfigPartitions(configTopic.partitions.length)
      setConfigRetention(configTopic.retentionHours)
    }
  }, [configTopic])

  const openConfig = (topic: Topic) => setConfigTopic(topic)
  const saveConfig = () => {
    if (!configTopic) return
    broker.configureTopic(configTopic.id, configPartitions, configRetention)
    onToast(`${configTopic.name} configuration applied`, 'success')
    setConfigTopic(null)
  }
  const createTopic = () => {
    const name = newTopic.name.trim()
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,60}$/.test(name)) {
      setNewTopicError('Use 3–61 characters: letters, numbers, dots, dashes, or underscores.')
      return
    }
    if (state.topics.some((topic) => topic.name === name)) {
      setNewTopicError('That topic name already exists in this cluster.')
      return
    }
    broker.createTopic({ ...newTopic, name })
    onToast(`${name} created with ${newTopic.partitions} partitions`, 'success')
    setNewTopic({ name: '', description: '', partitions: 3, retentionHours: 72 })
    setNewTopicError('')
    setNewTopicOpen(false)
  }

  if (!selectedTopic) return <EmptyState icon={Layers3} title="No topics in this cluster" description="Create a topic to start routing events through the broker graph." action={<button className="button button-primary" onClick={() => setNewTopicOpen(true)}><Plus size={14} />Create topic</button>} />

  return (
    <div className="view-enter space-y-5">
      <SectionHeading
        eyebrow="01 / cluster map"
        title="Topic & partition topology"
        description="Trace an event from its topic boundary to a leader broker, then watch each consumer group commit independently."
        actions={<><button type="button" className="button button-secondary" onClick={() => setNewTopicOpen(true)}><Plus size={14} />New topic</button><Badge tone="emerald"><StatusDot pulse />{state.settings.running ? 'Streaming' : 'Stream paused'}</Badge></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cluster partitions" value={state.topics.reduce((sum, topic) => sum + topic.partitions.length, 0)} detail={`${state.topics.length} topics · replication factor 3`} icon={GitBranch} accent="#8b5cf6" />
        <MetricCard label="Retained messages" value={formatCompact(allMessages(state).length)} detail="Across active partition logs" icon={Database} accent="#38bdf8" />
        <MetricCard label="Total consumer lag" value={formatCompact(getTotalLag(state))} detail={getTotalLag(state) > 12 ? 'Consumers are catching up' : 'Within operating threshold'} icon={Activity} accent="#f59e0b" spark={state.history.map((point) => point.lag)} />
        <MetricCard label="Open DLQ records" value={state.dlq.filter((record) => record.status === 'open').length} detail="Retry budgets exhausted" icon={ShieldCheck} accent="#f43f5e" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[286px_minmax(0,1fr)]">
        <Panel className="h-fit overflow-hidden xl:sticky xl:top-[164px]">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3.5"><div><div className="eyebrow">Streams</div><div className="mt-1 text-sm font-medium text-slate-200">Topic registry</div></div><span className="font-mono text-xs text-slate-600">{String(state.topics.length).padStart(2, '0')}</span></div>
          <div className="space-y-1 p-2">
            {state.topics.map((topic) => {
              const messages = topic.partitions.reduce((sum, partition) => sum + partition.log.length, 0)
              const lag = getTopicLag(state, topic.id)
              const active = topic.id === selectedTopic.id
              return <button type="button" key={topic.id} onClick={() => setSelectedTopicId(topic.id)} className={cn('topic-list-item', active && 'topic-list-item-active')} style={{ '--topic-color': topic.color } as CSSProperties}>
                <span className="topic-list-accent" />
                <span className="min-w-0 flex-1 text-left"><span className="block truncate font-mono text-[12px] text-slate-200">{topic.name}</span><span className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500"><span>{topic.partitions.length} partitions</span><span className="text-slate-700">·</span><span>{messages} retained</span></span></span>
                <span className="flex shrink-0 flex-col items-end gap-1"><ChevronRight size={14} className={active ? 'text-violet-400' : 'text-slate-700'} />{lag > 0 && <span className="font-mono text-[10px] text-amber-400">{lag} lag</span>}</span>
              </button>
            })}
          </div>
          <div className="border-t border-slate-800/80 p-3"><button type="button" className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700/80 py-2.5 text-xs text-slate-500 transition hover:border-violet-500/50 hover:text-violet-300" onClick={() => setNewTopicOpen(true)}><Plus size={14} />Register a topic</button></div>
        </Panel>

        <div className="min-w-0 space-y-5">
          <Panel className="overflow-hidden">
            <div className="topic-detail-header">
              <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="topic-signal" style={{ backgroundColor: selectedTopic.color, boxShadow: `0 0 16px ${selectedTopic.color}99` }} /><span className="eyebrow">Topic selected</span><Badge tone="neutral">RF 3</Badge></div><h3 className="truncate font-mono text-lg font-medium tracking-[-0.04em] text-slate-100 sm:text-xl">{selectedTopic.name}</h3><p className="mt-1.5 text-xs leading-5 text-slate-500">{selectedTopic.description}</p></div>
              <button type="button" className="button button-secondary shrink-0" onClick={() => openConfig(selectedTopic)}><Settings2 size={14} />Configure</button>
            </div>
            <div className="grid grid-cols-2 border-y border-slate-800/80 bg-slate-950/20 sm:grid-cols-4">
              <div className="topic-stat"><span>Next offset</span><strong>{formatCompact(Math.max(...selectedTopic.partitions.map((partition) => partition.nextOffset), 0))}</strong></div>
              <div className="topic-stat"><span>Retention</span><strong>{selectedTopic.retentionHours}<small>h</small></strong></div>
              <div className="topic-stat"><span>Consumer groups</span><strong>{subscribedGroups.length}</strong></div>
              <div className="topic-stat"><span>Aggregate lag</span><strong className={getTopicLag(state, selectedTopic.id) ? 'text-amber-400' : 'text-emerald-400'}>{getTopicLag(state, selectedTopic.id)}</strong></div>
            </div>
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-medium text-slate-300"><GitBranch size={14} className="text-violet-400" />Live broker graph</div><span className="font-mono text-[10px] text-slate-600">key hash → partition → leader</span></div>
              <div className="grid gap-3 lg:grid-cols-3">
                {selectedTopic.partitions.map((partition) => {
                  const packets = state.packets.filter((packet) => packet.topicId === selectedTopic.id && packet.partitionId === partition.id)
                  const lag = subscribedGroups.reduce((sum, group) => sum + getPartitionLag(group, selectedTopic, partition), 0)
                  const latest = partition.log[partition.log.length - 1]
                  return <article key={partition.id} className="partition-card" style={{ '--topic-color': selectedTopic.color } as CSSProperties}>
                    <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><span className="partition-number">P{partition.id}</span><span className="font-mono text-[11px] text-slate-400">Partition {partition.id}</span></div><span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400"><StatusDot />leader</span></div>
                    <div className="mt-4 flex items-end justify-between"><div><div className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Next offset</div><div className="mt-1 font-mono text-2xl tracking-[-0.07em] text-slate-100">{String(partition.nextOffset).padStart(4, '0')}</div></div><div className="text-right"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Lag</div><div className={cn('mt-1 font-mono text-sm', lag ? 'text-amber-400' : 'text-emerald-400')}>{lag}</div></div></div>
                    <div className="partition-route mt-4"><span className="route-node">PROD</span><span className="route-line" />{packets.map((packet, index) => <span key={packet.id} className="message-packet" style={{ animationDelay: `${index * 90}ms` }} />)}<span className="route-node route-broker"><Server size={11} />{partition.brokerId.replace('broker-', 'B')}</span></div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3 text-[10px] text-slate-500"><span className="font-mono">{partition.brokerId}</span><span className="font-mono">replicas [{partition.replicas.map((replica) => replica.replace('broker-', '')).join(', ')}]</span></div>
                    {latest && <button type="button" onClick={() => setMessageId(latest.id)} className="mt-3 flex w-full items-center justify-between rounded-lg bg-slate-950/40 px-2.5 py-2 text-left transition hover:bg-slate-800/60"><span className="min-w-0"><span className="block font-mono text-[10px] text-slate-500">latest @{latest.offset}</span><span className="mt-0.5 block truncate font-mono text-[10px] text-slate-300">{latest.key || '(no key)'}</span></span><ArrowRight size={13} className="shrink-0 text-slate-600" /></button>}
                  </article>
                })}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {state.nodes.map((node) => <div key={node.id} className="broker-node"><div className="flex items-center justify-between"><span className="flex items-center gap-2 font-mono text-[11px] text-slate-300"><Server size={13} className="text-slate-500" />{node.id}</span><StatusDot /></div><div className="mt-2 flex items-center justify-between text-[10px] text-slate-600"><span>{node.rack}</span><span className="font-mono">{node.load}% load</span></div><ProgressBar value={node.load} color={node.load > 75 ? '#f59e0b' : '#10b981'} height="h-1" className="mt-2" /></div>)}
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3.5 sm:px-5"><div><div className="eyebrow">Offset commits</div><h3 className="mt-1 text-sm font-medium text-slate-200">Consumer lag by partition</h3></div><span className="font-mono text-[10px] text-slate-600">live / {selectedTopic.partitions.length} lanes</span></div>
            {subscribedGroups.length ? <div className="overflow-x-auto"><table className="data-table min-w-[560px]"><thead><tr><th>Consumer group</th>{selectedTopic.partitions.map((partition) => <th key={partition.id}>P{partition.id} lag</th>)}<th>Throughput</th><th>Total</th></tr></thead><tbody>{subscribedGroups.map((group) => <tr key={group.id}><td><div className="flex items-center gap-2"><StatusDot color={group.status === 'active' ? '#10b981' : '#f59e0b'} pulse={group.status === 'active'} /><span className="font-mono text-[11px] text-slate-300">{group.name}</span></div></td>{selectedTopic.partitions.map((partition) => { const lag = getPartitionLag(group, selectedTopic, partition); return <td key={partition.id}><span className={cn('font-mono text-xs', lag > 2 ? 'text-amber-400' : lag ? 'text-slate-300' : 'text-emerald-400')}>{lag}</span><ProgressBar value={lag} max={8} color={lag > 2 ? '#f59e0b' : '#10b981'} height="h-0.5" className="mt-1.5 w-14" /></td> })}<td className="font-mono text-xs text-slate-400">{group.throughput.toFixed(1)}<span className="ml-1 text-[10px] text-slate-600">msg/s</span></td><td className="font-mono text-xs text-amber-300">{getGroupLag(state, group)}</td></tr>)}</tbody></table></div> : <EmptyState icon={Box} title="No subscribers" description="Create a consumer group subscription to see offset lag here." />}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
            <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3.5"><div className="flex items-center gap-2 text-sm font-medium text-slate-200"><Clock3 size={14} className="text-violet-400" />Latest retained events</div><span className="font-mono text-[10px] text-slate-600">{selectedMessages.length} in log</span></div><div className="divide-y divide-slate-800/60">{selectedMessages.slice(0, 6).map((message) => <button type="button" key={message.id} onClick={() => setMessageId(message.id)} className="event-row"><span className="font-mono text-[11px] text-violet-300/80">@{String(message.offset).padStart(4, '0')}</span><span className="min-w-0 flex-1 text-left"><span className="block truncate font-mono text-[11px] text-slate-300">{message.key || '(unkeyed event)'}</span><span className="mt-1 block text-[10px] text-slate-600">P{message.partitionId} · {formatTime(message.timestamp)}</span></span><ChevronRight size={14} className="text-slate-700" /></button>)}{!selectedMessages.length && <EmptyState icon={Database} title="Partition log is empty" description="Publish an event from the Producer Stream to append an offset." />}</div></Panel>
            <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3.5"><div className="flex items-center gap-2 text-sm font-medium text-slate-200"><Activity size={14} className="text-emerald-400" />Cluster event log</div><button type="button" className="text-[10px] text-slate-600 transition hover:text-slate-300" onClick={broker.clearActivity}>Clear</button></div><div className="max-h-[290px] divide-y divide-slate-800/60 overflow-y-auto">{state.activity.slice(0, 10).map((item) => <div key={item.id} className="flex gap-2.5 px-4 py-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: activityColors[item.type] }} /><div className="min-w-0"><p className="break-words font-mono text-[10px] leading-5 text-slate-400">{item.message}</p><span className="mt-1 block font-mono text-[9px] text-slate-700">{formatTime(item.timestamp)}</span></div></div>)}{!state.activity.length && <EmptyState icon={Activity} title="Log cleared" description="New broker operations will appear here." />}</div></Panel>
          </div>
        </div>
      </div>

      <Modal open={Boolean(configTopic)} onClose={() => setConfigTopic(null)} title={`Configure ${configTopic?.name ?? 'topic'}`} eyebrow="Topic settings">
        <div className="space-y-5"><div><FieldLabel hint="1–6">Partition count</FieldLabel><div className="grid grid-cols-6 gap-2">{[1, 2, 3, 4, 5, 6].map((count) => <button type="button" key={count} onClick={() => setConfigPartitions(count)} className={cn('partition-choice', configPartitions === count && 'partition-choice-active')}>{count}</button>)}</div><p className="mt-2 text-xs leading-5 text-slate-500">Adding partitions triggers a cooperative rebalance for subscribed groups. Removing partitions discards their retained buffers.</p></div><div><FieldLabel hint="hours">Retention window</FieldLabel><input className="input" type="number" min={1} max={168} value={configRetention} onChange={(event) => setConfigRetention(Number(event.target.value))} /></div><div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3 text-xs leading-5 text-amber-200/70">Offset numbers are never reused. Existing group commits move forward as the topology changes.</div><div className="flex justify-end gap-2"><button type="button" className="button button-secondary" onClick={() => setConfigTopic(null)}>Cancel</button><button type="button" className="button button-primary" onClick={saveConfig}><Settings2 size={14} />Apply configuration</button></div></div>
      </Modal>

      <Modal open={newTopicOpen} onClose={() => setNewTopicOpen(false)} title="Register a new topic" eyebrow="Cluster administration">
        <div className="space-y-4"><div><FieldLabel>Topic name</FieldLabel><input autoFocus className="input font-mono" placeholder="e.g. shipments.dispatched" value={newTopic.name} onChange={(event) => { setNewTopic({ ...newTopic, name: event.target.value }); setNewTopicError('') }} /></div><div><FieldLabel>Description</FieldLabel><textarea className="input min-h-20 resize-none" placeholder="What fact does this stream represent?" value={newTopic.description} onChange={(event) => setNewTopic({ ...newTopic, description: event.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><FieldLabel>Partitions</FieldLabel><select className="input" value={newTopic.partitions} onChange={(event) => setNewTopic({ ...newTopic, partitions: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} partitions</option>)}</select></div><div><FieldLabel>Retention hours</FieldLabel><input className="input" type="number" min={1} max={168} value={newTopic.retentionHours} onChange={(event) => setNewTopic({ ...newTopic, retentionHours: Number(event.target.value) })} /></div></div>{newTopicError && <p className="text-xs text-rose-400">{newTopicError}</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" className="button button-secondary" onClick={() => setNewTopicOpen(false)}>Cancel</button><button type="button" className="button button-primary" onClick={createTopic}><Plus size={14} />Create topic</button></div></div>
      </Modal>

      <Drawer open={Boolean(selectedMessage)} onClose={() => setMessageId(null)} title={selectedMessage ? `${selectedMessage.key || 'Event'} · @${selectedMessage.offset}` : 'Event details'} eyebrow="Message inspector">
        {selectedMessage && <MessageInspector message={selectedMessage} broker={broker} />}
      </Drawer>
    </div>
  )
}

function MessageInspector({ message, broker }: { message: EventMessage; broker: BrokerController }) {
  const { state } = broker
  const topic = state.topics.find((item) => item.id === message.topicId)
  let pretty = message.value
  try { pretty = JSON.stringify(JSON.parse(message.value), null, 2) } catch { /* preserve invalid payload for inspection */ }
  return <div className="space-y-5"><div className="grid grid-cols-2 gap-2"><div className="inspector-stat"><span>Topic</span><strong className="truncate font-mono text-[11px]">{topic?.name ?? message.topicId}</strong></div><div className="inspector-stat"><span>Partition / offset</span><strong className="font-mono">P{message.partitionId} / {message.offset}</strong></div><div className="inspector-stat"><span>Size</span><strong className="font-mono">{message.size} B</strong></div><div className="inspector-stat"><span>Produced at</span><strong className="font-mono text-[11px]">{formatTime(message.timestamp)}</strong></div></div><div><div className="mb-2 flex items-center justify-between"><div className="eyebrow">Message ID</div><CopyButton value={message.id} /></div><div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-[10px] break-all text-violet-300">{message.id}</div></div><div><div className="mb-2 flex items-center justify-between"><div className="eyebrow">JSON value</div><CopyButton value={pretty} /></div><JsonBlock value={pretty} maxHeight="max-h-72" /></div><div><div className="eyebrow mb-2">Headers</div><div className="overflow-hidden rounded-xl border border-slate-800">{Object.entries(message.headers).map(([key, value]) => <div key={key} className="flex items-start justify-between gap-4 border-b border-slate-800/70 px-3 py-2 last:border-0"><span className="font-mono text-[10px] text-slate-500">{key}</span><span className="break-all text-right font-mono text-[10px] text-slate-300">{value}</span></div>)}</div></div><div><div className="eyebrow mb-2">Delivery confirmations</div><div className="space-y-2">{state.groups.filter((group) => group.subscriptions.includes(message.topicId)).map((group) => { const delivery = message.deliveries[group.id]; const committed = group.committed[`${message.topicId}:${message.partitionId}`] ?? 0; return <div key={group.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3"><div><div className="font-mono text-[11px] text-slate-300">{group.name}</div><div className="mt-1 text-[10px] text-slate-600">committed offset {committed}</div></div><Badge tone={delivery?.status === 'dead' ? 'rose' : delivery?.status === 'retrying' ? 'amber' : delivery?.status === 'delivered' || committed > message.offset ? 'emerald' : 'neutral'}>{delivery?.status ?? (committed > message.offset ? 'delivered' : 'pending')}</Badge></div> })}</div></div></div>
}
