'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  Users,
  Zap,
  MapPin,
  Target,
  DollarSign,
} from 'lucide-react'

interface DashboardMetrics {
  this_week: {
    leads_discovered: number
    leads_assigned: number
    leads_contacted: number
    leads_accepted: number
    leads_converted: number
    conversion_rate: string
    avg_lead_score: number
  }
  this_month: {
    leads_discovered: number
    leads_assigned: number
    leads_contacted: number
    leads_accepted: number
    leads_converted: number
    conversion_rate: string
    estimated_revenue: string
  }
  by_product: Array<{
    product: string
    demand_count: number
    conversion_rate: string
  }>
  by_sector: Array<{
    sector: string
    count: number
    avg_score: number
  }>
  by_region: Array<{
    region: string
    count: number
    conversion_rate: string
  }>
  by_state?: Array<{
    state: string
    count: number
    conversion_rate: string
  }>
}

interface Assignment {
  lead_id: string
  officer_id: string
  officer_name: string
  officer_email: string
  assigned_at: string
}

interface ExecutiveDashboardProps {
  metrics: DashboardMetrics
  assignments: Assignment[]
  totalLeads: number
}

export function ExecutiveDashboard({ metrics, assignments, totalLeads }: ExecutiveDashboardProps) {
  // Funnel data
  const funnelData = [
    {
      stage: 'Discovered',
      value: metrics.this_month.leads_discovered,
      fill: '#1E3A5F',
    },
    {
      stage: 'Assigned',
      value: metrics.this_month.leads_assigned,
      fill: '#8B5CF6',
    },
    {
      stage: 'Contacted',
      value: metrics.this_month.leads_contacted,
      fill: '#1B8A8A',
    },
    {
      stage: 'Accepted',
      value: metrics.this_month.leads_accepted,
      fill: '#0F6B3C',
    },
    {
      stage: 'Converted',
      value: metrics.this_month.leads_converted,
      fill: '#FFA500',
    },
  ]

  // Product demand data
  const productData = metrics.by_product.map((p) => ({
    product: p.product.split(' ').slice(0, 2).join(' '),
    demand: p.demand_count,
  }))

  // Sector distribution
  const sectorColors = ['#1E3A5F', '#1B8A8A', '#0F6B3C']
  const sectorData = metrics.by_sector.map((s) => ({
    name: s.sector,
    value: s.count,
  }))

  // Region heatmap (bar chart)
  const regionData = metrics.by_region.map((r) => ({
    region: r.region,
    leads: r.count,
  }))

  // Assignment distribution by officer
  const assignmentsByOfficer = assignments.reduce((acc, assignment) => {
    const name = assignment.officer_name
    acc[name] = (acc[name] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const assignmentColors = [
    '#1E3A5F', '#1B8A8A', '#0F6B3C', '#FFA500', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'
  ]

  const assignedCount = assignments.length
  const unassignedCount = totalLeads - assignedCount

  const assignmentData = [
    ...Object.entries(assignmentsByOfficer).map(([name, count]) => ({
      name,
      value: count,
    })),
    ...(unassignedCount > 0 ? [{ name: 'Unassigned', value: unassignedCount }] : []),
  ]

  // State tile heatmap (India-style)
  const stateRows = (metrics.by_state || []).filter((s) => s && s.state)
  const stateMax = stateRows.reduce((m, s) => Math.max(m, Number(s.count) || 0), 0)
  const stateMin = stateRows.reduce((m, s) => Math.min(m, Number(s.count) || 0), Number.POSITIVE_INFINITY)
  const safeStateMin = Number.isFinite(stateMin) ? stateMin : 0

  const heatColor = (count: number) => {
    if (!stateMax || stateMax <= 0) return 'bg-muted'
    const x = Math.max(0, Math.min(1, (count - safeStateMin) / Math.max(1, stateMax - safeStateMin)))
    // 6-band ramp (PSU-friendly: muted -> teal)
    if (x < 0.12) return 'bg-muted'
    if (x < 0.28) return 'bg-teal-50'
    if (x < 0.45) return 'bg-teal-100'
    if (x < 0.62) return 'bg-teal-200'
    if (x < 0.80) return 'bg-teal-300'
    return 'bg-teal-400'
  }

  const heatLegend = [
    { label: 'Low', cls: 'bg-muted' },
    { label: '', cls: 'bg-teal-50' },
    { label: '', cls: 'bg-teal-100' },
    { label: '', cls: 'bg-teal-200' },
    { label: '', cls: 'bg-teal-300' },
    { label: 'High', cls: 'bg-teal-400' },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="border-border">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">
                  This Week
                </p>
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  {metrics.this_week.leads_discovered}
                </p>
                <p className="text-xs text-accent mt-1 font-medium">New Leads</p>
              </div>
              <div className="bg-primary/10 p-2.5 rounded-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">
                  Conversion
                </p>
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  {metrics.this_week.conversion_rate}
                </p>
                <p className="text-xs text-accent mt-1 font-medium">This Week</p>
              </div>
              <div className="bg-accent/10 p-2.5 rounded-lg">
                <Zap className="w-5 h-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">
                  Avg. Score
                </p>
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  {metrics.this_week.avg_lead_score}%
                </p>
                <p className="text-xs text-accent mt-1 font-medium">Lead Quality</p>
              </div>
              <div className="bg-green-100 p-2.5 rounded-lg">
                <Target className="w-5 h-5 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">
                  Est. Revenue
                </p>
                <p className="text-lg md:text-2xl font-bold text-foreground">
                  {metrics.this_month.estimated_revenue}
                </p>
                <p className="text-xs text-accent mt-1 font-medium">This Month</p>
              </div>
              <div className="bg-amber-100 p-2.5 rounded-lg">
                <DollarSign className="w-5 h-5 text-amber-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel & Product Demand */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        {/* Sales Funnel */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sales Funnel</CardTitle>
            <p className="text-sm text-muted-foreground">This Month</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnelData.map((stage, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {stage.stage}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {stage.value}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(stage.value / funnelData[0].value) * 100}%`,
                        backgroundColor: stage.fill,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Products by Demand */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Top Products</CardTitle>
            <p className="text-sm text-muted-foreground">By Demand Count</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 12%, 88%)" />
                <XAxis dataKey="product" stroke="hsl(210, 12%, 45%)" fontSize={12} />
                <YAxis stroke="hsl(210, 12%, 45%)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(0, 0%, 100%)',
                    border: '1px solid hsl(210, 12%, 88%)',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar dataKey="demand" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Assignments & Sector Distribution */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        {/* Officer Assignments */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Lead Assignments</CardTitle>
            <p className="text-sm text-muted-foreground">By Officer</p>
          </CardHeader>
          <CardContent>
            {assignmentData.length === 0 ? (
              <div className="flex items-center justify-center h-[240px]">
                <p className="text-sm text-muted-foreground">No leads assigned yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={assignmentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {assignmentData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === 'Unassigned' ? '#94a3b8' : assignmentColors[index % assignmentColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(210, 12%, 88%)',
                      borderRadius: '0.5rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Sector Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">By Sector</CardTitle>
            <p className="text-sm text-muted-foreground">Lead Distribution</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sectorData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={sectorColors[index % sectorColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(0, 0%, 100%)',
                    border: '1px solid hsl(210, 12%, 88%)',
                    borderRadius: '0.5rem',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Geography Heatmap */}
      <div className="grid md:grid-cols-1 gap-4 md:gap-6">
        {/* Geography Heatmap (States) */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Geography Heatmap</CardTitle>
            <p className="text-sm text-muted-foreground">Leads by State (tile heatmap)</p>
          </CardHeader>
          <CardContent>
            {stateRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No state-level data available yet.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-4 h-4 text-accent" />
                    <span>
                      Scale: {safeStateMin} → {stateMax} leads
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {heatLegend.map((h, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className={`w-4 h-3 rounded ${h.cls} border border-border`} />
                        {h.label ? (
                          <span className="text-[10px] text-muted-foreground">{h.label}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                  {stateRows.map((s) => {
                    const count = Number(s.count) || 0
                    const label = `${s.state} • ${count} leads • ${s.conversion_rate} conv.`
                    return (
                      <div
                        key={s.state}
                        title={label}
                        className="group rounded-md border border-border bg-card p-2 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {s.state}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {count} leads
                            </p>
                          </div>
                          <div className={`w-4 h-4 rounded ${heatColor(count)} border border-border flex-shrink-0`} />
                        </div>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${stateMax ? Math.round((count / stateMax) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card className="border-border bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Discovered</p>
              <p className="text-2xl font-bold" style={{ color: '#1E3A5F' }}>
                {metrics.this_month.leads_discovered}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Assigned</p>
              <p className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>
                {metrics.this_month.leads_assigned}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Contacted</p>
              <p className="text-2xl font-bold" style={{ color: '#1B8A8A' }}>
                {metrics.this_month.leads_contacted}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Accepted</p>
              <p className="text-2xl font-bold" style={{ color: '#0F6B3C' }}>
                {metrics.this_month.leads_accepted}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Converted</p>
              <p className="text-2xl font-bold" style={{ color: '#FFA500' }}>
                {metrics.this_month.leads_converted}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
