'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useHACCPTemplates, useCreateHACCPTemplate, type HACCPTemplateItem } from '@/hooks/useHACCP'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { PageGuide } from '@/components/help/PageGuide'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Shield, Plus, ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_daily', label: 'Twice Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const ITEM_TYPE_LABELS: Record<string, string> = {
  yes_no: 'Yes / No',
  temperature: 'Temperature',
  text: 'Text',
}

export default function HACCPTemplatesPage() {
  const { currentStore, role } = useAuth()
  const storeId = currentStore?.store_id ?? null

  const { data: templates, isLoading } = useHACCPTemplates(storeId)
  const createTemplate = useCreateHACCPTemplate(storeId)

  const isManagement = role === 'Owner' || role === 'Manager'

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [formName, setFormName] = useState('')
  const [formFrequency, setFormFrequency] = useState('daily')
  const [formItems, setFormItems] = useState<HACCPTemplateItem[]>([
    { label: '', type: 'yes_no', required: true },
  ])

  const resetForm = () => {
    setFormName('')
    setFormFrequency('daily')
    setFormItems([{ label: '', type: 'yes_no', required: true }])
  }

  const handleAddItem = () => {
    setFormItems([...formItems, { label: '', type: 'yes_no', required: true }])
  }

  const handleRemoveItem = (index: number) => {
    if (formItems.length <= 1) return
    setFormItems(formItems.filter((_, i) => i !== index))
  }

  const handleUpdateItem = (index: number, field: keyof HACCPTemplateItem, value: string | boolean) => {
    const updated = [...formItems]
    updated[index] = { ...updated[index], [field]: value }
    setFormItems(updated)
  }

  const handleCreateTemplate = async () => {
    if (!formName.trim()) return
    const validItems = formItems.filter(item => item.label.trim())
    if (validItems.length === 0) return

    await createTemplate.mutateAsync({
      name: formName.trim(),
      frequency: formFrequency,
      items: validItems,
      is_active: true,
    })

    setShowCreateDialog(false)
    resetForm()
  }

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader title="HACCP Templates" description="Manage food safety check templates">
        <PageGuide pageKey="haccp-templates" />
      </PageHeader>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Select a store to manage HACCP templates.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HACCP Templates"
        description="Define your food safety check templates"
      >
        <div className="flex items-center gap-2">
          <Link href="/haccp">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          {isManagement && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          )}
        </div>
        <PageGuide pageKey="haccp-templates" />
      </PageHeader>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No templates yet"
          description="Create your first HACCP check template to start monitoring food safety."
          action={isManagement ? { label: 'Create Template', onClick: () => setShowCreateDialog(true), icon: Plus } : undefined}
        />
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{template.name}</p>
                    <Badge variant="secondary" className={template.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="capitalize">{template.frequency.replace('_', ' ')}</span>
                    <span>{template.items.length} {template.items.length === 1 ? 'item' : 'items'}</span>
                  </div>
                  {template.items.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {template.items.slice(0, 3).map((item, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs font-normal">
                          {item.label}
                        </Badge>
                      ))}
                      {template.items.length > 3 && (
                        <Badge variant="outline" className="text-xs font-normal">
                          +{template.items.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="capitalize">{template.frequency.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right">{template.items.length}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={template.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create HACCP Template</DialogTitle>
            <DialogDescription>
              Define a reusable checklist for food safety inspections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Morning Opening Check"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-frequency">Frequency</Label>
              <Select value={formFrequency} onValueChange={setFormFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Check Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              </div>

              {formItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Item label (e.g. Fridge temperature below 5°C)"
                        value={item.label}
                        onChange={(e) => handleUpdateItem(index, 'label', e.target.value)}
                      />
                      <div className="flex items-center gap-3">
                        <Select
                          value={item.type}
                          onValueChange={(value) => handleUpdateItem(index, 'type', value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes_no">Yes / No</SelectItem>
                            <SelectItem value="temperature">Temperature</SelectItem>
                            <SelectItem value="text">Text</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.required}
                            onCheckedChange={(checked) => handleUpdateItem(index, 'required', checked)}
                          />
                          <span className="text-xs text-muted-foreground">Required</span>
                        </div>
                      </div>
                    </div>
                    {formItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={createTemplate.isPending || !formName.trim() || formItems.every(i => !i.label.trim())}
            >
              {createTemplate.isPending ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
