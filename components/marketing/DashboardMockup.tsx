'use client'

import {
  LayoutDashboard,
  Package,
  PackageCheck,
  DollarSign,
  UtensilsCrossed,
  Truck,
  ScanLine,
  Trash2,
  Shield,
  Users,
  Clock,
  PoundSterling,
  FileText,
  Activity,
  Plug,
  Settings,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Bell,
  Search,
} from 'lucide-react'

interface DashboardMockupProps {
  className?: string
  compact?: boolean
}

const sidebarSections = [
  {
    label: '',
    items: [{ icon: LayoutDashboard, title: 'Dashboard', active: true }],
  },
  {
    label: 'STOCK',
    items: [
      { icon: Package, title: 'Inventory' },
      { icon: PackageCheck, title: 'Stock Reception' },
      { icon: DollarSign, title: 'Stock Costs' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { icon: UtensilsCrossed, title: 'Menu & Costs' },
      { icon: Truck, title: 'Suppliers' },
      { icon: ScanLine, title: 'Invoices' },
      { icon: Trash2, title: 'Waste Tracking' },
      { icon: Shield, title: 'Food Safety' },
    ],
  },
  {
    label: 'TEAM',
    items: [
      { icon: Users, title: 'Team' },
      { icon: Clock, title: 'Shifts' },
      { icon: PoundSterling, title: 'Payroll' },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { icon: FileText, title: 'Reports' },
      { icon: Activity, title: 'Activity Log' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { icon: Plug, title: 'Integrations' },
      { icon: Settings, title: 'Settings' },
      { icon: CreditCard, title: 'Billing' },
    ],
  },
]

export function DashboardMockup({ className = '', compact = false }: DashboardMockupProps) {
  return (
    <div
      className={`rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden select-none ${className}`}
      style={{ fontSize: compact ? '10px' : '12px' }}
    >
      {/* Top navbar — matches real Navbar */}
      <div className="flex items-center justify-between bg-[#1f1d1a] px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-primary flex items-center justify-center">
            <span className="text-[9px] font-bold text-primary-foreground">R</span>
          </div>
          <span className="text-[11px] font-semibold text-white/90">RestaurantOS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 rounded-md bg-white/5 px-2 py-1">
            <Search className="h-3 w-3 text-white/40" />
            <span className="text-[8px] text-white/40">Search...</span>
          </div>
          <div className="relative">
            <Bell className="h-3.5 w-3.5 text-white/60" />
            <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </div>
          <div className="h-5 w-5 rounded-full bg-primary/80 flex items-center justify-center">
            <span className="text-[8px] font-semibold text-white">TK</span>
          </div>
        </div>
      </div>

      <div className="flex" style={{ height: compact ? '320px' : '420px' }}>
        {/* Sidebar — matches real Sidebar exactly */}
        <div className="hidden sm:flex w-[150px] shrink-0 flex-col border-r border-border/40 bg-[#faf8f5] overflow-hidden">
          {/* Store selector */}
          <div className="flex items-center gap-1.5 border-b border-border/40 px-2.5 py-2">
            <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-[7px] font-bold text-primary">M</span>
            </div>
            <span className="text-[9px] font-medium text-[#2d2a26] truncate">My Restaurant</span>
          </div>

          {/* Nav items */}
          <div className="flex-1 overflow-y-auto px-1.5 py-1.5 space-y-0.5" style={{ scrollbarWidth: 'none' }}>
            {sidebarSections.map((section, sIdx) => (
              <div key={sIdx}>
                {sIdx > 0 && <div className="my-1 h-px bg-border/40" />}
                {section.label && (
                  <p className="px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-[#8a8279]/60">
                    {section.label}
                  </p>
                )}
                {section.items.map((item, iIdx) => (
                  <MockSidebarItem
                    key={iIdx}
                    icon={item.icon}
                    label={item.title}
                    active={'active' in item && item.active}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 p-3 bg-[#faf8f5] min-w-0 overflow-hidden">
          {/* Page heading */}
          <div className="mb-3">
            <div className="text-[13px] font-semibold text-[#2d2a26]">Dashboard</div>
            <div className="text-[9px] text-[#8a8279]">Wednesday 26 Feb 2026</div>
          </div>

          {/* Stat cards row */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            <MockStatCard label="Total Items" value="142" color="text-[#2d2a26]" />
            <MockStatCard
              label="Low Stock"
              value="8"
              color="text-[#b58a3a]"
              icon={<AlertTriangle className="h-2.5 w-2.5" />}
            />
            <MockStatCard
              label="Out of Stock"
              value="0"
              color="text-[#2d7a4f]"
              icon={<TrendingUp className="h-2.5 w-2.5" />}
            />
            <MockStatCard label="Waste (MTD)" value="£34" color="text-[#c4432b]" />
          </div>

          {/* Chart + Activity side by side */}
          <div className="grid grid-cols-5 gap-2">
            {/* Chart */}
            <div className="col-span-3 rounded-lg border border-border/40 bg-white p-2">
              <div className="text-[9px] font-medium text-[#2d2a26] mb-1.5">Stock Levels This Week</div>
              <div className="flex items-end gap-0.5 h-10">
                {[65, 72, 58, 80, 75, 85, 90].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full rounded-sm bg-primary/70"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-0.5">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span key={i} className="text-[6px] text-[#8a8279] flex-1 text-center">{d}</span>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div className="col-span-2 rounded-lg border border-border/40 bg-white p-2">
              <div className="text-[9px] font-medium text-[#2d2a26] mb-1.5">Recent Activity</div>
              <div className="space-y-1">
                <MockActivityRow action="Stock count completed" time="2m" color="bg-[#2d7a4f]" />
                <MockActivityRow action="Delivery — Sysco Foods" time="1h" color="bg-[#b58a3a]" />
                <MockActivityRow action="Low stock — Chicken" time="3h" color="bg-[#c4432b]" />
                <MockActivityRow action="Temp check logged" time="4h" color="bg-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockSidebarItem({
  icon: Icon,
  label,
  active = false,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[9px] font-medium transition-colors ${
        active
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-[#8a8279]'
      }`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  )
}

function MockStatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: string
  color: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-white p-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[7px] text-[#8a8279] uppercase tracking-wider">{label}</span>
        {icon && <span className={color}>{icon}</span>}
      </div>
      <div className={`text-[14px] font-bold ${color}`}>{value}</div>
    </div>
  )
}

function MockActivityRow({
  action,
  time,
  color,
}: {
  action: string
  time: string
  color: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-1.5 w-1.5 rounded-full ${color} shrink-0`} />
      <span className="text-[8px] text-[#2d2a26] truncate flex-1">{action}</span>
      <span className="text-[7px] text-[#8a8279] shrink-0">{time}</span>
    </div>
  )
}
