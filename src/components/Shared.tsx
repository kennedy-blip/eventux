import { useEffect, useId, useState, type ReactNode } from 'react'
import { Check, Clipboard, X, type LucideIcon } from 'lucide-react'
import { cn } from '../utils/cn'

export function Panel({ children, className, as: Element = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Element className={cn('panel', className)}>{children}</Element>
}

export function SectionHeading({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-100 sm:text-2xl">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatusDot({ color = '#10b981', pulse = false, className }: { color?: string; pulse?: boolean; className?: string }) {
  return <span className={cn('status-dot', pulse && 'status-dot-pulse', className)} style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}80` }} />
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky'; className?: string }) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>
}

export function MetricCard({ label, value, detail, icon: Icon, accent = '#8b5cf6', spark, className }: { label: string; value: ReactNode; detail?: ReactNode; icon: LucideIcon; accent?: string; spark?: number[]; className?: string }) {
  return (
    <Panel className={cn('relative overflow-hidden p-4 sm:p-5', className)}>
      <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-[0.08] blur-2xl" style={{ backgroundColor: accent }} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className="mt-2 font-mono text-2xl font-medium tracking-[-0.06em] text-slate-100 sm:text-[28px]">{value}</div>
          {detail && <div className="mt-1.5 text-xs text-slate-500">{detail}</div>}
        </div>
        <div className="rounded-xl border p-2.5" style={{ color: accent, borderColor: `${accent}30`, backgroundColor: `${accent}0c` }}><Icon size={17} strokeWidth={1.7} /></div>
      </div>
      {spark && <div className="relative mt-3 -mb-1"><Sparkline values={spark} color={accent} height={32} /></div>}
    </Panel>
  )
}

export function Sparkline({ values, color = '#8b5cf6', height = 40, fill = true, className }: { values: number[]; color?: string; height?: number; fill?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '')
  const width = 240
  const safe = values.length > 1 ? values : [0, ...(values.length ? values : [0])]
  const max = Math.max(...safe, 1)
  const min = Math.min(...safe, 0)
  const range = Math.max(1, max - min)
  const points = safe.map((value, index) => {
    const x = (index / (safe.length - 1)) * width
    const y = height - 4 - ((value - min) / range) * (height - 10)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
  const area = `0,${height} ${points} ${width},${height}`
  return (
    <svg className={cn('block h-auto w-full overflow-visible', className)} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Metric trend">
      <defs><linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {fill && <polygon points={area} fill={`url(#spark-${id})`} />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function ProgressBar({ value, max = 100, color = '#8b5cf6', className, height = 'h-1.5' }: { value: number; max?: number; color?: string; className?: string; height?: string }) {
  const percent = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0))
  return <div className={cn('w-full overflow-hidden rounded-full bg-slate-800/80', height, className)}><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%`, backgroundColor: color, boxShadow: `0 0 12px ${color}55` }} /></div>
}

export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={cn('toggle', checked && 'toggle-on', disabled && 'cursor-not-allowed opacity-40')}><span /></button>
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return <button type="button" className="icon-text-button" onClick={copy}>{copied ? <Check size={13} className="text-emerald-400" /> : <Clipboard size={13} />}{copied ? 'Copied' : label}</button>
}

export function JsonBlock({ value, maxHeight = 'max-h-80', className }: { value: string; maxHeight?: string; className?: string }) {
  const lines = value.split('\n')
  return (
    <div className={cn('json-shell', className)}>
      <div className={cn('overflow-auto', maxHeight)}>
        <pre className="json-code">{lines.map((line, index) => <span key={`${index}-${line}`} className="json-line"><span className="json-line-number">{String(index + 1).padStart(2, '0')}</span><span>{line || ' '}</span></span>)}</pre>
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, eyebrow, children, wide = false }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className={cn('modal-card', wide ? 'max-w-3xl' : 'max-w-lg')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4 sm:px-6">
          <div>{eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}<h3 className="text-lg font-semibold tracking-tight text-slate-100">{title}</h3></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={17} /></button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, eyebrow, children }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="drawer-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
          <div>{eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}<h3 className="truncate text-base font-semibold text-slate-100">{title}</h3></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close details"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-6 py-14 text-center"><div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-slate-500"><Icon size={22} /></div><h3 className="text-sm font-medium text-slate-200">{title}</h3><p className="mt-1.5 max-w-sm text-xs leading-5 text-slate-500">{description}</p>{action && <div className="mt-4">{action}</div>}</div>
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return <div className="mb-2 flex items-center justify-between gap-3"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{children}</label>{hint && <span className="font-mono text-[10px] text-slate-600">{hint}</span>}</div>
}
