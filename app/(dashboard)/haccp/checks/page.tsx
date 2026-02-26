'use client'

import { useState, useMemo } from 'react'
import { subDays, startOfDay, endOfDay } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { useAuth } from '@/hooks/useAuth'
import {
  useHACCPTemplates,
  useHACCPChecks,
  useSubmitHACCPCheck,
  type HACCPTemplate,
} from '@/hooks/useHACCP'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { PageGuide } from '@/components/help/PageGuide'
import { EmptyState } from '@/components/ui/empty-state'
import { DateRangePicker } from '@/components/ui/date-range-picker'
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
  ClipboardCheck,
  ArrowLeft,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'

function getStatusBadge(status: string) {
  switch (status) {
    case 'pass':
      return <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Pass</Badge>
    case 'fail':
      return <Badge variant="secondary" className="bg-destructive/10 text-destructive">Fail</Badge>
    case 'partial':
      return <Badge variant="secondary" className="bg-amber-50 text-amber-700">Partial</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

interface CheckResponse {
  item_label: string
  item_type: 'yes_no' | 'temperature' | 'text'
  value: boolean | number | string
  passed: boolean
}

export default function HACCPChecksPage() {
  const { currentStore } = useAuth()
  const storeId = currentStore?.store_id ?? null

  // History filter state
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: subDays(new Date(), 29),
    to: new Date(),
  }))

  const checksParams = useMemo(() => ({
    from: dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined,
    to: dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  }), [dateRange, statusFilter])

  const { data: templates, isLoading: loadingTemplates } = useHACCPTemplates(storeId)
  const { data: checks, isLoading: loadingChecks } = useHACCPChecks(storeId, checksParams)
  const submitCheck = useSubmitHACCPCheck(storeId)

  // Submit check state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [responses, setResponses] = useState<CheckResponse[]>([])
  const [notes, setNotes] = useState('')

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId || !templates) return null
    return templates.find(t => t.id === selectedTemplateId) ?? null
  }, [selectedTemplateId, templates])

  const handleSelectTemplate = (templateId: string) => {
    const template = templates?.find(t => t.id === templateId)
    if (!template) return
    setSelectedTemplateId(templateId)
    setResponses(
      template.items.map(item => ({
        item_label: item.label,
        item_type: item.type,
        value: item.type === 'yes_no' ? true : item.type === 'temperature' ? 0 : '',
        passed: item.type === 'yes_no' ? true : true,
      }))
    )
    setNotes('')
  }

  const handleUpdateResponse = (index: number, value: boolean | number | string) => {
    const updated = [...responses]
    updated[index] = {
      ...updated[index],
      value,
      passed: updated[index].item_type === 'yes_no' ? value === true : true,
    }
    setResponses(updated)
  }

  const computedStatus = useMemo(() => {
    if (responses.length === 0) return 'pass'
    const allPass = responses.every(r => r.passed)
    const anyFail = responses.some(r => !r.passed)
    if (allPass) return 'pass'
    if (anyFail && !allPass) {
      const allFail = responses.every(r => !r.passed)
      return allFail ? 'fail' : 'partial'
    }
    return 'partial'
  }, [responses])

  const handleSubmitCheck = async () => {
    if (!selectedTemplateId) return
    await submitCheck.mutateAsync({
      template_id: selectedTemplateId,
      responses: responses.map(r => ({
        item_label: r.item_label,
        item_type: r.item_type,
        value: r.value,
        passed: r.passed,
      })),
      notes: notes.trim() || undefined,
    })
    setSelectedTemplateId(null)
    setResponses([])
    setNotes('')
  }

  const filteredChecks = useMemo(() => {
    if (!checks) return []
    if (statusFilter === 'all') return checks
    return checks.filter(c => c.status === statusFilter)
  }, [checks, statusFilter])

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader title="HACCP Checks" description="Submit and review food safety checks">
        <PageGuide pageKey="haccp-checks" />
      </PageHeader>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Select a store to manage HACCP checks.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HACCP Checks"
        description="Submit and review food safety checks"
      >
        <Link href="/haccp">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageGuide pageKey="haccp-checks" />
      </PageHeader>

      {/* Submit Check Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Submit a Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingTemplates ? (
            <Skeleton className="h-10 w-full" />
          ) : !templates || templates.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No templates available.{' '}
              <Link href="/haccp/templates" className="text-primary underline">
                Create one first
              </Link>
              .
            </div>
          ) : !selectedTemplateId ? (
            <div className="space-y-2">
              <Label>Select a Template</Label>
              <Select onValueChange={handleSelectTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a check template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.items.length} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : selectedTemplate ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedTemplate.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {selectedTemplate.frequency.replace('_', ' ')} check
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(computedStatus)}
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedTemplateId(null); setResponses([]) }}>
                    Change
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {responses.map((response, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">{response.item_label}</Label>
                      {response.item_type === 'yes_no' && (
                        response.passed ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )
                      )}
                    </div>
                    {response.item_type === 'yes_no' && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={response.value === true}
                          onCheckedChange={(checked) => handleUpdateResponse(index, checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {response.value === true ? 'Yes (Pass)' : 'No (Fail)'}
                        </span>
                      </div>
                    )}
                    {response.item_type === 'temperature' && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          className="w-24"
                          value={response.value as number}
                          onChange={(e) => handleUpdateResponse(index, parseFloat(e.target.value) || 0)}
                        />
                        <span className="text-sm text-muted-foreground">°C</span>
                      </div>
                    )}
                    {response.item_type === 'text' && (
                      <Input
                        placeholder="Enter observation..."
                        value={response.value as string}
                        onChange={(e) => handleUpdateResponse(index, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="check-notes">Notes (optional)</Label>
                <Textarea
                  id="check-notes"
                  placeholder="Any additional observations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSubmitCheck}
                disabled={submitCheck.isPending}
              >
                {submitCheck.isPending ? 'Submitting...' : 'Submit Check'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Check History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-medium">Check History</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <DateRangePicker
                value={dateRange}
                onChange={(range) => setDateRange(range || { from: subDays(new Date(), 29), to: new Date() })}
                presets={['last7days', 'last14days', 'last30days', 'last60days', 'last90days']}
                align="end"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pass">Pass</SelectItem>
                  <SelectItem value="fail">Fail</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingChecks ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredChecks.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No checks recorded"
              description="Submit your first HACCP check to start building your compliance history."
            />
          ) : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden space-y-3">
                {filteredChecks.map((check) => (
                  <div key={check.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(check.created_at).toLocaleDateString('en-GB', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {getStatusBadge(check.status)}
                    </div>
                    <p className="font-medium text-sm">{check.template_name ?? 'Check'}</p>
                    {check.completed_by_name && (
                      <p className="text-xs text-muted-foreground">By {check.completed_by_name}</p>
                    )}
                    {check.notes && (
                      <p className="text-xs text-muted-foreground">{check.notes}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completed By</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChecks.map((check) => (
                      <TableRow key={check.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(check.created_at).toLocaleDateString('en-GB', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="font-medium">{check.template_name ?? 'Check'}</TableCell>
                        <TableCell>{getStatusBadge(check.status)}</TableCell>
                        <TableCell className="text-muted-foreground">{check.completed_by_name ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {check.notes ?? '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
