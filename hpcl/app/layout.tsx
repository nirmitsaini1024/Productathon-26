import React from "react"
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HPCL Direct Sales Intelligence | B2B Lead Management Platform',
  description: 'Enterprise-grade B2B Sales Intelligence platform for HPCL Direct Sales officers. Discover high-intent leads, analyze buying signals, and manage your sales pipeline with AI-powered insights.',
  keywords: ['B2B Sales', 'Lead Intelligence', 'HPCL', 'Sales CRM', 'Lead Scoring'],
  generator: 'v0.app',
  openGraph: {
    title: 'HPCL Direct Sales Intelligence',
    description: 'Empower your sales team with intelligent lead discovery and management',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1E3A5F',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
