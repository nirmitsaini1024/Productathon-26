'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, Clock } from 'lucide-react'

interface NotificationLead {
  id: string
  company_name: string
  lead_score: number
  urgency: 'High' | 'Medium' | 'Low'
  products_recommended: Array<{
    product_name: string
  }>
  location: {
    city: string
    state: string
  }
}

interface NotificationPreviewProps {
  leads: NotificationLead[]
  onViewLead: (id: string) => void
}

export function NotificationPreview({ leads, onViewLead }: NotificationPreviewProps) {
  const urgencyEmoji = {
    High: '🔴',
    Medium: '🟡',
    Low: '🟢',
  }

  return (
    <div className="space-y-3 max-w-md">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-foreground">
          Real-time Notifications
        </h3>
      </div>

      {leads.length === 0 ? (
        <Card className="border-border p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No new notifications at this time.
          </p>
        </Card>
      ) : (
        leads.map((lead) => (
          <div
            key={lead.id}
            className="bg-white border border-border rounded-lg p-3 space-y-2 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onViewLead(lead.id)}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{urgencyEmoji[lead.urgency]}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm leading-tight">
                      High-Intent Lead
                    </p>
                    <p className="text-xs text-muted-foreground">
                      New opportunity detected
                    </p>
                  </div>
                </div>
              </div>
              <Badge className="bg-primary text-primary-foreground text-xs flex-shrink-0">
                Score {lead.lead_score}
              </Badge>
            </div>

            {/* Company Info */}
            <div className="bg-muted/40 rounded p-2.5 space-y-1">
              <p className="font-bold text-foreground text-sm leading-snug">
                📍 {lead.company_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {lead.location.city}, {lead.location.state}
              </p>
            </div>

            {/* Product Match */}
            {lead.products_recommended.length > 0 && (
              <div className="flex items-start gap-1.5">
                <span className="text-sm">💼</span>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Matched:</p>
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {lead.products_recommended[0].product_name}
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Just now</span>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewLead(lead.id)
                }}
                className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded"
              >
                View Details →
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
