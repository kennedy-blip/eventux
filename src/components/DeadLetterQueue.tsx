import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Check, CheckCheck, Download, Eye, FileJson, Inbox, RotateCcw, Search, ShieldAlert, Trash2 } from 'lucide-react'
import type { BrokerController } from '../hooks/useBroker'
import { formatBytes, formatTime } from '../lib/broker'
import type { DlqRecord } from '../types'
import { cn } from '../utils/cn'
import { Badge, CopyButton, Drawer, EmptyState, JsonBlock, Panel, SectionHeading, StatusDot } from './Shared'

interface Props {
  broker: BrokerController
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export default function DeadLetterQueue({ broker, onToast }: Props) {
  const { state } = broker
  const [query, setQuery] = useState('')
  const [topicFilter, setTopicFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'open' | 'all' | 'resolved'>('open')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const openCount = state.dlq.filter((record) => record.status === 'open').length
  const replayedCount = state.dlq.filter((record) => record.status === 'replayed').length
  const discardedCount = state.dlq.filter((record) => record.status === 'discarded').length
  const filtered = useMemo(() => state.dlq.filter((record) => {
    const topic = state.topics.find((item) => item.id === record.message.topicId)?.name ?? record.message.topicId
    const haystack = `${topic} ${record.groupId} ${record.message.key} ${record.reason} ${record.message.value}`.toLowerCase()
    const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase())
    const matchesTopic = topicFilter === 'all' || record.message.topicId === topicFilter
    const matchesGroup = groupFilter === 'all' || record.groupId === groupFilter
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'open' ? record.status === 'open' : record.status !== 'open')
    return matchesQuery && matchesTopic && matchesGroup && matchesStatus
  }), [state.dlq, state.topics, query, topicFilter, groupFilter, statusFilter])
  const detail = state.dlq.find((record) => record.id === detailId) ?? null
  const selectedOpen = [...selected].filter((id) => state.dlq.some((record) => record.id === id && record.status === 'open'))
  const openVisible = filtered.filter((record) => record.status === 'open')
  const allVisibleSelected = openVisible.length > 0 && openVisible.every((record) => selected.has(record.id))

  const toggleSelected = (id: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected((current) => {
    const next = new Set(current)
    if (allVisibleSelected) openVisible.forEach((record) => next.delete(record.id))
    else openVisible.forEach((record) => next.add(record.id))
    return next
  })
  const resolve = (mode: 'replay' | 'discard', ids = selectedOpen) => {
    if (!ids.length) { onToast('Select at least one open DLQ record first.', 'error'); return }
    broker.resolveDlq(ids, mode)
    setSelected(new Set())
    onToast(mode === 'replay' ? `${ids.length} event${ids.length > 1 ? 's' : ''} replayed to their original routes` : `${ids.length} DLQ record${ids.length > 1 ? 's' : ''} acknowledged and discarded`, mode === 'replay' ? 'success' : 'info')
  }
  const exportRecords = () => {
    if (!filtered.length) { onToast('There are no records matching these filters to export.', 'error'); return }
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), cluster: 'eventpulse-local', filters: { query, topicFilter, groupFilter, statusFilter }, records: filtered }, null, 2)
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `eventpulse-dlq-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    onToast(`${filtered.length} DLQ records exported as JSON`, 'success')
  }

  return (
    <div className="view-enter space-y-5">
      <SectionHeading eyebrow="04 / failure boundary" title="Dead letter queue" description="Inspect events that exhausted their delivery budget. Replay preserves the original key and lane; discard records an explicit operator decision." actions={<><button type="button" className="button button-secondary" onClick={exportRecords}><Download size={14} />Export JSON</button><button type="button" className="button button-primary" disabled={!openCount} onClick={() => resolve('replay', state.dlq.filter((record) => record.status === 'open').map((record) => record.id))}><RotateCcw size={14} />Replay all open</button></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="dlq-stat"><div className="flex items-center justify-between"><span className="eyebrow">Open records</span><ShieldAlert size={16} className="text-rose-400" /></div><div className="mt-3 font-mono text-3xl tracking-[-0.07em] text-rose-300">{openCount}</div><div className="mt-1 text-xs text-slate-500">Awaiting operator action</div></div><div className="dlq-stat"><div className="flex items-center justify-between"><span className="eyebrow">Replayed</span><RotateCcw size={16} className="text-violet-400" /></div><div className="mt-3 font-mono text-3xl tracking-[-0.07em] text-violet-300">{replayedCount}</div><div className="mt-1 text-xs text-slate-500">New offsets appended</div></div><div className="dlq-stat"><div className="flex items-center justify-between"><span className="eyebrow">Discarded</span><CheckCheck size={16} className="text-slate-400" /></div><div className="mt-3 font-mono text-3xl tracking-[-0.07em] text-slate-200">{discardedCount}</div><div className="mt-1 text-xs text-slate-500">Explicitly acknowledged</div></div><div className="dlq-stat"><div className="flex items-center justify-between"><span className="eyebrow">Failure attempts</span><AlertTriangle size={16} className="text-amber-400" /></div><div className="mt-3 font-mono text-3xl tracking-[-0.07em] text-amber-300">{state.stats.failed}</div><div className="mt-1 text-xs text-slate-500">Across all consumer groups</div></div></div>

      <Panel className="overflow-hidden"><div className="space-y-3 border-b border-slate-800/80 p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-600" /><input className="input pl-9" placeholder="Search key, payload, reason, or group…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="grid grid-cols-2 gap-2 sm:flex"><select className="input h-10 min-w-0 text-xs sm:w-44" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="all">All topics</option>{state.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select><select className="input h-10 min-w-0 text-xs sm:w-44" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">All groups</option>{state.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div></div><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/30 p-1">{(['open', 'resolved', 'all'] as const).map((status) => <button type="button" key={status} onClick={() => setStatusFilter(status)} className={cn('rounded-md px-3 py-1.5 text-[11px] capitalize transition', statusFilter === status ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300')}>{status === 'open' ? `Open (${openCount})` : status}</button>)}</div><div className="flex items-center gap-2"><span className="font-mono text-[10px] text-slate-600">{selectedOpen.length} selected</span><button type="button" className="button button-secondary h-8 px-2.5 text-[11px]" disabled={!selectedOpen.length} onClick={() => resolve('replay')}><RotateCcw size={12} />Replay</button><button type="button" className="button button-danger-ghost h-8 px-2.5 text-[11px]" disabled={!selectedOpen.length} onClick={() => resolve('discard')}><Trash2 size={12} />Discard</button></div></div></div>
        {filtered.length ? <div className="overflow-x-auto"><table className="data-table min-w-[940px]"><thead><tr><th className="w-10"><button type="button" className={cn('checkbox', allVisibleSelected && 'checkbox-checked')} onClick={toggleAll} aria-label="Select all visible open records">{allVisibleSelected && <Check size={12} />}</button></th><th>Event / topic</th><th>Consumer group</th><th>Failure reason</th><th>Attempts</th><th>Age</th><th>Status</th><th className="w-10" /></tr></thead><tbody>{filtered.map((record) => <DlqRow key={record.id} record={record} broker={broker} selected={selected.has(record.id)} onToggle={() => toggleSelected(record.id)} onOpen={() => setDetailId(record.id)} />)}</tbody></table></div> : <EmptyState icon={Inbox} title={state.dlq.length ? 'No records match these filters' : 'Dead letter queue is clear'} description={state.dlq.length ? 'Try a different topic, group, status, or search term.' : 'When a consumer exhausts its retry budget, the original event and failure context will be captured here.'} action={state.dlq.length ? <button type="button" className="button button-secondary" onClick={() => { setQuery(''); setTopicFilter('all'); setGroupFilter('all'); setStatusFilter('all') }}>Clear filters</button> : undefined} />}
        <div className="flex flex-col gap-2 border-t border-slate-800/80 px-4 py-3 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-5"><span>Showing {filtered.length} of {state.dlq.length} captured records · newest first</span><span className="flex items-center gap-1.5"><StatusDot color="#f43f5e" />DLQ retention is independent of source topic retention</span></div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-3"><div className="info-callout"><div className="info-callout-icon violet"><RotateCcw size={15} /></div><div><h3>Replay is a new append</h3><p>Replaying never rewrites an offset. The event receives a new ID and replay headers, then follows normal consumer retry rules.</p></div></div><div className="info-callout"><div className="info-callout-icon amber"><AlertTriangle size={15} /></div><div><h3>Poison events stay visible</h3><p>Failure injection headers are preserved. If the underlying payload is still invalid, a replay can create a new DLQ record.</p></div></div><div className="info-callout"><div className="info-callout-icon emerald"><FileJson size={15} /></div><div><h3>Evidence is portable</h3><p>Export includes the complete value, headers, group, failure reason, attempts, and resolution metadata for your incident workflow.</p></div></div></div>

      <Drawer open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail ? `DLQ · ${detail.message.key || 'unkeyed event'}` : 'DLQ record'} eyebrow="Failure inspector">{detail && <DlqInspector record={detail} broker={broker} onResolve={(mode) => { resolve(mode, [detail.id]); setDetailId(null) }} />}</Drawer>
    </div>
  )
}

function DlqRow({ record, broker, selected, onToggle, onOpen }: { record: DlqRecord; broker: BrokerController; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const topic = broker.state.topics.find((item) => item.id === record.message.topicId)
  return <tr className="cursor-pointer" onClick={onOpen}><td onClick={(event) => event.stopPropagation()}><button type="button" disabled={record.status !== 'open'} className={cn('checkbox', selected && 'checkbox-checked', record.status !== 'open' && 'opacity-30')} onClick={onToggle} aria-label={`Select ${record.id}`}>{selected && <Check size={12} />}</button></td><td><div className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: topic?.color ?? '#f43f5e' }} /><div><div className="max-w-[210px] truncate font-mono text-[11px] text-slate-200">{record.message.key || '(unkeyed event)'}</div><div className="mt-1 font-mono text-[10px] text-slate-600">{topic?.name ?? record.message.topicId} · P{record.message.partitionId} @{record.message.offset}</div></div></div></td><td className="font-mono text-[11px] text-slate-400">{record.groupId}</td><td><div className="max-w-[280px] truncate text-[11px] text-slate-400" title={record.reason}>{record.reason}</div><div className="mt-1 font-mono text-[9px] text-slate-700">{record.id}</div></td><td><span className="font-mono text-xs text-amber-300">{record.attempts}</span></td><td><span className="whitespace-nowrap font-mono text-[10px] text-slate-500">{relativeTime(record.failedAt)}</span></td><td><Badge tone={record.status === 'open' ? 'rose' : record.status === 'replayed' ? 'violet' : 'neutral'}>{record.status}</Badge></td><td><button type="button" className="icon-button h-8 w-8" onClick={(event) => { event.stopPropagation(); onOpen() }} aria-label="Inspect DLQ record"><Eye size={14} /></button></td></tr>
}

function DlqInspector({ record, broker, onResolve }: { record: DlqRecord; broker: BrokerController; onResolve: (mode: 'replay' | 'discard') => void }) {
  const topic = broker.state.topics.find((item) => item.id === record.message.topicId)
  let pretty = record.message.value
  try { pretty = JSON.stringify(JSON.parse(record.message.value), null, 2) } catch { /* keep raw invalid payload */ }
  return <div className="space-y-5"><div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3.5"><div className="flex items-center gap-2 text-xs font-medium text-rose-300"><AlertTriangle size={14} />Retry budget exhausted</div><p className="mt-2 text-xs leading-5 text-rose-100/60">{record.reason}</p></div><div className="grid grid-cols-2 gap-2"><div className="inspector-stat"><span>Original route</span><strong className="font-mono text-[11px]">P{record.message.partitionId} / @{record.message.offset}</strong></div><div className="inspector-stat"><span>Failed at</span><strong className="font-mono text-[11px]">{formatTime(record.failedAt)}</strong></div><div className="inspector-stat"><span>Consumer</span><strong className="truncate font-mono text-[11px]">{record.groupId}</strong></div><div className="inspector-stat"><span>Payload size</span><strong className="font-mono text-[11px]">{formatBytes(record.message.size)}</strong></div></div><div><div className="mb-2 flex items-center justify-between"><div className="eyebrow">Original topic</div><Badge tone="neutral">{topic?.name ?? record.message.topicId}</Badge></div><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 font-mono text-[10px] text-slate-400">{record.id}</div></div><div><div className="mb-2 flex items-center justify-between"><div className="eyebrow">Original JSON value</div><CopyButton value={pretty} /></div><JsonBlock value={pretty} maxHeight="max-h-72" /></div><div><div className="eyebrow mb-2">Headers preserved on replay</div><div className="overflow-hidden rounded-xl border border-slate-800">{Object.entries(record.message.headers).map(([key, value]) => <div key={key} className="flex justify-between gap-3 border-b border-slate-800/70 px-3 py-2 last:border-0"><span className="font-mono text-[10px] text-slate-500">{key}</span><span className="break-all text-right font-mono text-[10px] text-slate-300">{value}</span></div>)}</div></div>{record.status !== 'open' ? <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400"><div className="flex items-center gap-2"><CheckCheck size={14} className="text-emerald-400" />Resolved as <Badge tone={record.status === 'replayed' ? 'violet' : 'neutral'}>{record.status}</Badge></div>{record.replayedMessageId && <div className="mt-2 font-mono text-[10px] text-slate-600">new message: {record.replayedMessageId}</div>}</div> : <div className="flex gap-2 border-t border-slate-800 pt-4"><button type="button" className="button button-primary flex-1 justify-center" onClick={() => onResolve('replay')}><RotateCcw size={14} />Replay event</button><button type="button" className="button button-danger-ghost flex-1 justify-center" onClick={() => onResolve('discard')}><Trash2 size={14} />Discard</button></div>}<div className="flex items-start gap-2 text-[10px] leading-5 text-slate-600"><ArrowUpRight size={13} className="mt-0.5 shrink-0" />The source event remains immutable. Replay appends to {topic?.name ?? 'the original topic'} with the original key and partition where available.</div></div>
}
