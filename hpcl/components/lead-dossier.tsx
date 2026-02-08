'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageCircle,
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
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
type Officer = {
  _id?: string
  name: string
  email: string
}

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
  status: 'new' | 'accepted' | 'rejected' | 'converted'
  notes: string
  created_at: string
}

type EnrichedDossier = {
  lead_score: number
  urgency: 'High' | 'Medium' | 'Low' | string
  confidence: number
  signals?: Lead['signals']
  products_recommended?: Lead['products_recommended']
  next_actions?: Partial<Lead['next_actions']> & Record<string, unknown>
  sales_owner?: string
  field_officer?: string
  region?: string
  created_at?: string
  source?: string
  tender_reference?: string
  procurement_channel?: string
}

// Module-level cache to prevent duplicate enrichment requests in React Strict Mode (dev),
// and to avoid refetching when navigating back/forth to the same dossier.
const ENRICH_CACHE = new Map<string, EnrichedDossier>()
const ENRICH_INFLIGHT = new Map<string, Promise<EnrichedDossier>>()

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
  const [whatsAppOpen, setWhatsAppOpen] = useState(false)
  const [whatsAppDigits, setWhatsAppDigits] = useState('')
  const [whatsAppSending, setWhatsAppSending] = useState(false)
  const [whatsAppResult, setWhatsAppResult] = useState<string | null>(null)
  const [officers, setOfficers] = useState<Officer[]>([])
  const [officersLoading, setOfficersLoading] = useState(false)
  const [officersError, setOfficersError] = useState<string | null>(null)

  const [enriched, setEnriched] = useState<EnrichedDossier | null>(null)
  const [enrichLoading, setEnrichLoading] = useState(false)
  const [enrichError, setEnrichError] = useState<string | null>(null)

  const buildPayloadLead = (): Lead => {
    return enriched
      ? ({
          ...lead,
          lead_score: typeof enriched.lead_score === 'number' ? enriched.lead_score : lead.lead_score,
          urgency: (enriched.urgency as Lead['urgency']) || lead.urgency,
          confidence: typeof enriched.confidence === 'number' ? enriched.confidence : lead.confidence,
          signals: Array.isArray(enriched.signals) ? enriched.signals : lead.signals,
          products_recommended: Array.isArray(enriched.products_recommended)
            ? enriched.products_recommended
            : lead.products_recommended,
          next_actions: (enriched.next_actions as Lead['next_actions']) || lead.next_actions,
          sales_owner: enriched.sales_owner || lead.sales_owner,
          field_officer: enriched.field_officer || lead.field_officer,
          location: {
            ...lead.location,
            region: enriched.region || lead.location.region,
          },
        } as Lead)
      : lead
  }

  const handleSave = async () => {
    setIsSaving(true)
    const shouldPromptWhatsApp = status === 'accepted' && lead.status !== 'accepted'
    setTimeout(() => {
      onStatusChange(lead.id, status, notes)
      setIsSaving(false)
      if (shouldPromptWhatsApp) {
        setWhatsAppDigits('')
        setWhatsAppResult(null)
        setWhatsAppOpen(true)
      }
    }, 500)
  }

  const handleSendEmail = async () => {
    setEmailSending(true)
    setEmailResult(null)
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
      const payloadLead = buildPayloadLead()
      const res = await fetch(`${apiBase}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo,
          subject: `HPCL Opportunity: ${lead.company_name}`,
          message: emailMessage,
          lead: payloadLead,
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

  const handleSendWhatsApp = async () => {
    setWhatsAppSending(true)
    setWhatsAppResult(null)
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
      const payloadLead = buildPayloadLead()
      const digits = String(whatsAppDigits || '').replace(/\D/g, '').trim()
      if (!digits) throw new Error('Please enter a phone number.')
      const to = `+91${digits}`
      const res = await fetch(`${apiBase}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          lead: payloadLead,
          contentVariables: {
            '1': String(payloadLead?.signals?.[0]?.keyword || payloadLead.company_name || 'Tender'),
            '2': String(payloadLead?.signals?.[0]?.source || payloadLead.website || ''),
          },
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Send failed: ${res.status}`)
      }
      setWhatsAppResult('WhatsApp notification sent.')
    } catch (err) {
      setWhatsAppResult(`Failed to send: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setWhatsAppSending(false)
    }
  }

  const loadOfficers = async () => {
    setOfficersLoading(true)
    setOfficersError(null)
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
      const res = await fetch(`${apiBase}/api/officers`)
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed: ${res.status}`)
      const items = Array.isArray(json?.items) ? (json.items as Officer[]) : []
      setOfficers(items)
    } catch (err) {
      setOfficersError(err instanceof Error ? err.message : String(err))
      setOfficers([])
    } finally {
      setOfficersLoading(false)
    }
  }

  const handleStatusChangeValue = (value: string) => {
    // `Select` emits string, but our allowed values are constrained by the SelectItem values below.
    setStatus(value as Lead['status'])
  }

  useEffect(() => {
    if (emailOpen) loadOfficers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailOpen])

  useEffect(() => {
    if (whatsAppOpen) {
      setWhatsAppDigits((v) => String(v || '').replace(/\D/g, ''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsAppOpen])

  const loadEnrichment = async (leadId: string) => {
    setEnrichLoading(true)
    setEnrichError(null)
    try {
      const cached = ENRICH_CACHE.get(leadId)
      if (cached) {
        setEnriched(cached)
        return
      }

      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
      const existing = ENRICH_INFLIGHT.get(leadId)
      const p =
        existing ||
        (async () => {
          const res = await fetch(`${apiBase}/api/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: leadId, lead }),
          })
          const json = await res.json()
          if (!res.ok || json?.ok === false) {
            throw new Error(json?.error || `Enrichment failed (${res.status})`)
          }
          return json as EnrichedDossier
        })()

      if (!existing) ENRICH_INFLIGHT.set(leadId, p)

      const out = await p
      ENRICH_CACHE.set(leadId, out)
      setEnriched(out)
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : String(err))
    } finally {
      ENRICH_INFLIGHT.delete(leadId)
      setEnrichLoading(false)
    }
  }

  useEffect(() => {
    setStatus(lead.status)
    setNotes(lead.notes)
    if (lead?.id) loadEnrichment(lead.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  const display: Lead = enriched
    ? ({
        ...lead,
        lead_score: typeof enriched.lead_score === 'number' ? enriched.lead_score : lead.lead_score,
        // urgency should come from enrichment only (UI will show placeholder while loading)
        urgency: lead.urgency,
        confidence: typeof enriched.confidence === 'number' ? enriched.confidence : lead.confidence,
        signals: Array.isArray(enriched.signals) ? enriched.signals : lead.signals,
        products_recommended: Array.isArray(enriched.products_recommended)
          ? enriched.products_recommended
          : lead.products_recommended,
        next_actions: (enriched.next_actions as Lead['next_actions']) || lead.next_actions,
        sales_owner: enriched.sales_owner || lead.sales_owner,
        field_officer: enriched.field_officer || lead.field_officer,
        location: {
          ...lead.location,
          region: enriched.region || lead.location.region,
        },
        created_at: enriched.created_at || lead.created_at,
      } as Lead)
    : lead

  const whySignals = Array.isArray(enriched?.signals) ? enriched!.signals! : []
  const recommendedProducts = Array.isArray(enriched?.products_recommended) ? enriched!.products_recommended! : []
  const nextActions =
    enriched && enriched.next_actions && typeof enriched.next_actions === 'object'
      ? (enriched.next_actions as Partial<Lead['next_actions']> & Record<string, unknown>)
      : null

  const urgencyLabel =
    enrichLoading && !enriched ? '…' : enriched?.urgency ? String(enriched.urgency) : '—'

  const urgencyColor =
    urgencyLabel === 'High'
      ? 'bg-destructive text-destructive-foreground'
      : urgencyLabel === 'Medium'
        ? 'bg-yellow-100 text-yellow-800'
        : urgencyLabel === 'Low'
          ? 'bg-green-100 text-green-800'
          : 'bg-muted text-muted-foreground'

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
            {display.company_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {display.industry} • {display.location.city}, {display.location.state}
          </p>
        </div>
        <Badge className={urgencyColor}>{urgencyLabel}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Lead Score</p>
          <p className="text-xl font-bold text-foreground">
            {enrichLoading ? '…' : `${display.lead_score}%`}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Confidence</p>
          <p className="text-xl font-bold text-accent">
            {enrichLoading ? '…' : `${display.confidence}%`}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Region</p>
          <p className="text-sm font-bold text-foreground">
            {enrichLoading ? '…' : display.location.region}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Size</p>
          <p className="text-xs font-semibold text-foreground line-clamp-2">
            {display.company_size}
          </p>
        </div>
      </div>

      {(enrichError || enrichLoading) && (
        <Card className="border-border">
          <CardContent className="py-4 space-y-2">
            {enrichLoading && (
              <p className="text-sm text-muted-foreground">
                Generating dossier insights…
              </p>
            )}
            {enrichError && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-destructive break-words">Enrichment failed: {enrichError}</p>
                <Button variant="outline" onClick={() => loadEnrichment(lead.id)} disabled={enrichLoading}>
                  Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <p className="text-sm font-semibold text-foreground">{display.company_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Industry</p>
              <p className="text-sm font-semibold text-foreground">{display.industry}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Company Size</p>
              <p className="text-sm font-semibold text-foreground">{display.company_size}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Location</p>
              <p className="text-sm font-semibold text-foreground">
                {display.location.city}, {display.location.state}
              </p>
            </div>
          </div>
          <a
            href={display.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
          >
            Visit Website
            <ExternalLink className="w-4 h-4" />
          </a>
        </CardContent>
      </Card>

      {/* Tender Details */}
      {(lead as any).reference && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Tender Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Reference Number</p>
                <p className="text-sm font-semibold text-foreground">{(lead as any).reference || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Tender ID</p>
                <p className="text-sm font-semibold text-foreground">{(lead as any).tenderId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Contract Type</p>
                <Badge variant="outline" className="text-xs">
                  {(lead as any).contractType || 'N/A'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Form of Contract</p>
                <Badge variant="outline" className="text-xs">
                  {(lead as any).formOfContract || 'N/A'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Tender Category</p>
                <p className="text-sm font-semibold text-foreground">{(lead as any).tenderCategory || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Tender Type</p>
                <p className="text-sm font-semibold text-foreground">{(lead as any).tenderType || 'N/A'}</p>
              </div>
            </div>

            {/* Dates */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-foreground mb-3">Important Dates</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Published Date</p>
                  <p className="text-sm text-foreground">{(lead as any).publishedDateFull || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Document Download</p>
                  <p className="text-sm text-foreground">
                    {(lead as any).docDownloadStartDate && (lead as any).docDownloadEndDate
                      ? `${(lead as any).docDownloadStartDate} to ${(lead as any).docDownloadEndDate}`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Bid Submission Period</p>
                  <p className="text-sm text-foreground">
                    {(lead as any).bidSubmissionStartDate && (lead as any).bidSubmissionEndDate
                      ? `${(lead as any).bidSubmissionStartDate} to ${(lead as any).bidSubmissionEndDate}`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Bid Opening Date</p>
                  <p className="text-sm text-foreground">{(lead as any).bidOpeningDateFull || (lead as any).openingDate || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Closing Date</p>
                  <p className="text-sm font-semibold text-red-600">{(lead as any).closingDate || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Clarification Period</p>
                  <p className="text-sm text-foreground">
                    {(lead as any).clarificationStartDate && (lead as any).clarificationEndDate
                      ? `${(lead as any).clarificationStartDate} to ${(lead as any).clarificationEndDate}`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Details */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-foreground mb-3">Financial Details</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">EMD Amount</p>
                  <p className="text-sm font-semibold text-foreground">₹ {(lead as any).emdAmount || '0.00'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Tender Fee</p>
                  <p className="text-sm font-semibold text-foreground">₹ {(lead as any).tenderFee || '0.00'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">EMD Fee Type</p>
                  <Badge variant="outline" className="text-xs">
                    {(lead as any).emdFeeType || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">EMD Exemption Allowed</p>
                  <Badge variant={((lead as any).emdExemptionAllowed === 'Yes') ? 'default' : 'outline'} className="text-xs">
                    {(lead as any).emdExemptionAllowed || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Payment Mode</p>
                  <p className="text-sm text-foreground">{(lead as any).paymentMode || 'N/A'}</p>
                </div>
                {(lead as any).paymentInstruments && (lead as any).paymentInstruments.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Payment Instruments</p>
                    <div className="flex gap-1 flex-wrap">
                      {(lead as any).paymentInstruments.map((instrument: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {instrument}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Work Details */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-foreground mb-3">Work Details</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Work Location</p>
                  <p className="text-sm text-foreground">{(lead as any).workLocation || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Period of Work</p>
                  <p className="text-sm text-foreground">{(lead as any).periodOfWorkDays ? `${(lead as any).periodOfWorkDays} days` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Bid Validity</p>
                  <p className="text-sm text-foreground">{(lead as any).bidValidityDays ? `${(lead as any).bidValidityDays} days` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Number of Covers</p>
                  <p className="text-sm text-foreground">{(lead as any).numberOfCovers || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Product Category</p>
                  <p className="text-sm text-foreground">{(lead as any).productCategory || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Bid Opening Place</p>
                  <p className="text-sm text-foreground">{(lead as any).bidOpeningPlace || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-foreground mb-3">Additional Information</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Two Stage Bidding</p>
                  <Badge variant={((lead as any).allowTwoStageBidding === 'Yes') ? 'default' : 'outline'} className="text-xs">
                    {(lead as any).allowTwoStageBidding || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Preferential Bidder</p>
                  <Badge variant={((lead as any).allowPreferentialBidder === 'Yes') ? 'default' : 'outline'} className="text-xs">
                    {(lead as any).allowPreferentialBidder || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Withdrawal Allowed</p>
                  <Badge variant={((lead as any).withdrawalAllowed === 'Yes') ? 'default' : 'outline'} className="text-xs">
                    {(lead as any).withdrawalAllowed || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Tender Fee Exemption</p>
                  <Badge variant={((lead as any).tenderFeeExemptionAllowed === 'Yes') ? 'default' : 'outline'} className="text-xs">
                    {(lead as any).tenderFeeExemptionAllowed || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Documents */}
            {((lead as any).nitDocuments?.length > 0 || (lead as any).workItemDocuments?.length > 0) && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground mb-3">Documents</p>
                
                {(lead as any).nitDocuments?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground font-medium mb-2">NIT Documents</p>
                    <div className="space-y-2">
                      {(lead as any).nitDocuments.map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 border border-border rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.description} • {doc.sizeKB} KB</p>
                          </div>
                          <a
                            href={doc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-accent hover:underline ml-2"
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(lead as any).workItemDocuments?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">Work Item Documents</p>
                    <div className="space-y-2">
                      {(lead as any).workItemDocuments.map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 border border-border rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.type} • {doc.description} • {doc.sizeKB} KB
                            </p>
                          </div>
                          <a
                            href={doc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-accent hover:underline ml-2"
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View Full Tender Link */}
            {(lead as any).detailUrl && (
              <div className="border-t border-border pt-4">
                <a
                  href={(lead as any).detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
                >
                  View Full Tender Details on eProcure
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
          {enrichLoading && !enriched ? (
            <p className="text-sm text-muted-foreground">Generating signals…</p>
          ) : whySignals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signals returned by enrichment yet.</p>
          ) : (
            whySignals.map((signal, idx) => (
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
            ))
          )}
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
          {enrichLoading && !enriched ? (
            <p className="text-sm text-muted-foreground">Generating product recommendations…</p>
          ) : recommendedProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No product recommendations returned by enrichment yet.</p>
          ) : (
            recommendedProducts.map((product, idx) => (
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
            ))
          )}
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
          {enrichLoading && !enriched ? (
            <p className="text-sm text-muted-foreground">Generating next action…</p>
          ) : !nextActions ? (
            <p className="text-sm text-muted-foreground">No next action returned by enrichment yet.</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-card border border-primary/20 rounded p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Action</p>
                  <p className="text-sm font-bold text-foreground">
                    {String(nextActions.suggested_action ?? '—')}
                  </p>
                </div>
                <div className="bg-card border border-primary/20 rounded p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Timing</p>
                  <p className="text-sm font-bold text-destructive">
                    {String(nextActions.timing ?? '—')}
                  </p>
                </div>
              </div>
              <div className="bg-card border border-primary/20 rounded p-3 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Context</p>
                  <p className="text-sm text-foreground">{String(nextActions.context ?? '—')}</p>
                </div>
                {nextActions.contact_trigger ? (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Contact Trigger</p>
                    <p className="text-sm text-foreground">{String(nextActions.contact_trigger)}</p>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* E. One-Tap Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          onClick={() => {
            setWhatsAppOpen(true)
            setWhatsAppResult(null)
          }}
          className="h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">WhatsApp</span>
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

      <Dialog open={whatsAppOpen} onOpenChange={setWhatsAppOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send WhatsApp Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">WhatsApp Number</label>
              <div className="flex items-center gap-2">
                <div className="h-10 px-3 inline-flex items-center rounded-md border border-border bg-muted text-foreground font-mono text-sm select-none">
                  +91
                </div>
                <Input
                  value={whatsAppDigits}
                  onChange={(e) => setWhatsAppDigits(e.target.value.replace(/\D/g, ''))}
                  placeholder="Mobile number"
                  inputMode="numeric"
                  autoComplete="tel-national"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                We’ll send to <span className="font-mono">+91{whatsAppDigits || 'XXXXXXXXXX'}</span>.
              </p>
            </div>
            {whatsAppResult && (
              <p className="text-xs text-muted-foreground break-words">{whatsAppResult}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setWhatsAppOpen(false)}
                disabled={whatsAppSending}
              >
                Cancel
              </Button>
              <Button onClick={handleSendWhatsApp} disabled={whatsAppSending || !whatsAppDigits.trim()}>
                {whatsAppSending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">To</label>
              <Select value={emailTo} onValueChange={setEmailTo}>
                <SelectTrigger className="w-full h-10 border-border bg-card text-foreground">
                  <SelectValue placeholder={officersLoading ? 'Loading officers…' : 'Select officer email'} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {officers.map((o) => (
                    <SelectItem key={o._id || o.email} value={o.email}>
                      {o.name} — {o.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {officersError && (
                <p className="text-xs text-muted-foreground mt-2 break-words">
                  Failed to load officers: {officersError}
                </p>
              )}
              {!officersLoading && !officersError && officers.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No officers found. Please onboard officers first.
                </p>
              )}
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
            <Select value={status} onValueChange={handleStatusChangeValue}>
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
              <p className="font-semibold text-foreground">{display.sales_owner}</p>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground">Field Officer</p>
              <p className="font-semibold text-foreground">{display.field_officer}</p>
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
