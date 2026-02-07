'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, TrendingUp } from 'lucide-react'

interface LeadCardProps {
  id: string
  company_name: string
  location: {
    city: string
    state: string
  }
  lead_score: number
  urgency: 'High' | 'Medium' | 'Low'
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
  const urgencyColor = {
    High: 'bg-destructive text-destructive-foreground',
    Medium: 'bg-yellow-100 text-yellow-800',
    Low: 'bg-green-100 text-green-800',
  }[urgency]

  const topProduct = products_recommended[0]

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
          <Badge className={urgencyColor + ' whitespace-nowrap flex-shrink-0'}>
            {urgency}
          </Badge>
        </div>

        <div className="space-y-3 mb-4">
          {/* Score Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-sm text-muted-foreground">Lead Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-primary"
                  style={{ width: `${lead_score}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-foreground w-8 text-right">
                {lead_score}%
              </span>
            </div>
          </div>

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

          {/* Top Product */}
          {topProduct && (
            <div className="bg-muted/40 rounded p-2.5">
              <p className="text-xs text-muted-foreground mb-1 font-medium">
                Top Match
              </p>
              <p className="text-sm font-semibold text-foreground line-clamp-2">
                {topProduct.product_name}
              </p>
              <p className="text-xs text-accent mt-1 font-medium">
                {topProduct.confidence}% match
              </p>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between text-xs mb-4 pb-3 border-t border-border pt-3">
          <span className="text-muted-foreground">
            Confidence: <span className="font-semibold text-foreground">{confidence}%</span>
          </span>
          <span className="text-muted-foreground">
            Products: <span className="font-semibold text-foreground">{products_recommended.length}</span>
          </span>
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
