# HPCL Direct Sales Intelligence Platform

An enterprise-grade B2B Sales Intelligence UI for HPCL Direct Sales officers to discover, understand, and act on high-intent leads.

## 🏗️ Architecture

### Core Components

1. **LeadCard** (`components/lead-card.tsx`)
   - Individual lead display in the feed
   - Shows company, location, signals, products, and urgency
   - Click to view full dossier

2. **LeadDossier** (`components/lead-dossier.tsx`)
   - Comprehensive lead detail view with 6 sections:
     - Company Snapshot (profile info)
     - Why This Lead Exists (signal explainability)
     - Product Recommendations (top 3 matched products)
     - Suggested Next Actions (sales guidance)
     - One-Tap Actions (Call, Email, Schedule, Maps)
     - Lead Status & Notes (feedback capture)

3. **ExecutiveDashboard** (`components/executive-dashboard.tsx`)
   - Multi-widget dashboard for managers
   - KPI cards, sales funnel, product demand charts
   - Sector distribution and regional heatmap
   - Built with Recharts for data visualization

4. **NotificationPreview** (`components/notification-preview.tsx`)
   - WhatsApp-style alert notifications
   - Displays top high-intent leads with urgency indicators
   - Quick-access "View Details" CTAs

### Main Pages

- **Home/Leads Feed** (`app/page.tsx`)
  - Default tab: Scrollable lead cards sorted by lead_score
  - Search by company/city
  - Filter by urgency (High/Medium/Low)
  - Tab navigation to other views

- **Executive Dashboard**
  - Desktop-first, manager-focused view
  - KPIs, funnel, product performance, regional metrics

- **Notifications**
  - Real-time alerts styled like WhatsApp
  - Compact, action-oriented notifications

## 📊 Data Source

Data is loaded from the backend API (in `eprocure-scraper`):
- `GET {API_BASE_URL}/api/leads` (reads from MongoDB using Mongoose)

## 🎨 Design System

**Color Palette** (Enterprise, PSU-appropriate, industrial):
- **Primary**: Navy Blue (#1E3A5F) – CTAs, headers
- **Accent**: Teal (#1B8A8A) – Links, secondary actions
- **Success**: Forest Green (#0F6B3C) – Positive indicators
- **Warning/Urgency**: Coral (#C05621) – Alerts
- **Background**: Off-white (#F6F7F5) – Neutral, accessible
- **Text**: Charcoal (#1F2933) – Readable, professional

No purple, neon, or "AI aesthetic" effects. Clean, minimal, trustworthy.

## 🚀 Features

### Lead Intelligence
- High-confidence lead scoring (0-100%)
- Multi-source signal detection (Tenders, News, Website signals)
- Trust score per signal (individual confidence)
- Explainable recommendations (why this lead matters)

### Sales Guidance
- Auto-generated next actions with timing
- Product match confidence and volume estimates
- Sales owner and field officer assignment
- Status tracking (New/Accepted/Rejected/Converted)

### Executive Analytics
- Weekly/monthly conversion metrics
- Product demand by volume
- Sector-wise lead distribution
- Geography-based performance heatmap

## 📱 Responsive Design

- **Mobile-first** layout with optimized tap targets (44px minimum)
- **Tablet** view: 2-column card grid
- **Desktop** view: 3-column card grid + full dashboard widgets
- All interactive elements accessible via keyboard
- WCAG contrast compliance maintained throughout

## 🛠️ Tech Stack

- **Next.js 16** (App Router)
- **React 19** (Client components)
- **Tailwind CSS 3** (Utility-first styling)
- **shadcn/ui** (Radix + Tailwind components)
- **Recharts** (Charts & data visualization)
- **Lucide Icons** (Outline icons)
- **TypeScript** (Type safety)

## 📝 Getting Started

1. Clone and install dependencies
2. Run `npm run dev` to start development server
3. Open `http://localhost:3000`
4. Configure `NEXT_PUBLIC_API_BASE_URL` (see `env.example`) to point to the backend, then data loads from the backend API

## 🔄 State Management

- React hooks (`useState`, `useEffect`)
- Client-side filtering and search
- Lead status updates saved to component state
- Ready for backend integration

## 🎯 Next Steps for Production

1. Add authentication & authorization (role-based access)
3. Implement real-time notifications (WebSockets/Webhooks)
4. Add data export (CSV/PDF)
5. Integrate CRM backend for lead status persistence
6. Enable map integration for facility locations
7. Add email/SMS campaign tracking
8. Implement lead assignment automation

---

**Version**: 1.0 • **Edition**: Enterprise • **Target Users**: Field Sales Officers, Regional/Zonal Managers
