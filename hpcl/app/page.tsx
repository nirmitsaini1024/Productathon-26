'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LeadCard } from '@/components/lead-card'
import { LeadDossier } from '@/components/lead-dossier'
import { ExecutiveDashboard } from '@/components/executive-dashboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  Search,
  Settings,
  Bell,
  BarChart3,
  MessageCircle,
  Rss,
  Zap,
  Filter,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'

interface Lead {
  id: string
  company_name: string
  location: {
    city: string
    state: string
    region: string
  }
  industry: string
  website: string
  company_size: string
  lead_score: number
  urgency: 'High' | 'Medium' | 'Low'
  confidence: number
  signals: Array<{
    type: string
    keyword: string
    source: string
    date: string
    trust_score: number
    summary: string
  }>
  products_recommended: Array<{
    product_name: string
    confidence: number
    reason_code: string
    estimated_volume: string
    margin_potential: string
  }>
  next_actions: {
    suggested_action: string
    timing: string
    context: string
    contact_trigger: string
  }
  sales_owner: string
  field_officer: string
  status: 'new' | 'accepted' | 'rejected' | 'converted'
  notes: string
  created_at: string
}

interface MockData {
  leads: Lead[]
  dashboard_metrics: {
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
}

interface NewsRssItem {
  id: string
  title: string | null
  link: string | null
  description: string | null
  content: string | null
  pubDate: string | null
  pubDateRaw: string | null
  source: string | null
  channelTitle: string | null
  keywordsMatched: string[]
}

interface Assignment {
  lead_id: string
  officer_id: string
  officer_name: string
  officer_email: string
  assigned_at: string
}

export default function Home() {
  const [data, setData] = useState<MockData | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [newsItems, setNewsItems] = useState<NewsRssItem[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsSearch, setNewsSearch] = useState('')

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, Assignment>>(new Map())

  const loadAssignments = async () => {
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
      const url = `${apiBase}/api/assignments`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to load assignments (${res.status})`)
      const json = await res.json()

      const items = Array.isArray(json?.items) ? (json.items as Assignment[]) : []
      setAssignments(items)
      
      // Create a map for quick lookup
      const map = new Map<string, Assignment>()
      items.forEach((assignment) => {
        map.set(assignment.lead_id, assignment)
      })
      setAssignmentsMap(map)
    } catch (error) {
      console.error('Failed to load assignments:', error)
    }
  }

  // Load data from backend (MongoDB)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadError(null)
        const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
        const url = `${apiBase}/api/leads?limit=200`

        const res = await fetch(url)
        if (!res.ok) throw new Error(`Backend API failed (${res.status}) at ${url}`)
        const json = await res.json()

        const apiLeads = Array.isArray(json?.leads) ? (json.leads as Lead[]) : []
        const metrics = json?.dashboard_metrics as MockData['dashboard_metrics'] | undefined
        if (!metrics) throw new Error('No dashboard_metrics returned from backend')

        const payload: MockData = { leads: apiLeads, dashboard_metrics: metrics }

        setData(payload)
        setLeads(payload.leads)
        setFilteredLeads(payload.leads)
        setLoading(false)
      } catch (error) {
        console.error('Failed to load backend data:', error)
        setLoadError(error instanceof Error ? error.message : String(error))
        setLoading(false)
      }
    }

    loadData()
    loadAssignments()
  }, [])

  const loadNews = async () => {
    try {
      setNewsError(null)
      setNewsLoading(true)
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
      const url = `${apiBase}/api/news-rss?limit=200`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`Backend API failed (${res.status}) at ${url}`)
      const json = await res.json()
      const items = Array.isArray(json?.items) ? (json.items as NewsRssItem[]) : []
      setNewsItems(items)
    } catch (error) {
      console.error('Failed to load news RSS:', error)
      setNewsError(error instanceof Error ? error.message : String(error))
    } finally {
      setNewsLoading(false)
    }
  }

  useEffect(() => {
    loadNews()
  }, [])

  const filteredNews = newsSearch.trim()
    ? newsItems.filter((it) => {
        const q = newsSearch.toLowerCase()
        const hay = `${it.title || ''}\n${it.source || ''}\n${it.channelTitle || ''}\n${(it.keywordsMatched || []).join(
          ',',
        )}`.toLowerCase()
        return hay.includes(q)
      })
    : newsItems

  const formatNewsDate = (it: NewsRssItem) => {
    const raw = it.pubDate || it.pubDateRaw
    if (!raw) return null
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleString()
  }

  // Filter and search leads
  useEffect(() => {
    let filtered = leads

    if (searchQuery) {
      filtered = filtered.filter(
        (lead) =>
          lead.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.location.city.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (urgencyFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.urgency === urgencyFilter)
    }

    if (stateFilter !== 'all') {
      filtered = filtered.filter(
        (lead) => (lead.location.state || '').toLowerCase() === stateFilter.toLowerCase()
      )
    }

    setFilteredLeads(filtered.sort((a, b) => b.lead_score - a.lead_score))
  }, [searchQuery, urgencyFilter, stateFilter, leads])

  const urgencyOptions = Array.from(
    new Set(leads.map((l) => String(l.urgency || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  // Handle status change
  const handleStatusChange = (leadId: string, status: string, notes: string) => {
    setLeads((prevLeads) =>
      prevLeads.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              status: status as 'new' | 'accepted' | 'rejected' | 'converted',
              notes,
            }
          : lead
      )
    )
  }

  const selectedLead = leads.find((l) => l.id === selectedLeadId)

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading HPCL Sales Intelligence...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive font-medium">Unable to load application data.</p>
            <p className="text-muted-foreground text-sm mt-2">
              Please ensure the backend API is running and MongoDB is configured.
            </p>
            {loadError && (
              <p className="text-xs text-muted-foreground mt-3 break-words">
                Error: {loadError}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Set <span className="font-mono">NEXT_PUBLIC_API_BASE_URL</span> (defaults to{' '}
              <span className="font-mono">http://localhost:4000</span>).
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (selectedLead) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg md:text-xl font-bold text-foreground hidden sm:block">
                HPCL Direct Sales
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="border-border bg-transparent">
                <Link href="/officer-onboarding">Officer Onboarding</Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <LeadDossier
            lead={selectedLead}
            onBack={() => setSelectedLeadId(null)}
            onStatusChange={handleStatusChange}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-foreground hidden sm:block">
              HPCL Direct Sales
            </h1>
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Sales Intelligence Platform
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="border-border bg-transparent">
              <Link href="/officer-onboarding">Officer Onboarding</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 text-muted-foreground hover:text-foreground"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:text-foreground"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Tabs defaultValue="leads" className="w-full">
          {/* Tabs Navigation */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger
                value="leads"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <MessageCircle className="w-4 h-4 md:hidden" />
                <span className="hidden sm:inline">Tender RSS Feed</span>
                <span className="sm:hidden">Tender</span>
              </TabsTrigger>
              <TabsTrigger
                value="news"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Rss className="w-4 h-4 md:hidden" />
                <span className="hidden sm:inline">News RSS Feed</span>
                <span className="sm:hidden">News</span>
              </TabsTrigger>
              <TabsTrigger
                value="dashboard"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <BarChart3 className="w-4 h-4 md:hidden" />
                <span className="hidden sm:inline">Executive Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Bell className="w-4 h-4 md:hidden" />
                <span className="hidden sm:inline">Notifications</span>
                <span className="sm:hidden">Alerts</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-6">
            {/* Search & Filters */}
            <div className="space-y-3 md:flex md:gap-3 md:space-y-0">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by company or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  className="h-10 px-3 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="all">All Urgency</option>
                  {urgencyOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="h-10 px-3 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="all">All States</option>
                  {Array.from(new Set(leads.map((l) => (l.location.state || '').trim()).filter(Boolean)))
                    .sort((a, b) => a.localeCompare(b))
                    .map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 border-border text-foreground hover:bg-muted bg-transparent"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Leads Grid */}
            {filteredLeads.length === 0 ? (
              <Card className="border-border">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-2">No leads found</p>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search or filters
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    {...lead}
                    assignment={assignmentsMap.get(lead.id) || null}
                    onViewDossier={(id) => setSelectedLeadId(id)}
                    onAssignmentChange={loadAssignments}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* News RSS Feed Tab */}
          <TabsContent value="news" className="space-y-6">
            <Card className="border-border">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-foreground font-semibold">News RSS Feed</p>
                   
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-border bg-transparent"
                      onClick={() => loadNews()}
                      disabled={newsLoading}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search news by title/source/keyword..."
                      value={newsSearch}
                      onChange={(e) => setNewsSearch(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {newsError ? (
                  <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4">
                    <p className="text-sm font-semibold text-foreground mb-1">Failed to load news</p>
                    <p className="text-sm text-muted-foreground">{newsError}</p>
                  </div>
                ) : newsLoading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Loading news…</div>
                ) : filteredNews.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No matched news items found.
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {filteredNews.map((it) => {
                      const dt = formatNewsDate(it)
                      const topLine = it.title || it.link || 'Untitled'
                      return (
                        <AccordionItem key={it.id} value={it.id} className="border-border">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex flex-col gap-1 text-left pr-3">
                              <div className="text-sm font-semibold text-foreground line-clamp-2">
                                {topLine}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {it.source ? (
                                  <span className="text-xs text-muted-foreground">{it.source}</span>
                                ) : null}
                                {dt ? <span className="text-xs text-muted-foreground">• {dt}</span> : null}
                                {Array.isArray(it.keywordsMatched) && it.keywordsMatched.length ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {it.keywordsMatched.slice(0, 6).map((k) => (
                                      <Badge
                                        key={k}
                                        variant="outline"
                                        className="text-xs bg-card text-foreground border-border"
                                      >
                                        {k}
                                      </Badge>
                                    ))}
                                    {it.keywordsMatched.length > 6 ? (
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-card text-muted-foreground border-border"
                                      >
                                        +{it.keywordsMatched.length - 6}
                                      </Badge>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="text-sm">
                            <div className="space-y-3">
                              {it.description ? (
                                <div>
                                  <p className="text-xs text-muted-foreground font-medium mb-1">Description</p>
                                  <p className="text-sm text-foreground whitespace-pre-line">{it.description}</p>
                                </div>
                              ) : null}

                              {it.content && it.content !== it.description ? (
                                <div>
                                  <p className="text-xs text-muted-foreground font-medium mb-1">Content</p>
                                  <p className="text-sm text-foreground whitespace-pre-line">{it.content}</p>
                                </div>
                              ) : null}

                              <div className="flex flex-wrap items-center gap-2 pt-2">
                                {it.link ? (
                                  <Button asChild className="h-8" variant="outline">
                                    <a href={it.link} target="_blank" rel="noreferrer">
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      Open article
                                    </a>
                                  </Button>
                                ) : null}
                                {it.feedUrl ? (
                                  <Button asChild className="h-8" variant="ghost">
                                    <a href={it.feedUrl} target="_blank" rel="noreferrer" className="text-xs">
                                      View feed
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <ExecutiveDashboard 
              metrics={data.dashboard_metrics} 
              assignments={assignments}
              totalLeads={leads.length}
            />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Real-Time Lead Alerts
                </h2>
                <p className="text-muted-foreground mb-6">
                  Stay updated with WhatsApp-style notifications for high-intent opportunities
                </p>
              </div>
              <div />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                {filteredLeads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white border border-border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedLeadId(lead.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground text-sm">
                              Lead Alert
                            </p>
                            <p className="text-xs text-muted-foreground">
                              New business opportunity
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/40 rounded p-3 space-y-1">
                      <p className="font-bold text-foreground text-sm">
                        📍 {lead.company_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lead.location.city}, {lead.location.state}
                      </p>
                    </div>

                    {lead.products_recommended.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-sm">💼</span>
                        <div>
                          <p className="text-xs text-muted-foreground">Matched:</p>
                          <p className="text-sm font-semibold text-foreground">
                            {lead.products_recommended[0].product_name}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        ⏱️ Just now
                      </span>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedLeadId(lead.id)
                        }}
                        className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium"
                      >
                        View Details →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Stats */}
              <div className="space-y-4">
                <Card className="border-border">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">
                        Unread Alerts
                      </p>
                      <p className="text-3xl font-bold text-primary">
                        {filteredLeads.filter((l) => l.status === 'new').length}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground font-medium mb-1">
                        Avg. Lead Score
                      </p>
                      <p className="text-2xl font-bold text-accent">
                        {Math.round(
                          filteredLeads.reduce((sum, l) => sum + l.lead_score, 0) /
                            filteredLeads.length
                        )}
                        %
                      </p>
                    </div>
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground font-medium mb-1">
                        Urgency Filtered
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {urgencyFilter === 'all' ? 'All' : urgencyFilter}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-muted-foreground">
          HPCL Direct Sales Intelligence Platform v1.0 • Enterprise Edition
        </div>
      </footer>
    </div>
  )
}
