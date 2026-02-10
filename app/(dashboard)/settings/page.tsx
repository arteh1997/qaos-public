'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCSRF } from '@/hooks/useCSRF'
import { usePosConnections, useCreatePosConnection, usePosSaleEvents } from '@/hooks/usePosConnections'
import { useAlertPreferences } from '@/hooks/useAlertPreferences'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ApiKeyForm } from '@/components/settings/ApiKeyForm'
import { WebhookForm } from '@/components/settings/WebhookForm'
import {
  Settings, Key, Webhook, Bell, Zap, Plus, Trash2,
  CheckCircle, XCircle, Clock,
} from 'lucide-react'
import { toast } from 'sonner'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  last_used_at: string | null
  is_active: boolean
  expires_at: string | null
  created_at: string
}

interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  description: string | null
  is_active: boolean
  created_at: string
}

export default function SettingsPage() {
  const { currentStore, role } = useAuth()
  const storeId = currentStore?.store_id ?? null
  const { csrfFetch } = useCSRF()
  const isOwner = role === 'Owner'

  // POS
  const { data: posConnections, isLoading: loadingPos } = usePosConnections(storeId)
  const createPosConnection = useCreatePosConnection(storeId)
  const { data: posEvents, isLoading: loadingPosEvents } = usePosSaleEvents(storeId)

  // API Keys (Owner only)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [showApiKeyForm, setShowApiKeyForm] = useState(false)
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null)

  // Webhooks (Owner only)
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])
  const [loadingWebhooks, setLoadingWebhooks] = useState(false)
  const [showWebhookForm, setShowWebhookForm] = useState(false)
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null)

  // Alerts
  const { preferences, isLoading: loadingPrefs, updatePreferences, isUpdating } = useAlertPreferences(storeId)

  // POS connection form
  const [showPosForm, setShowPosForm] = useState(false)
  const [posProvider, setPosProvider] = useState('')
  const [posName, setPosName] = useState('')

  // Fetch API keys
  const fetchApiKeys = useCallback(async () => {
    if (!storeId || !isOwner) return
    try {
      setLoadingKeys(true)
      const res = await fetch(`/api/stores/${storeId}/api-keys`)
      const data = await res.json()
      if (res.ok) setApiKeys(data.data || [])
    } catch {
      /* ignore */
    } finally {
      setLoadingKeys(false)
    }
  }, [storeId, isOwner])

  // Fetch webhooks
  const fetchWebhooks = useCallback(async () => {
    if (!storeId || !isOwner) return
    try {
      setLoadingWebhooks(true)
      const res = await fetch(`/api/stores/${storeId}/webhooks`)
      const data = await res.json()
      if (res.ok) setWebhooks(data.data || [])
    } catch {
      /* ignore */
    } finally {
      setLoadingWebhooks(false)
    }
  }, [storeId, isOwner])

  useEffect(() => {
    fetchApiKeys()
    fetchWebhooks()
  }, [fetchApiKeys, fetchWebhooks])

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">This feature is only available to Owners and Managers.</CardContent></Card>
      </div>
    )
  }

  if (!storeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Select a store to manage settings.</CardContent></Card>
      </div>
    )
  }

  // Handlers
  const handleCreateApiKey = async (data: { name: string; scopes: string[]; expires_in_days?: number }) => {
    const res = await csrfFetch(`/api/stores/${storeId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.message)
    toast.success('API key created')
    fetchApiKeys()
    return result.data
  }

  const handleRevokeApiKey = async () => {
    if (!revokingKeyId) return
    try {
      const res = await csrfFetch(`/api/stores/${storeId}/api-keys/${revokingKeyId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to revoke')
      toast.success('API key revoked')
      setRevokingKeyId(null)
      fetchApiKeys()
    } catch {
      toast.error('Failed to revoke API key')
    }
  }

  const handleCreateWebhook = async (data: { url: string; events: string[]; description?: string }) => {
    const res = await csrfFetch(`/api/stores/${storeId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.message)
    toast.success('Webhook endpoint created')
    fetchWebhooks()
    return result.data
  }

  const handleDeleteWebhook = async () => {
    if (!deletingWebhookId) return
    try {
      const res = await csrfFetch(`/api/stores/${storeId}/webhooks/${deletingWebhookId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Webhook endpoint deleted')
      setDeletingWebhookId(null)
      fetchWebhooks()
    } catch {
      toast.error('Failed to delete webhook')
    }
  }

  const handleCreatePosConnection = async () => {
    if (!posProvider || !posName) return
    try {
      await createPosConnection.mutateAsync({ provider: posProvider, name: posName })
      toast.success('POS connection created')
      setShowPosForm(false)
      setPosProvider('')
      setPosName('')
    } catch {
      toast.error('Failed to create POS connection')
    }
  }

  const handleAlertToggle = async (field: string, value: boolean) => {
    try {
      await updatePreferences({ [field]: value })
      toast.success('Alert preferences updated')
    } catch {
      toast.error('Failed to update preferences')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure integrations and preferences for {currentStore?.store?.name ?? 'your store'}
        </p>
      </div>

      <Tabs defaultValue="pos">
        <TabsList>
          <TabsTrigger value="pos" className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            POS Integration
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="api-keys" className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              API Keys
            </TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger value="webhooks" className="flex items-center gap-1.5">
              <Webhook className="h-3.5 w-3.5" />
              Webhooks
            </TabsTrigger>
          )}
          <TabsTrigger value="alerts" className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* POS Tab */}
        <TabsContent value="pos" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">POS Connections</h2>
              <p className="text-sm text-muted-foreground">Connect your point-of-sale system to auto-deduct inventory on sales.</p>
            </div>
            <Button onClick={() => setShowPosForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </div>

          {showPosForm && (
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={posProvider} onValueChange={setPosProvider}>
                      <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="toast">Toast</SelectItem>
                        <SelectItem value="clover">Clover</SelectItem>
                        <SelectItem value="lightspeed">Lightspeed</SelectItem>
                        <SelectItem value="custom">Custom Webhook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Connection Name</Label>
                    <Input value={posName} onChange={e => setPosName(e.target.value)} placeholder="e.g., Main Register" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreatePosConnection} disabled={createPosConnection.isPending}>
                    {createPosConnection.isPending ? 'Connecting...' : 'Connect'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowPosForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loadingPos ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : !posConnections || posConnections.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No POS connections"
              description="Connect your POS system to automatically deduct inventory when sales are made."
              action={{ label: 'Add Connection', onClick: () => setShowPosForm(true), icon: Plus }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {posConnections.map(conn => (
                <Card key={conn.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{conn.name}</h3>
                        <p className="text-sm text-muted-foreground capitalize">{conn.provider}</p>
                      </div>
                      <Badge variant={conn.is_active ? 'default' : 'secondary'}>
                        {conn.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t text-sm">
                      <div>
                        <span className="text-muted-foreground">Sync Status:</span>
                        <span className="ml-1 font-medium capitalize">{conn.sync_status}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Synced:</span>
                        <span className="ml-1 font-medium">
                          {conn.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : 'Never'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Recent POS Events */}
          {posEvents && posEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Recent Sale Events</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posEvents.slice(0, 10).map(event => (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-xs">{event.external_event_id.slice(0, 12)}...</TableCell>
                        <TableCell>{event.event_type}</TableCell>
                        <TableCell>{event.total_amount ? `$${event.total_amount.toFixed(2)}` : '-'}</TableCell>
                        <TableCell>
                          {event.status === 'processed' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : event.status === 'failed' ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{new Date(event.occurred_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* API Keys Tab (Owner only) */}
        {isOwner && (
          <TabsContent value="api-keys" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">API Keys</h2>
                <p className="text-sm text-muted-foreground">Manage API keys for programmatic access to your store data.</p>
              </div>
              <Button onClick={() => setShowApiKeyForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </div>

            {loadingKeys ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : apiKeys.length === 0 ? (
              <EmptyState
                icon={Key}
                title="No API keys"
                description="Create an API key to integrate with external services."
                action={{ label: 'Create Key', onClick: () => setShowApiKeyForm(true), icon: Plus }}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Key Prefix</TableHead>
                        <TableHead>Scopes</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map(key => (
                        <TableRow key={key.id}>
                          <TableCell className="font-medium">{key.name}</TableCell>
                          <TableCell className="font-mono text-xs">{key.key_prefix}...</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.slice(0, 3).map(scope => (
                                <Badge key={scope} variant="secondary" className="text-xs">{scope}</Badge>
                              ))}
                              {key.scopes.length > 3 && (
                                <Badge variant="secondary" className="text-xs">+{key.scopes.length - 3}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={key.is_active ? 'default' : 'secondary'}>
                              {key.is_active ? 'Active' : 'Revoked'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {key.is_active && (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevokingKeyId(key.id)}>
                                Revoke
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Webhooks Tab (Owner only) */}
        {isOwner && (
          <TabsContent value="webhooks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Webhook Endpoints</h2>
                <p className="text-sm text-muted-foreground">Receive real-time notifications when events occur in your store.</p>
              </div>
              <Button onClick={() => setShowWebhookForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Endpoint
              </Button>
            </div>

            {loadingWebhooks ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : webhooks.length === 0 ? (
              <EmptyState
                icon={Webhook}
                title="No webhook endpoints"
                description="Add a webhook endpoint to receive real-time event notifications."
                action={{ label: 'Add Endpoint', onClick: () => setShowWebhookForm(true), icon: Plus }}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>URL</TableHead>
                        <TableHead>Events</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map(wh => (
                        <TableRow key={wh.id}>
                          <TableCell className="font-mono text-xs max-w-[250px] truncate">{wh.url}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {wh.events.slice(0, 2).map(e => (
                                <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                              ))}
                              {wh.events.length > 2 && (
                                <Badge variant="secondary" className="text-xs">+{wh.events.length - 2}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={wh.is_active ? 'default' : 'secondary'}>
                              {wh.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{new Date(wh.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => setDeletingWebhookId(wh.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Alert Preferences</h2>
            <p className="text-sm text-muted-foreground">Configure when and how you receive inventory alerts.</p>
          </div>

          {loadingPrefs ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : preferences ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Alert Types</CardTitle>
                  <CardDescription>Choose which alerts to receive.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Low Stock Alerts</Label>
                      <p className="text-xs text-muted-foreground">Notify when items fall below PAR level</p>
                    </div>
                    <Switch
                      checked={preferences.low_stock_enabled}
                      onCheckedChange={v => handleAlertToggle('low_stock_enabled', v)}
                      disabled={isUpdating}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Critical Stock Alerts</Label>
                      <p className="text-xs text-muted-foreground">Notify when items are critically low</p>
                    </div>
                    <Switch
                      checked={preferences.critical_stock_enabled}
                      onCheckedChange={v => handleAlertToggle('critical_stock_enabled', v)}
                      disabled={isUpdating}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Missing Count Alerts</Label>
                      <p className="text-xs text-muted-foreground">Notify when scheduled counts are missed</p>
                    </div>
                    <Switch
                      checked={preferences.missing_count_enabled}
                      onCheckedChange={v => handleAlertToggle('missing_count_enabled', v)}
                      disabled={isUpdating}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Delivery</CardTitle>
                  <CardDescription>Configure how alerts are delivered.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Notifications</Label>
                      <p className="text-xs text-muted-foreground">Receive alerts via email</p>
                    </div>
                    <Switch
                      checked={preferences.email_enabled}
                      onCheckedChange={v => handleAlertToggle('email_enabled', v)}
                      disabled={isUpdating}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select
                        value={preferences.alert_frequency}
                        onValueChange={async (v) => {
                          try {
                            await updatePreferences({ alert_frequency: v as 'daily' | 'weekly' | 'never' })
                            toast.success('Frequency updated')
                          } catch { toast.error('Failed to update') }
                        }}
                        disabled={isUpdating}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred Hour</Label>
                      <Select
                        value={String(preferences.preferred_hour)}
                        onValueChange={async (v) => {
                          try {
                            await updatePreferences({ preferred_hour: parseInt(v) })
                            toast.success('Preferred hour updated')
                          } catch { toast.error('Failed to update') }
                        }}
                        disabled={isUpdating}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }).map((_, h) => (
                            <SelectItem key={h} value={String(h)}>
                              {h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ApiKeyForm
        open={showApiKeyForm}
        onOpenChange={setShowApiKeyForm}
        onSubmit={handleCreateApiKey}
      />

      <WebhookForm
        open={showWebhookForm}
        onOpenChange={setShowWebhookForm}
        onSubmit={handleCreateWebhook}
      />

      <AlertDialog open={!!revokingKeyId} onOpenChange={open => { if (!open) setRevokingKeyId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>This will immediately invalidate this API key. Any integrations using it will stop working.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeApiKey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingWebhookId} onOpenChange={open => { if (!open) setDeletingWebhookId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this webhook endpoint?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWebhook} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
