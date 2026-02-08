/* eslint-disable react/no-unescaped-entities */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2 } from 'lucide-react'

type Officer = {
  _id?: string
  name: string
  email: string
  phone?: string | null
  employee_id?: string | null
  designation?: string | null
  region?: string | null
  createdAt?: string
}

export default function OfficerOnboardingPage() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')

  const [items, setItems] = useState<Officer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [designation, setDesignation] = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    const n = name.trim()
    const e = email.trim()
    return Boolean(n) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }, [name, email])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/api/officers`)
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed (${res.status})`)
      setItems(Array.isArray(json.items) ? (json.items as Officer[]) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch(`${apiBase}/api/officers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          employee_id: employeeId.trim() || null,
          designation: designation.trim() || null,
          region: region.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed (${res.status})`)

      setSaveMsg('Officer saved.')
      setName('')
      setEmail('')
      setPhone('')
      setEmployeeId('')
      setDesignation('')
      setRegion('')

      await load()
    } catch (err) {
      setSaveMsg(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (officer: Officer) => {
    if (!officer._id) return
    const ok = window.confirm(`Delete officer ${officer.name} (${officer.email})?`)
    if (!ok) return
    try {
      const res = await fetch(`${apiBase}/api/officers/${officer._id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed (${res.status})`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold text-foreground">Officer Onboarding</h1>
          <a
            href="/"
            className="text-sm font-medium text-accent hover:underline"
          >
            Back to Leads →
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Add Officer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Email *</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@hpcl.co.in" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Employee ID</label>
                <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP1234" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Designation</label>
                <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Field Officer" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Region</label>
                <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="North / East / ..." />
              </div>
            </div>

            {saveMsg && <p className="text-xs text-muted-foreground break-words">{saveMsg}</p>}

            <div className="flex items-center gap-2">
              <Button onClick={submit} disabled={!canSubmit || saving}>
                {saving ? 'Saving…' : 'Save Officer'}
              </Button>
              <Button variant="outline" onClick={load} disabled={loading}>
                Refresh List
              </Button>
            </div>
            
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Onboarded Officers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : error ? (
              <p className="text-sm text-destructive">Error: {error}</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No officers onboarded yet.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((o) => (
                      <TableRow key={o._id || o.email}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>{o.email}</TableCell>
                        <TableCell>{o.phone || '-'}</TableCell>
                        <TableCell>{o.employee_id || '-'}</TableCell>
                        <TableCell>{o.designation || '-'}</TableCell>
                        <TableCell>{o.region || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => remove(o)}
                            disabled={!o._id}
                            aria-label="Delete officer"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </main>
    </div>
  )
}


