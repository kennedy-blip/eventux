import { Activity, Download, Layers3, Pause, Play, Radio, RotateCcw, Send, ShieldAlert, Trash2, UsersRound } from 'lucide-react'
import type { ViewId } from '../types'
import { cn } from '../utils/cn'
import { Badge, StatusDot } from './Shared'

const tabs: { id: ViewId; label: string; icon: typeof Layers3 }[] = [
  { id: 'topology', label: 'Topic Topology', icon: Layers3 },
  { id: 'producer', label: 'Producer Stream', icon: Send },
  { id: 'consumers', label: 'Consumer Groups', icon: UsersRound },
  { id: 'dlq', label: 'Dead Letter Queue', icon: ShieldAlert },
]

interface HeaderProps {
  activeView: ViewId
  onViewChange: (view: ViewId) => void
  onQuickPublish: () => void
  onPurge: () => void
  onExport: () => void
  onReset: () => void
  running: boolean
  onToggleRunning: () => void
  openDlq: number
}

export default function Header({ activeView, onViewChange, onQuickPublish, onPurge, onExport, onReset, running, onToggleRunning, openDlq }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[72px] items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-mark"><Radio size={21} strokeWidth={1.8} /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[17px] font-semibold tracking-[-0.04em] text-slate-100">EventPulse</span>
                <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-violet-400/70 sm:inline">/ stream lab</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500"><StatusDot pulse={running} color={running ? '#10b981' : '#f59e0b'} /><span className="hidden sm:inline">Broker Cluster:</span><span className={running ? 'text-emerald-400/90' : 'text-amber-400/90'}>{running ? 'Healthy' : 'Paused'} <span className="text-slate-500">(3 Nodes)</span></span></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={running ? 'emerald' : 'amber'} className="hidden lg:inline-flex"><Activity size={11} />{running ? 'LIVE' : 'PAUSED'}</Badge>
            <button type="button" className="button button-secondary hidden sm:inline-flex" onClick={onQuickPublish}><Send size={14} />Publish Test Event</button>
            <button type="button" className="button button-danger-ghost hidden md:inline-flex" onClick={onPurge}><Trash2 size={14} />Purge Topic Buffer</button>
            <button type="button" className="icon-button header-icon" onClick={onToggleRunning} title={running ? 'Pause simulation' : 'Resume simulation'} aria-label={running ? 'Pause simulation' : 'Resume simulation'}>{running ? <Pause size={16} /> : <Play size={16} />}</button>
            <button type="button" className="icon-button header-icon hidden sm:inline-flex" onClick={onExport} title="Export broker snapshot" aria-label="Export broker snapshot"><Download size={16} /></button>
            <button type="button" className="icon-button header-icon hidden lg:inline-flex" onClick={onReset} title="Reset cluster snapshot" aria-label="Reset cluster snapshot"><RotateCcw size={15} /></button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-800/50">
          <nav className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2" aria-label="Workspace sections">
            {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => onViewChange(id)} className={cn('nav-tab', activeView === id && 'nav-tab-active')}><Icon size={15} strokeWidth={activeView === id ? 2 : 1.7} /><span>{label}</span>{id === 'dlq' && openDlq > 0 && <span className="nav-count">{openDlq > 99 ? '99+' : openDlq}</span>}</button>)}
          </nav>
          <div className="hidden shrink-0 items-center gap-2 py-2 font-mono text-[10px] text-slate-600 xl:flex"><span className="h-1 w-1 rounded-full bg-slate-700" />localhost:9092<span className="h-1 w-1 rounded-full bg-slate-700" />v1.4.0</div>
        </div>
        <div className="flex gap-2 pb-3 sm:hidden"><button type="button" className="button button-secondary flex-1" onClick={onQuickPublish}><Send size={14} />Publish Test Event</button><button type="button" className="button button-danger-ghost" onClick={onPurge} aria-label="Purge Topic Buffer"><Trash2 size={14} /></button></div>
      </div>
    </header>
  )
}
