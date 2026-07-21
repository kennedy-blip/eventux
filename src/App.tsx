import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Activity, ArrowDown, ArrowRight, Check, CircleAlert, Layers3, Radio, RotateCcw, Send, Server, ShieldAlert, Sparkles, Trash2, X, Zap } from 'lucide-react'
import Header from './components/Header'
import TopicTopology from './components/TopicTopology'
import EventProducer from './components/EventProducer'
import ConsumerGroupMonitor from './components/ConsumerGroupMonitor'
import DeadLetterQueue from './components/DeadLetterQueue'
import { Badge, Modal, StatusDot } from './components/Shared'
import { useBroker } from './hooks/useBroker'
import { EVENT_TEMPLATES, formatCompact, getTotalLag } from './lib/broker'
import type { ViewId } from './types'
import { cn } from './utils/cn'

type ToastTone = 'success' | 'error' | 'info'
interface ToastState { id: number; message: string; tone: ToastTone }

export default function App() {
  const broker = useBroker()
  const { state } = broker
  const [activeView, setActiveView] = useState<ViewId>(() => {
    try { return (localStorage.getItem('eventpulse.active-view') as ViewId) || 'topology' } catch { return 'topology' }
  })
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purgeTopicId, setPurgeTopicId] = useState(state.topics[0]?.id ?? '')
  const [resetOpen, setResetOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const mainRef = useRef<HTMLElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message, tone })
    toastTimer.current = window.setTimeout(() => setToast(null), 3600)
  }, [])

  const changeView = useCallback((view: ViewId) => {
    setActiveView(view)
    try { localStorage.setItem('eventpulse.active-view', view) } catch { /* no-op */ }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }, [])

  useEffect(() => {
    const onScroll = () => {
      if (!heroRef.current) return
      const progress = Math.max(0, Math.min(1, window.scrollY / Math.max(1, window.innerHeight * 0.82)))
      setScrollProgress(progress)
    }
    let frame = 0
    const listener = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(onScroll) }
    window.addEventListener('scroll', listener, { passive: true })
    onScroll()
    return () => { window.removeEventListener('scroll', listener); cancelAnimationFrame(frame) }
  }, [activeView])

  useEffect(() => {
    const root = mainRef.current
    if (!root) return undefined
    const elements = Array.from(root.querySelectorAll<HTMLElement>('.workspace-content .panel'))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -30px' })
    elements.forEach((element, index) => {
      element.classList.add('scroll-reveal')
      element.style.setProperty('--reveal-delay', `${(index % 4) * 55}ms`)
      observer.observe(element)
    })
    return () => observer.disconnect()
  }, [activeView])

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current) }, [])

  const quickPublish = useCallback(() => {
    const topic = state.topics[0]
    if (!topic) { showToast('Create a topic before publishing a test event.', 'error'); return }
    const template = EVENT_TEMPLATES.find((item) => item.topicId === topic.id) ?? EVENT_TEMPLATES[0]
    const value = JSON.stringify({ ...template.value, eventId: `evt_test_${Date.now().toString(36)}`, occurredAt: new Date().toISOString(), source: 'eventpulse.quick-action' }, null, 2)
    broker.publish({ topicId: topic.id, key: `${template.key}_test`, value, headers: { ...template.headers, source: 'eventpulse.quick-action' } })
    showToast(`Test event appended to ${topic.name}`, 'success')
  }, [broker, showToast, state.topics])

  const exportSnapshot = () => {
    const exportState = { ...state, packets: [], exportedAt: new Date().toISOString() }
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportState, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `eventpulse-snapshot-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('Broker snapshot exported with offsets, logs, and group state', 'success')
  }

  const confirmPurge = () => {
    const topic = state.topics.find((item) => item.id === purgeTopicId)
    if (!topic) return
    broker.purgeTopic(topic.id)
    setPurgeOpen(false)
    showToast(`${topic.name} buffer purged; offsets preserved`, 'info')
  }

  const resetCluster = () => {
    broker.reset()
    setResetOpen(false)
    setPurgeTopicId(state.topics[0]?.id ?? '')
    showToast('Cluster reset to the authored EventPulse snapshot', 'success')
  }

  const openDlq = state.dlq.filter((record) => record.status === 'open').length
  const purgeTopic = state.topics.find((topic) => topic.id === purgeTopicId) ?? state.topics[0]

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <Header activeView={activeView} onViewChange={changeView} onQuickPublish={quickPublish} onPurge={() => { setPurgeTopicId(state.topics[0]?.id ?? ''); setPurgeOpen(true) }} onExport={exportSnapshot} onReset={() => setResetOpen(true)} running={state.settings.running} onToggleRunning={() => broker.setSettings({ running: !state.settings.running })} openDlq={openDlq} />
      <main ref={mainRef} className="relative z-[1] mx-auto max-w-[1680px] px-4 pb-12 sm:px-6 lg:px-8">
        {activeView === 'topology' && <PulseHero heroRef={heroRef} progress={scrollProgress} state={state} onNavigate={changeView} />}
        <div className={cn('workspace-content', activeView === 'topology' && 'pt-8')} id={activeView === 'topology' ? 'topology-workspace' : undefined}>
          {activeView === 'topology' && <TopicTopology broker={broker} onToast={showToast} />}
          {activeView === 'producer' && <EventProducer broker={broker} onToast={showToast} />}
          {activeView === 'consumers' && <ConsumerGroupMonitor broker={broker} onToast={showToast} />}
          {activeView === 'dlq' && <DeadLetterQueue broker={broker} onToast={showToast} />}
        </div>
        <footer className="mt-10 flex flex-col gap-3 border-t border-slate-800/60 pt-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Radio size={12} className="text-violet-500/70" /><span>EventPulse local simulator</span><span className="text-slate-800">/</span><span>State persists in this browser</span></div><div className="flex flex-wrap items-center gap-3 font-mono"><span>tick {state.settings.tickMs}ms</span><span>seq {state.sequence}</span><span className="flex items-center gap-1.5"><StatusDot color={state.settings.running ? '#10b981' : '#f59e0b'} />{state.settings.running ? 'engine running' : 'engine paused'}</span></div></footer>
      </main>

      <Modal open={purgeOpen} onClose={() => setPurgeOpen(false)} title="Purge topic buffer" eyebrow="Destructive operation">
        <div className="space-y-5"><div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3.5"><Trash2 size={17} className="mt-0.5 shrink-0 text-rose-400" /><p className="text-xs leading-5 text-rose-100/70">This clears retained messages from the selected topic. Offset numbers and consumer commits are preserved, so the next publish continues from the current high watermark.</p></div><div><div className="eyebrow mb-2">Topic buffer</div><select className="input font-mono text-xs" value={purgeTopic?.id ?? ''} onChange={(event) => setPurgeTopicId(event.target.value)}>{state.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></div>{purgeTopic && <div className="grid grid-cols-3 gap-2"><div className="mini-metric"><span>Retained</span><strong>{purgeTopic.partitions.reduce((sum, partition) => sum + partition.log.length, 0)}</strong></div><div className="mini-metric"><span>Partitions</span><strong>{purgeTopic.partitions.length}</strong></div><div className="mini-metric"><span>High watermark</span><strong>{Math.max(...purgeTopic.partitions.map((partition) => partition.nextOffset), 0)}</strong></div></div>}<div className="flex justify-end gap-2"><button type="button" className="button button-secondary" onClick={() => setPurgeOpen(false)}>Cancel</button><button type="button" className="button button-danger" onClick={confirmPurge}><Trash2 size={14} />Purge buffer</button></div></div>
      </Modal>
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset cluster snapshot" eyebrow="Local workspace">
        <div className="space-y-5"><p className="text-sm leading-6 text-slate-400">Restore the four authored topics, four consumer groups, and initial failure records. Your published events, offset commits, and operator resolutions will be replaced.</p><div className="flex justify-end gap-2"><button type="button" className="button button-secondary" onClick={() => setResetOpen(false)}>Keep current state</button><button type="button" className="button button-danger" onClick={resetCluster}><RotateCcw size={14} />Reset cluster</button></div></div>
      </Modal>
      {toast && <div key={toast.id} className={cn('toast', `toast-${toast.tone}`)} role="status"><span className="toast-icon">{toast.tone === 'success' ? <Check size={15} /> : toast.tone === 'error' ? <CircleAlert size={15} /> : <Activity size={15} />}</span><span className="flex-1 text-xs leading-5 text-slate-200">{toast.message}</span><button type="button" className="text-slate-600 transition hover:text-slate-300" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}
    </div>
  )
}

function PulseHero({ heroRef, progress, state, onNavigate }: { heroRef: React.RefObject<HTMLElement | null>; progress: number; state: ReturnType<typeof useBroker>['state']; onNavigate: (view: ViewId) => void }) {
  const openDlq = state.dlq.filter((record) => record.status === 'open').length
  const deliveryHealth = Math.max(0, 100 - (state.stats.failed / Math.max(1, state.stats.published)) * 100)
  const uptimeSeconds = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000))
  const uptime = [Math.floor(uptimeSeconds / 3600), Math.floor((uptimeSeconds % 3600) / 60), uptimeSeconds % 60].map((part) => String(part).padStart(2, '0')).join(':')
  const sceneStyle = { '--scene-progress': progress, transform: `translate3d(0, ${progress * 70}px, 0) scale(${1 - progress * 0.1})`, opacity: 1 - progress * 0.5 } as CSSProperties
  const copyStyle = { transform: `translate3d(0, ${progress * -28}px, 0)`, opacity: 1 - progress * 0.35 } as CSSProperties
  return (
    <section ref={heroRef} className="hero-scene" style={{ '--hero-progress': progress } as CSSProperties}>
      <div className="hero-grid-bg" style={{ transform: `translateY(${progress * 90}px) scale(${1 + progress * 0.12})` }} />
      <div className="hero-glow" />
      <div className="hero-layout">
        <div className="hero-copy" style={copyStyle}>
          <div className="hero-kicker"><span className="hero-kicker-line" /><span>EVENT-DRIVEN SYSTEMS / LOCAL SIMULATOR</span></div>
          <h1>Every event<br /><span>has a pulse.</span></h1>
          <p>Explore the life of a message across brokers, partitions, consumer groups, and failure boundaries. A working stream lab for systems that never stop moving.</p>
          <div className="flex flex-wrap items-center gap-3"><button type="button" className="button button-primary h-11 px-5" onClick={() => onNavigate('producer')}><Send size={15} />Open Producer Stream<ArrowRight size={14} /></button><button type="button" className="button button-ghost h-11 px-4" onClick={() => document.getElementById('topology-workspace')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}><Layers3 size={15} />Inspect topology<ArrowDown size={14} /></button></div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-slate-600"><span className="flex items-center gap-1.5"><StatusDot pulse color="#10b981" />No external broker required</span><span className="flex items-center gap-1.5"><Zap size={11} className="text-violet-500" />Real offsets & retry semantics</span></div>
        </div>
        <div className="hero-visual-wrap" style={sceneStyle}>
          <div className="hero-visual">
            <div className="hero-visual-top"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-300"><Activity size={13} /></span><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Live event mesh</span></div><Badge tone="emerald"><StatusDot pulse />3 / 3 online</Badge></div>
            <div className="network-canvas">
              <div className="network-grid" />
              <svg className="network-lines" viewBox="0 0 600 360" preserveAspectRatio="none" aria-hidden="true"><path d="M106 82 C210 82 205 171 292 171" /><path d="M106 177 C190 177 208 180 292 180" /><path d="M106 274 C205 274 205 193 292 190" /><path d="M308 172 C402 171 393 82 496 82" /><path d="M308 181 C405 181 395 177 496 177" /><path d="M308 191 C399 193 397 274 496 274" /><circle cx="300" cy="181" r="102" /><circle cx="300" cy="181" r="128" /></svg>
              <div className="network-label network-label-left">TOPICS</div><div className="network-label network-label-right">CONSUMERS</div>
              {state.topics.slice(0, 3).map((topic, index) => <div key={topic.id} className={`network-topic network-topic-${index}`}><span className="network-node-dot" style={{ backgroundColor: topic.color, boxShadow: `0 0 15px ${topic.color}` }} /><div><div className="font-mono text-[10px] text-slate-300">{topic.name}</div><div className="mt-1 font-mono text-[9px] text-slate-600">{topic.partitions.length} partitions · {topic.partitions.reduce((sum, partition) => sum + partition.nextOffset, 0)} offsets</div></div></div>)}
              <div className="network-core"><div className="network-core-ring"><Server size={26} strokeWidth={1.2} /></div><span className="mt-2 font-mono text-[10px] tracking-[0.16em] text-violet-200">BROKER CORE</span><span className="mt-1 font-mono text-[9px] text-slate-600">localhost:9092</span><div className="core-pulse" /></div>
              {state.groups.slice(0, 3).map((group, index) => <div key={group.id} className={`network-consumer network-consumer-${index}`}><div className="flex items-center gap-1.5"><StatusDot color={group.status === 'active' ? '#10b981' : '#f59e0b'} pulse={group.status === 'active'} /><span className="font-mono text-[10px] text-slate-300">{group.name}</span></div><div className="mt-1 font-mono text-[9px] text-slate-600">{group.throughput.toFixed(1)} msg/s · lag {state.topics.reduce((sum, topic) => sum + (group.subscriptions.includes(topic.id) ? topic.partitions.reduce((inner, partition) => inner + Math.max(0, partition.nextOffset - (group.committed[`${topic.id}:${partition.id}`] ?? 0)), 0) : 0), 0)}</div></div>)}
              {state.packets.slice(0, 5).map((packet, index) => <span key={packet.id} className={`network-packet network-packet-${index % 3}`} />)}
            </div>
            <div className="hero-visual-bottom"><span><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />publish</span><span><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />acknowledge</span><span><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />lag</span><span className="ml-auto font-mono text-[9px] text-slate-600">SEQ {String(state.sequence).padStart(6, '0')}</span></div>
          </div>
          <div className="hero-float-card hero-float-top"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-500"><Sparkles size={11} className="text-violet-400" />Stream health</span><strong>{deliveryHealth.toFixed(2)}<span>%</span></strong><span className={deliveryHealth >= 95 ? 'text-[9px] text-emerald-400' : 'text-[9px] text-amber-400'}>{deliveryHealth >= 95 ? 'within SLO' : 'watch failures'}</span></div>
          <div className="hero-float-card hero-float-bottom"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-500"><ShieldAlert size={11} className="text-rose-400" />DLQ watch</span><strong className={openDlq ? 'text-rose-300' : 'text-emerald-300'}>{openDlq}<span> open</span></strong><button type="button" onClick={() => onNavigate('dlq')} className="flex items-center gap-1 text-[9px] text-slate-500 transition hover:text-slate-200">Inspect queue<ArrowRight size={10} /></button></div>
        </div>
      </div>
      <div className="hero-metrics"><div><span>Events appended</span><strong>{formatCompact(state.stats.published)}</strong><small>all topics</small></div><div><span>Messages acknowledged</span><strong className="text-emerald-300">{formatCompact(state.stats.consumed)}</strong><small>across {state.groups.length} groups</small></div><div><span>Current lag</span><strong className="text-amber-300">{formatCompact(getTotalLag(state))}</strong><small>uncommitted events</small></div><div><span>Broker uptime</span><strong>{uptime}</strong><small>3 nodes · RF 3</small></div></div>
      <div className="hero-scroll-cue"><span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">Scroll to operate the cluster</span><ArrowDown size={13} className="text-slate-600" /></div>
    </section>
  )
}
