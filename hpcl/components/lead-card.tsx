'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, UserCheck, UserPlus, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Officer {
  _id: string
  name: string
  email: string
}

interface Assignment {
  lead_id: string
  officer_id: string
  officer_name: string
  officer_email: string
}

interface LeadCardProps {
  id: string
  company_name: string
  location: {
    city: string
    state: string
  }
  lead_score: number
  urgency: string
  confidence: number
  signals: Array<{
    type: string
    keyword: string
  }>
  products_recommended: Array<{
    product_name: string
    confidence: number
  }>
  assignment?: Assignment | null
  onViewDossier: (id: string) => void
  onAssignmentChange?: () => void
}

export function LeadCard({
  id,
  company_name,
  location,
  lead_score,
  urgency,
  confidence,
  signals,
  products_recommended,
  assignment,
  onViewDossier,
  onAssignmentChange,
}: LeadCardProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [officers, setOfficers] = useState<Officer[]>([])
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingOfficers, setLoadingOfficers] = useState(false)

  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')

  const loadOfficers = async () => {
    setLoadingOfficers(true)
    try {
      const res = await fetch(`${apiBase}/api/officers`)
      const json = await res.json()
      if (json?.ok && Array.isArray(json.items)) {
        setOfficers(json.items)
      }
    } catch (err) {
      console.error('Failed to load officers:', err)
    } finally {
      setLoadingOfficers(false)
    }
  }

  const handleAssignClick = () => {
    setShowAssignDialog(true)
    loadOfficers()
  }

  const handleAssign = async () => {
    if (!selectedOfficerId) return
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/api/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: id,
          officer_id: selectedOfficerId,
        }),
      })
      const json = await res.json()
      if (json?.ok) {
        setShowAssignDialog(false)
        setSelectedOfficerId('')
        onAssignmentChange?.()
      }
    } catch (err) {
      console.error('Failed to assign officer:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUnassign = async () => {
    if (!assignment) return
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/api/assignments/${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json?.ok) {
        onAssignmentChange?.()
      }
    } catch (err) {
      console.error('Failed to unassign officer:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow duration-200 border-border">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-base font-semibold text-foreground truncate">
                {company_name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {location.city}, {location.state}
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-4">

            {/* Signals Summary */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-muted-foreground font-medium">
                  Detection Signals ({signals.length})
                </p>
                {assignment && (
                  <Badge
                    variant="default"
                    className="text-xs bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Assigned to {assignment.officer_name}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {signals.slice(0, 2).map((signal, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-xs bg-card text-foreground border-border"
                  >
                    {signal.type}
                  </Badge>
                ))}
                {signals.length > 2 && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-card text-muted-foreground border-border"
                  >
                    +{signals.length - 2}
                  </Badge>
                )}
              </div>
            </div>

            {/* Location (replaces Top Match) */}
            <div className="bg-muted/40 rounded p-2.5">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Location</p>
              <p className="text-sm font-semibold text-foreground line-clamp-2">
                {location.city}, {location.state}
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-2">
            <Button
              onClick={() => onViewDossier(id)}
              className="flex-1 h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center justify-center gap-2"
            >
              View Dossier
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              onClick={assignment ? handleUnassign : handleAssignClick}
              variant={assignment ? "outline" : "default"}
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              disabled={loading}
              title={assignment ? `Unassign from ${assignment.officer_name}` : 'Assign Officer'}
            >
              {assignment ? (
                <UserCheck className="w-4 h-4 text-green-600" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Officer to Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Lead</label>
              <p className="text-sm text-muted-foreground">{company_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Select Officer</label>
              {loadingOfficers ? (
                <p className="text-sm text-muted-foreground">Loading officers...</p>
              ) : officers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No officers available. Please onboard officers first.</p>
              ) : (
                <Select value={selectedOfficerId} onValueChange={setSelectedOfficerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {officers.map((officer) => (
                      <SelectItem key={officer._id} value={officer._id}>
                        {officer.name} ({officer.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleAssign}
                disabled={!selectedOfficerId || loading}
                className="flex-1"
              >
                {loading ? 'Assigning...' : 'Assign Officer'}
              </Button>
              <Button
                onClick={() => setShowAssignDialog(false)}
                variant="outline"
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
