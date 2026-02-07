'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Phone,
  Mail,
  MapPin,
  Globe,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  BarChart3,
  Clock,
  Target,
  FileText,
} from 'lucide-react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

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

interface LeadDossierProps {
  lead: Lead
  onBack: () => void
  onStatusChange: (leadId: string, status: string, notes: string) => void
}

export function LeadDossier({ lead, onBack, onStatusChange }: LeadDossierProps) {
  const [status, setStatus] = useState(lead.status)
  const [notes, setNotes] = useState(lead.notes)
  const [isSaving, setIsSaving] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState<string | null>(null)

  const handleSave = async () => {
    setIsSaving(true)
    setTimeout(() => {
      onStatusChange(lead.id, status, notes)
      setIsSaving(false)
    }, 500)
  }

  const handleSendEmail = async () => {
    setEmailSending(true)
    setEmailResult(null)
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
      const res = await fetch(`${apiBase}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo,
          subject: `HPCL Opportunity: ${lead.company_name}`,
          message: emailMessage,
          lead,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Send failed: ${res.status}`)
      }
      setEmailResult('Email sent successfully.')
    } catch (err) {
      setEmailResult(`Failed to send: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setEmailSending(false)
    }
  }

  const urgencyColor = {
    High: 'bg-destructive text-destructive-foreground',
    Medium: 'bg-yellow-100 text-yellow-800',
    Low: 'bg-green-100 text-green-800',
  }[lead.urgency]

  const marginColor = {
    'High': 'text-green-700 bg-green-50',
    'Medium': 'text-amber-700 bg-amber-50',
    'Low': 'text-gray-700 bg-gray-50',
    'Low-Medium': 'text-amber-700 bg-amber-50',
  } as Record<string, string>

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-10 w-10 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {lead.company_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lead.industry} • {lead.location.city}, {lead.location.state}
          </p>
        </div>
        <Badge className={urgencyColor}>{lead.urgency}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Lead Score</p>
          <p className="text-xl font-bold text-foreground">{lead.lead_score}%</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Confidence</p>
          <p className="text-xl font-bold text-accent">{lead.confidence}%</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Region</p>
          <p className="text-sm font-bold text-foreground">{lead.location.region}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Size</p>
          <p className="text-xs font-semibold text-foreground line-clamp-2">
            {lead.company_size}
          </p>
        </div>
      </div>

      {/* A. Company Snapshot */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Company Snapshot</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Company Name</p>
              <p className="text-sm font-semibold text-foreground">{lead.company_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Industry</p>
              <p className="text-sm font-semibold text-foreground">{lead.industry}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Company Size</p>
              <p className="text-sm font-semibold text-foreground">{lead.company_size}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Location</p>
              <p className="text-sm font-semibold text-foreground">
                {lead.location.city}, {lead.location.state}
              </p>
            </div>
          </div>
          <a
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
          >
            Visit Website
            <ExternalLink className="w-4 h-4" />
          </a>
        </CardContent>
      </Card>

      {/* B. Why This Lead Exists */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-accent" />
            <CardTitle className="text-lg">Why This Lead Exists</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Detected signals showing high-intent buying signals
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {lead.signals.map((signal, idx) => (
            <div key={idx} className="border-l-2 border-accent pl-4 py-2">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {signal.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(signal.date).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-xs font-semibold text-accent">
                  {signal.trust_score}% trust
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">
                {signal.keyword}
              </p>
              <p className="text-sm text-muted-foreground mb-2">{signal.summary}</p>
              <a
                href={signal.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline inline-flex items-center gap-1"
              >
                View source
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* C. Product Recommendation Engine */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Product Recommendations</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Top 3 HPCL products matched to this lead's requirements
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {lead.products_recommended.map((product, idx) => (
            <div key={idx} className="bg-muted/40 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground text-sm">
                    {idx + 1}. {product.product_name}
                  </h4>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {product.confidence}%
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{product.reason_code}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-card rounded p-2">
                  <p className="text-muted-foreground mb-0.5">Est. Volume</p>
                  <p className="font-semibold text-foreground">{product.estimated_volume}</p>
                </div>
                <div className={`rounded p-2 ${marginColor[product.margin_potential] || ''}`}>
                  <p className="mb-0.5 font-medium opacity-75">Margin</p>
                  <p className="font-semibold">{product.margin_potential}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* D. Suggested Next Action */}
      <Card className="border-2 border-primary bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg text-primary">Suggested Next Action</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-card border border-primary/20 rounded p-3">
              <p className="text-xs text-muted-foreground font-medium mb-1">Action</p>
              <p className="text-sm font-bold text-foreground">
                {lead.next_actions.suggested_action}
              </p>
            </div>
            <div className="bg-card border border-primary/20 rounded p-3">
              <p className="text-xs text-muted-foreground font-medium mb-1">Timing</p>
              <p className="text-sm font-bold text-destructive">
                {lead.next_actions.timing}
              </p>
            </div>
          </div>
          <div className="bg-card border border-primary/20 rounded p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1">Context</p>
            <p className="text-sm text-foreground">{lead.next_actions.context}</p>
          </div>
        </CardContent>
      </Card>

      {/* E. One-Tap Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button className="h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center justify-center gap-2">
          <Phone className="w-4 h-4" />
          <span className="hidden sm:inline">Call</span>
        </Button>
        <Button
          onClick={() => {
            setEmailOpen(true)
            setEmailResult(null)
          }}
          className="h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-medium flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4" />
          <span className="hidden sm:inline">Email</span>
        </Button>
        <Button variant="outline" className="h-11 border-border text-foreground hover:bg-muted font-medium flex items-center justify-center gap-2 bg-transparent">
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Meeting</span>
        </Button>
        <Button variant="outline" className="h-11 border-border text-foreground hover:bg-muted font-medium flex items-center justify-center gap-2 bg-transparent">
          <MapPin className="w-4 h-4" />
          <span className="hidden sm:inline">Maps</span>
        </Button>
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">To</label>
              <Input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Message</label>
              <Textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Write your email…"
                className="min-h-28"
              />
            </div>
            {emailResult && (
              <p className="text-xs text-muted-foreground break-words">{emailResult}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEmailOpen(false)}
                disabled={emailSending}
              >
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={emailSending || !emailTo.trim()}>
                {emailSending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* F. Lead Status & Notes */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Lead Status & Feedback</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Lead Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full h-10 border-border bg-card text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="new">New Lead</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Sales Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your sales notes and feedback here..."
              className="min-h-24 border-border bg-card text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
            <div className="text-xs">
              <p className="text-muted-foreground">Sales Owner</p>
              <p className="font-semibold text-foreground">{lead.sales_owner}</p>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground">Field Officer</p>
              <p className="font-semibold text-foreground">{lead.field_officer}</p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save Status & Notes
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
