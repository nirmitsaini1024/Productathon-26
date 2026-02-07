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
    leads_contacted: number
    leads_accepted: number
    leads_converted: number
    conversion_rate: string
    avg_lead_score: number
  }
  this_month: {
    leads_discovered: number
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
}

interface ExecutiveDashboardProps {
  metrics: DashboardMetrics
}

export function ExecutiveDashboard({ metrics }: ExecutiveDashboardProps) {
  // Funnel data
  const funnelData = [
    {
      stage: 'Discovered',
      value: metrics.this_month.leads_discovered,
      fill: '#1E3A5F',
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

      {/* Sector Distribution & Region Heatmap */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
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

        {/* Regional Performance */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">By Region</CardTitle>
            <p className="text-sm text-muted-foreground">Lead Count & Conversion</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.by_region.map((region, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-foreground">
                        {region.region}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {region.count} leads
                      </Badge>
                      <span className="text-xs font-semibold text-foreground">
                        {region.conversion_rate}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{
                        width: `${parseInt(region.conversion_rate)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card className="border-border bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Total Discovered</p>
              <p className="text-2xl font-bold text-foreground">
                {metrics.this_month.leads_discovered}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Contacted</p>
              <p className="text-2xl font-bold text-accent">
                {metrics.this_month.leads_contacted}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Accepted</p>
              <p className="text-2xl font-bold text-green-700">
                {metrics.this_month.leads_accepted}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Converted</p>
              <p className="text-2xl font-bold text-amber-700">
                {metrics.this_month.leads_converted}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
