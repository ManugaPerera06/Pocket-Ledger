import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Filter,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type TransactionType = 'INCOME' | 'EXPENSE'

type Transaction = {
  id: number
  transaction_date: string
  description: string
  category: string
  type: TransactionType
  amount: number
}

type TrendPoint = { date: string; income: number; expenses: number }
type CategoryPoint = { category: string; amount: number }
type Summary = {
  total_balance: number
  total_income: number
  total_expenses: number
  current_month_income: number
  current_month_expenses: number
  net_savings: number
  month: string
  trend: TrendPoint[]
  category_breakdown: CategoryPoint[]
  recent_transactions: Transaction[]
  categories: string[]
}

type Filters = { q: string; type: string; category: string; from: string; to: string }
type FormState = { transaction_date: string; description: string; category: string; type: TransactionType; amount: string }

const defaultCategories = ['Food', 'Education & Classes', 'Shopping', 'Outings & Social', 'Family', 'Health', 'Personal Care', 'Savings', 'Loans', 'Transport', 'Bills', 'Uncategorized']
const pieColors = ['#818cf8', '#34d399', '#fb7185', '#fbbf24', '#38bdf8', '#c084fc', '#f97316', '#94a3b8']
const emptySummary: Summary = {
  total_balance: 0,
  total_income: 0,
  total_expenses: 0,
  current_month_income: 0,
  current_month_expenses: 0,
  net_savings: 0,
  month: '',
  trend: [],
  category_breakdown: [],
  recent_transactions: [],
  categories: [],
}

const today = () => new Date().toISOString().slice(0, 10)

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.')
  return payload as T
}

function money(value: number, signed = false) {
  const sign = signed ? (value >= 0 ? '+' : '-') : ''
  return `${sign}Rs. ${Math.abs(value).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function monthLabel(value: string) {
  if (!value) return 'This month'
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T00:00:00`))
}

function App() {
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filters, setFilters] = useState<Filters>({ q: '', type: '', category: '', from: '', to: '' })
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const categories = useMemo(() => Array.from(new Set([...defaultCategories, ...summary.categories])), [summary.categories])

  const loadSummary = async () => {
    const result = await api<Summary>('/api/summary')
    setSummary(result)
  }

  const loadTransactions = async (nextFilters = filters) => {
    const params = new URLSearchParams()
    Object.entries(nextFilters).forEach(([key, value]) => { if (value) params.set(key, value) })
    const result = await api<{ transactions: Transaction[] }>(`/api/transactions?${params.toString()}`)
    setTransactions(result.transactions)
  }

  const refresh = async () => {
    setLoading(true)
    try {
      await Promise.all([loadSummary(), loadTransactions()])
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load your ledger.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (loading) return
    const timer = window.setTimeout(async () => {
      setTableLoading(true)
      try { await loadTransactions(filters) } catch (error) { setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not filter transactions.' }) } finally { setTableLoading(false) }
    }, 220)
    return () => window.clearTimeout(timer)
  }, [filters])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (transaction: Transaction) => { setEditing(transaction); setModalOpen(true) }
  const resetFilters = () => setFilters({ q: '', type: '', category: '', from: '', to: '' })

  const handleSave = async (form: FormState) => {
    try {
      const options: RequestInit = { method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...form, amount: Number(form.amount) }) }
      await api<Transaction>(editing ? `/api/transactions/${editing.id}` : '/api/transactions', options)
      setModalOpen(false)
      setToast({ kind: 'success', message: editing ? 'Transaction updated.' : 'Transaction added to your ledger.' })
      await Promise.all([loadSummary(), loadTransactions(filters)])
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not save transaction.' })
    }
  }

  const handleDelete = async (transaction: Transaction) => {
    if (!window.confirm(`Delete “${transaction.description}” from your ledger?`)) return
    try {
      await api(`/api/transactions/${transaction.id}`, { method: 'DELETE' })
      setToast({ kind: 'success', message: 'Transaction deleted.' })
      await Promise.all([loadSummary(), loadTransactions(filters)])
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not delete transaction.' })
    }
  }

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col border-r border-white/[0.06] bg-[#0d1627] px-5 py-5 transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-950/30"><span className="text-sm font-black tracking-tight">PL</span></div>
              <div><div className="font-semibold tracking-tight text-white">Pocket Ledger</div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Your cash, clearer</div></div>
            </div>
            <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white lg:hidden"><X size={18} /></button>
          </div>

          <div className="mt-12 space-y-1">
            <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Workspace</div>
            <button className="flex w-full items-center gap-3 rounded-xl bg-indigo-500/10 px-3 py-3 text-left text-sm font-semibold text-indigo-300"><LayoutDashboard size={17} /> Overview</button>
            <button onClick={() => document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' })} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100"><BookOpen size={17} /> Cash book</button>
          </div>

          <div className="mt-auto rounded-2xl border border-indigo-400/15 bg-indigo-500/[0.07] p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300"><Sparkles size={17} /></div>
            <div className="text-sm font-semibold text-slate-200">Small picture, in view.</div>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">Keep the everyday choices visible. The bigger picture follows.</p>
          </div>
          <div className="mt-5 px-1 text-[11px] text-slate-600">Personal workspace · {new Date().getFullYear()}</div>
        </aside>

        {sidebarOpen && <button aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden" />}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/[0.06] bg-ink/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 lg:hidden"><Menu size={18} /></button><div><div className="eyebrow">Friday, {new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' }).format(new Date())}</div><h1 className="mt-1 text-lg font-semibold tracking-tight text-white sm:text-xl">Your money at a glance</h1></div></div>
            <button onClick={openCreate} className="btn-primary"><Plus size={17} strokeWidth={2.5} /><span className="hidden sm:inline">Add transaction</span><span className="sm:hidden">Add</span></button>
          </header>

          <div className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
            <section className="mb-8 grid gap-4 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
              <MetricCard label="Total balance" value={money(summary.total_balance)} icon={<WalletCards size={18} />} accent="indigo" helper="Across your full cash book" loading={loading} primary />
              <MetricCard label="Month income" value={money(summary.current_month_income)} icon={<ArrowDownLeft size={18} />} accent="mint" helper={monthLabel(summary.month)} loading={loading} />
              <MetricCard label="Month expenses" value={money(summary.current_month_expenses)} icon={<ArrowUpRight size={18} />} accent="rose" helper={monthLabel(summary.month)} loading={loading} />
              <MetricCard label="Net savings" value={money(summary.net_savings, true)} icon={<TrendingUp size={18} />} accent="amber" helper="Income less expenses" loading={loading} />
            </section>

            <section className="mb-8 grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
              <div className="panel min-h-[360px] p-5 sm:p-6">
                <div className="mb-7 flex items-start justify-between"><div><div className="flex items-center gap-2"><span className="eyebrow">Cash flow</span><span className="rounded-md bg-indigo-400/10 px-2 py-1 text-[10px] font-medium text-indigo-300">90 days</span></div><h2 className="mt-2 text-lg font-semibold text-white">Spending trend</h2></div><div className="rounded-xl bg-white/[0.04] p-2 text-slate-500"><TrendingUp size={17} /></div></div>
                <div className="h-[244px] w-full">
                  {loading ? <ChartSkeleton /> : summary.trend.length === 0 ? <EmptyChart copy="Your trend will appear after the first transaction." /> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.trend} margin={{ top: 5, right: 4, left: -18, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.25} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity={0.18} /><stop offset="100%" stopColor="#fb7185" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => dateLabel(value)} tickLine={false} axisLine={false} minTickGap={32} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`} /><Tooltip content={<TrendTooltip />} /><Area type="monotone" dataKey="income" name="Income" stroke="#34d399" strokeWidth={2} fill="url(#incomeFill)" connectNulls /><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#fb7185" strokeWidth={2} fill="url(#expenseFill)" connectNulls /></AreaChart></ResponsiveContainer>}
                </div>
                <div className="mt-4 flex gap-5 text-xs text-slate-500"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-400" /> Income</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-rose-400" /> Expenses</span></div>
              </div>

              <div className="panel min-h-[360px] p-5 sm:p-6"><div className="mb-4 flex items-start justify-between"><div><span className="eyebrow">Where it goes</span><h2 className="mt-2 text-lg font-semibold text-white">Expense mix</h2></div><div className="rounded-xl bg-white/[0.04] p-2 text-slate-500"><Tag size={17} /></div></div><div className="relative h-[205px]">{loading ? <ChartSkeleton /> : summary.category_breakdown.length === 0 ? <EmptyChart copy="Add an expense to see your mix." /> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.category_breakdown} dataKey="amount" nameKey="category" innerRadius={58} outerRadius={82} paddingAngle={4} stroke="none">{summary.category_breakdown.map((entry, index) => <Cell key={entry.category} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip content={<PieTooltip />} /></PieChart></ResponsiveContainer>} {summary.category_breakdown.length > 0 && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-semibold text-white">{money(summary.total_expenses)}</span><span className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">all time</span></div>}</div><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">{summary.category_breakdown.slice(0, 4).map((item, index) => <div key={item.category} className="flex min-w-0 items-center gap-2 text-xs text-slate-400"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} /><span className="truncate">{item.category}</span><span className="ml-auto text-slate-500">{money(item.amount)}</span></div>)}</div></div>
            </section>

            <section id="transactions" className="panel overflow-hidden">
              <div className="border-b border-white/[0.06] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><div className="flex items-center gap-2"><span className="eyebrow">All activity</span><span className="rounded-md bg-white/[0.05] px-2 py-1 text-[10px] font-semibold text-slate-500">{transactions.length} shown</span></div><h2 className="mt-2 text-lg font-semibold text-white">Cash book</h2></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative sm:w-60"><Search size={16} className="absolute left-3 top-3 text-slate-600" /><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search transactions" className="field pl-9" /></div><button onClick={openCreate} className="btn-ghost"><Plus size={16} /> New entry</button></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto_1fr_auto_1fr_auto] sm:items-center lg:flex lg:flex-wrap"><FilterSelect value={filters.type} onChange={(value) => setFilters({ ...filters, type: value })} icon={<Filter size={14} />} options={[['', 'All types'], ['INCOME', 'Income'], ['EXPENSE', 'Expenses']]} /><FilterSelect value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })} icon={<Tag size={14} />} options={[['', 'All categories'], ...categories.map((category) => [category, category])]} /><label className="relative"><CalendarDays size={14} className="absolute left-3 top-3 text-slate-600" /><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="field pl-9 text-xs text-slate-400" /></label><span className="hidden text-center text-xs font-medium text-slate-600 sm:block">to</span><label className="relative"><CalendarDays size={14} className="absolute left-3 top-3 text-slate-600" /><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="field pl-9 text-xs text-slate-400" /></label><button type="button" onClick={resetFilters} className="btn-ghost h-11 px-3 text-xs" title="Reset filters"><RotateCcw size={14} /> <span className="hidden lg:inline">Reset</span></button></div></div>
              <div className="relative overflow-x-auto">{tableLoading && <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-indigo-500/20"><div className="h-full w-1/3 animate-pulse bg-indigo-400" /></div>}<table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-600"><tr><th className="px-5 py-4 font-semibold sm:px-6">Date</th><th className="px-5 py-4 font-semibold">Description</th><th className="px-5 py-4 font-semibold">Category</th><th className="px-5 py-4 font-semibold">Type</th><th className="px-5 py-4 text-right font-semibold sm:px-6">Amount</th><th className="w-20 px-3 py-4" /></tr></thead><tbody className="divide-y divide-white/[0.045]">{transactions.map((transaction) => <tr key={transaction.id} className="group transition hover:bg-white/[0.025]"><td className="whitespace-nowrap px-5 py-4 text-slate-400 sm:px-6">{dateLabel(transaction.transaction_date)}</td><td className="max-w-[270px] truncate px-5 py-4 font-medium text-slate-200">{transaction.description}</td><td className="px-5 py-4"><span className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs text-slate-400">{transaction.category}</span></td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${transaction.type === 'INCOME' ? 'text-emerald-300' : 'text-rose-300'}`}><i className={`h-1.5 w-1.5 rounded-full ${transaction.type === 'INCOME' ? 'bg-emerald-400' : 'bg-rose-400'}`} />{transaction.type === 'INCOME' ? 'Income' : 'Expense'}</span></td><td className={`whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums sm:px-6 ${transaction.type === 'INCOME' ? 'text-emerald-300' : 'text-slate-200'}`}>{transaction.type === 'INCOME' ? '+' : '-'}{money(transaction.amount)}</td><td className="px-3 py-4"><div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100"><button aria-label="Edit transaction" onClick={() => openEdit(transaction)} className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-indigo-300"><Pencil size={14} /></button><button aria-label="Delete transaction" onClick={() => handleDelete(transaction)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button></div></td></tr>)}{!loading && transactions.length === 0 && <tr><td colSpan={6} className="px-6 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-600"><ReceiptText size={20} /></div><div className="mt-4 text-sm font-medium text-slate-300">No transactions match those filters.</div><div className="mt-1 text-xs text-slate-600">Try a different search or add a fresh entry.</div></td></tr>}</tbody></table></div>
            </section>
          </div>
        </main>
      </div>

      {toast && <div className={`fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${toast.kind === 'success' ? 'border-emerald-400/20 bg-emerald-950/90 text-emerald-200' : 'border-rose-400/20 bg-rose-950/90 text-rose-200'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${toast.kind === 'success' ? 'bg-emerald-400/15' : 'bg-rose-400/15'}`}>{toast.kind === 'success' ? <Check size={14} /> : <X size={14} />}</span>{toast.message}</div>}
      {modalOpen && <TransactionModal transaction={editing} categories={categories} onClose={() => setModalOpen(false)} onSave={handleSave} />}
    </div>
  )
}

function MetricCard({ label, value, helper, icon, accent, loading, primary = false }: { label: string; value: string; helper: string; icon: React.ReactNode; accent: 'indigo' | 'mint' | 'rose' | 'amber'; loading: boolean; primary?: boolean }) {
  const accents = { indigo: 'border-indigo-400/35 before:bg-indigo-400', mint: 'border-emerald-400/20 before:bg-emerald-400', rose: 'border-rose-400/20 before:bg-rose-400', amber: 'border-amber-400/20 before:bg-amber-400' }
  const iconColors = { indigo: 'bg-indigo-400/10 text-indigo-300', mint: 'bg-emerald-400/10 text-emerald-300', rose: 'bg-rose-400/10 text-rose-300', amber: 'bg-amber-400/10 text-amber-300' }
  return <div className={`panel relative overflow-hidden p-5 before:absolute before:inset-x-0 before:top-0 before:h-px ${accents[accent]} ${primary ? 'min-h-[150px]' : 'min-h-[150px]'}`}><div className="flex items-start justify-between"><span className="eyebrow">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconColors[accent]}`}>{icon}</span></div>{loading ? <div className="mt-5 h-8 w-28 animate-pulse rounded bg-white/10" /> : <div className="mt-5 text-[26px] font-semibold tracking-tight text-white sm:text-[28px]">{value}</div>}<div className="mt-2 text-xs text-slate-500">{helper}</div></div>
}

function FilterSelect({ value, onChange, icon, options }: { value: string; onChange: (value: string) => void; icon: React.ReactNode; options: string[][] }) {
  return <label className="relative"><span className="pointer-events-none absolute left-3 top-3 z-10 text-slate-600">{icon}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="field appearance-none pl-9 pr-8 text-xs text-slate-400 [&>option]:bg-white [&>option]:text-slate-900">{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-slate-600" /></label>
}

function ChartSkeleton() { return <div className="h-full w-full animate-pulse rounded-xl bg-white/[0.03]" /> }
function EmptyChart({ copy }: { copy: string }) { return <div className="flex h-full items-center justify-center px-8 text-center text-xs leading-5 text-slate-600">{copy}</div> }
function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) { if (!active || !payload?.length) return null; return <div className="rounded-xl border border-white/10 bg-[#111a2d]/95 px-3 py-2.5 text-xs shadow-xl"><div className="mb-1.5 text-slate-500">{label ? dateLabel(label) : ''}</div>{payload.map((item) => <div key={item.name} className="flex items-center justify-between gap-5 py-0.5"><span className="flex items-center gap-1.5 text-slate-300"><i className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />{item.name}</span><span className="font-semibold text-white">{money(item.value)}</span></div>)}</div> }
function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) { if (!active || !payload?.length) return null; return <div className="rounded-xl border border-white/10 bg-[#111a2d]/95 px-3 py-2.5 text-xs shadow-xl"><span className="text-slate-400">{payload[0].name}</span><div className="mt-1 font-semibold text-white">{money(Number(payload[0].value))}</div></div> }

function TransactionModal({ transaction, categories, onClose, onSave }: { transaction: Transaction | null; categories: string[]; onClose: () => void; onSave: (form: FormState) => Promise<void> }) {
  const [form, setForm] = useState<FormState>({ transaction_date: transaction?.transaction_date || today(), description: transaction?.description || '', category: transaction?.category || categories[0] || 'Uncategorized', type: transaction?.type || 'EXPENSE', amount: transaction ? String(transaction.amount) : '' })
  const [saving, setSaving] = useState(false)
  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { await onSave(form) } finally { setSaving(false) } }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#111a2d] p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between"><div><span className="eyebrow">{transaction ? 'Edit entry' : 'New entry'}</span><h2 className="mt-2 text-xl font-semibold text-white">{transaction ? 'Update transaction' : 'Add to cash book'}</h2></div><button aria-label="Close modal" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={19} /></button></div><form onSubmit={submit} className="mt-6 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-medium text-slate-400">Date</span><input required type="date" value={form.transaction_date} onChange={(event) => set('transaction_date', event.target.value)} className="field" /></label><label><span className="mb-1.5 block text-xs font-medium text-slate-400">Amount (Rs.)</span><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => set('amount', event.target.value)} placeholder="0.00" className="field" /></label></div><label><span className="mb-1.5 block text-xs font-medium text-slate-400">Description</span><input required maxLength={240} value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="What was this for?" className="field" /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-medium text-slate-400">Category</span><select required value={form.category} onChange={(event) => set('category', event.target.value)} className="field text-slate-100 [&>option]:bg-white [&>option]:text-slate-900">{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-medium text-slate-400">Type</span><select value={form.type} onChange={(event) => set('type', event.target.value as TransactionType)} className="field text-slate-100 [&>option]:bg-white [&>option]:text-slate-900"><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select></label></div><div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="btn-ghost">Cancel</button><button disabled={saving} type="submit" className="btn-primary disabled:cursor-wait disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}{transaction ? 'Save changes' : 'Add transaction'}</button></div></form></div></div>
}

export default App
