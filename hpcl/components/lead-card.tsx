'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'

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
  onViewDossier: (id: string) => void
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
  onViewDossier,
}: LeadCardProps) {
  return (
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
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">
              Detection Signals ({signals.length})
            </p>
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
        <Button
          onClick={() => onViewDossier(id)}
          className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center justify-center gap-2"
        >
          View Dossier
          <ArrowRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
