'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  Target,
  Phone,
  Mail,
  ExternalLink,
  User,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { LeadDossier } from '@/components/lead-dossier'

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
  status: string
  signals: Array<{
    type: string
    keyword: string
    source: string
    date: string
    trust_score: number
    summary: string
    details?: unknown
  }>
  products_recommended: Array<{
    product_name: string
    confidence: number
    reason_code: string
    estimated_volume: string
    margin_potential: string
    competitor_risk?: string
    match_evidence?: string[]
  }>
  next_actions: {
    suggested_action: string
    timing: string
    context: string
    contact_trigger: string
    reference_number?: string
  }
  sales_owner: string
  field_officer: string
  notes: string
  created_at: string
}

interface Officer {
  _id: string
  name: string
  email: string
  designation?: string
  region?: string
}

interface Assignment {
  lead_id: string
  officer_id: string
  officer_name: string
  assigned_at: string
}

export default function OfficerDashboardPage() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')

  const [officers, setOfficers] = useState<Officer[]>([])
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('')
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null)
  
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [myLeads, setMyLeads] = useState<Lead[]>([])
  
  const [loading, setLoading] = useState(true)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Load officers
  useEffect(() => {
    const loadOfficers = async () => {
      try {
        const res = await fetch(`${apiBase}/api/officers`)
        const json = await res.json()
        if (json?.ok && Array.isArray(json.items)) {
          setOfficers(json.items)
        }
      } catch (err) {
        console.error('Failed to load officers:', err)
      }
    }
    loadOfficers()
  }, [apiBase])

  // Load leads and assignments when officer is selected
  useEffect(() => {
    if (!selectedOfficerId) return

    const loadData = async () => {
      setLoading(true)
      try {
        const [leadsRes, assignmentsRes] = await Promise.all([
          fetch(`${apiBase}/api/leads?limit=500`),
          fetch(`${apiBase}/api/assignments`),
        ])

        const leadsJson = await leadsRes.json()
        const assignmentsJson = await assignmentsRes.json()

        const leads = Array.isArray(leadsJson?.leads) ? leadsJson.leads : []
        const assignments = Array.isArray(assignmentsJson?.items) ? assignmentsJson.items : []

        setAllLeads(leads)
        setAssignments(assignments)

        // Filter leads assigned to this officer
        const myAssignmentIds = assignments
          .filter((a: Assignment) => a.officer_id === selectedOfficerId)
          .map((a: Assignment) => a.lead_id)

        const filteredLeads = leads.filter((lead: Lead) => myAssignmentIds.includes(lead.id))
        setMyLeads(filteredLeads)
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedOfficerId, apiBase])

  // Update selected officer info
  useEffect(() => {
    if (selectedOfficerId) {
      const officer = officers.find((o) => o._id === selectedOfficerId)
      setSelectedOfficer(officer || null)
    } else {
      setSelectedOfficer(null)
    }
  }, [selectedOfficerId, officers])

  // Filter leads by search and status
  const filteredLeads = myLeads.filter((lead) => {
    const matchesSearch = searchQuery.trim()
      ? lead.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.location.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.location.state.toLowerCase().includes(searchQuery.toLowerCase())
      : true

    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Calculate metrics
  const metrics = {
    total: myLeads.length,
    discovered: myLeads.filter((l) => l.status === 'discovered').length,
    assigned: myLeads.filter((l) => l.status === 'assigned').length,
    contacted: myLeads.filter((l) => l.status === 'contacted').length,
    accepted: myLeads.filter((l) => l.status === 'accepted').length,
    converted: myLeads.filter((l) => l.status === 'converted').length,
    highUrgency: myLeads.filter((l) => l.urgency === 'High').length,
    avgScore: myLeads.length > 0
      ? Math.round(myLeads.reduce((sum, l) => sum + l.lead_score, 0) / myLeads.length)
      : 0,
  }

  const conversionRate = metrics.total > 0
    ? `${Math.round((metrics.converted / metrics.total) * 100)}%`
    : '0%'

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'High': return 'text-red-600 bg-red-50 border-red-200'
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'Low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'discovered': return 'bg-blue-100 text-blue-800'
      case 'assigned': return 'bg-purple-100 text-purple-800'
      case 'contacted': return 'bg-teal-100 text-teal-800'
      case 'accepted': return 'bg-green-100 text-green-800'
      case 'converted': return 'bg-orange-100 text-orange-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (selectedLeadId) {
    const lead = allLeads.find((l) => l.id === selectedLeadId)
    if (lead) {
      return <LeadDossier lead={lead as any} onBack={() => setSelectedLeadId(null)} onStatusChange={() => {}} />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-primary" />
            <h1 className="text-lg md:text-xl font-bold text-foreground">Officer Dashboard</h1>
          </div>
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            Back to Main Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Officer Selection */}
        {!selectedOfficerId ? (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-xl">Select Your Profile</CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose your officer profile to view your assigned leads
              </p>
            </CardHeader>
            <CardContent>
              <Select value={selectedOfficerId} onValueChange={setSelectedOfficerId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Choose your profile..." />
                </SelectTrigger>
                <SelectContent>
                  {officers.map((officer) => (
                    <SelectItem key={officer._id} value={officer._id}>
                      {officer.name} ({officer.email})
                      {officer.designation && ` - ${officer.designation}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Officer Info */}
            <Card className="border-border bg-primary/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {selectedOfficer?.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedOfficer?.designation || 'Sales Officer'}
                        {selectedOfficer?.region && ` • ${selectedOfficer.region}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedOfficerId('')}
                  >
                    Switch Officer
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">
                        My Leads
                      </p>
                      <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
                    </div>
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Target className="w-4 h-4 text-blue-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">
                        Contacted
                      </p>
                      <p className="text-2xl font-bold text-foreground">{metrics.contacted}</p>
                    </div>
                    <div className="bg-teal-100 p-2 rounded-lg">
                      <Phone className="w-4 h-4 text-teal-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">
                        Converted
                      </p>
                      <p className="text-2xl font-bold text-foreground">{metrics.converted}</p>
                    </div>
                    <div className="bg-green-100 p-2 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">
                        Conversion Rate
                      </p>
                      <p className="text-2xl font-bold text-foreground">{conversionRate}</p>
                    </div>
                    <div className="bg-orange-100 p-2 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-orange-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Breakdown */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Pipeline Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Assigned</p>
                    <p className="text-xl font-bold" style={{ color: '#8B5CF6' }}>
                      {metrics.assigned}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Contacted</p>
                    <p className="text-xl font-bold" style={{ color: '#1B8A8A' }}>
                      {metrics.contacted}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Accepted</p>
                    <p className="text-xl font-bold" style={{ color: '#0F6B3C' }}>
                      {metrics.accepted}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Converted</p>
                    <p className="text-xl font-bold" style={{ color: '#FFA500' }}>
                      {metrics.converted}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">High Urgency</p>
                    <p className="text-xl font-bold text-red-600">
                      {metrics.highUrgency}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filters and Search */}
            <Card className="border-border">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <CardTitle className="text-lg">My Assigned Leads</CardTitle>
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder="Search leads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full md:w-64"
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading leads...</p>
                ) : filteredLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No leads assigned yet
                  </p>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Urgency</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeads.map((lead, idx) => (
                          <TableRow
                            key={lead.id}
                            className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/30'}
                          >
                            <TableCell className="font-medium">
                              {lead.company_name}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {lead.industry}
                              </p>
                            </TableCell>
                            <TableCell>
                              {lead.location.city}, {lead.location.state}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(lead.status)}>
                                {lead.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getUrgencyColor(lead.urgency)}>
                                {lead.urgency}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold">{lead.lead_score}</span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {lead.products_recommended[0]?.product_name.split(' ').slice(0, 3).join(' ')}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedLeadId(lead.id)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
