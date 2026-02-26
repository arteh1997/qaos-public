'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { POS_PROVIDERS } from '@/lib/services/pos'
import { useCreatePosConnection } from '@/hooks/usePosConnections'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Key,
  Wifi,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

type Step = 'auth' | 'mapping'

interface ConnectionWizardProps {
  provider: string
  storeId: string
  onComplete: (connectionId: string) => void
  onBack: () => void
}

export function ConnectionWizard({ provider, storeId, onComplete, onBack }: ConnectionWizardProps) {
  const providerInfo = POS_PROVIDERS[provider]
  const isOAuth = providerInfo?.authType === 'oauth2'
  const [step, setStep] = useState<Step>('auth')

  // API key state (for non-OAuth providers)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [connectionName, setConnectionName] = useState(providerInfo?.name || provider)

  const createConnection = useCreatePosConnection(storeId)

  const handleOAuthConnect = () => {
    window.location.href = `/api/integrations/pos/${provider}/auth?store_id=${storeId}`
  }

  const handleApiKeyConnect = async () => {
    if (!apiKey.trim()) {
      toast.error('API key is required')
      return
    }

    try {
      const result = await createConnection.mutateAsync({
        provider,
        name: connectionName.trim() || providerInfo?.name || provider,
        credentials: {
          api_key: apiKey.trim(),
          ...(apiSecret.trim() && { api_secret: apiSecret.trim() }),
          ...(webhookSecret.trim() && { webhook_secret: webhookSecret.trim() }),
        },
        config: {},
      })
      toast.success(`${providerInfo?.name || provider} connected successfully`)
      onComplete(result.data?.id || '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h2 className="text-base font-semibold">
            Connect {providerInfo?.name || provider}
          </h2>
          <p className="text-sm text-muted-foreground">
            {providerInfo?.description}
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step === 'auth' ? 'default' : 'secondary'}>
          1. Authenticate
        </Badge>
        <ArrowRight className="size-3 text-muted-foreground" />
        <Badge variant={step === 'mapping' ? 'default' : 'secondary'}>
          2. Map Items
        </Badge>
      </div>

      {step === 'auth' && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {isOAuth ? 'Connect via OAuth' : 'Enter API Credentials'}
            </CardTitle>
            <CardDescription>
              {isOAuth
                ? `You'll be redirected to ${providerInfo?.name} to authorise access. Once approved, you'll return here automatically.`
                : `Enter your ${providerInfo?.name || provider} API credentials. You can find these in your ${providerInfo?.name || provider} settings.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOAuth ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <div className="flex items-start gap-3">
                    <Wifi className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">What we&apos;ll access:</p>
                      <ul className="mt-1 text-muted-foreground space-y-0.5">
                        <li>Read your menu items and products</li>
                        <li>Receive sale notifications via webhook</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button onClick={handleOAuthConnect} className="w-full sm:w-auto">
                  Connect {providerInfo?.name}
                  <ExternalLink className="size-3.5 ml-1.5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="connectionName">Connection Name</Label>
                  <Input
                    id="connectionName"
                    value={connectionName}
                    onChange={e => setConnectionName(e.target.value)}
                    placeholder={providerInfo?.name || 'My POS'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">
                    <Key className="size-3.5 inline mr-1" />
                    API Key <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                  />
                </div>

                {provider === 'tevalis' && (
                  <div className="space-y-2">
                    <Label htmlFor="apiSecret">API Secret</Label>
                    <Input
                      id="apiSecret"
                      type="password"
                      value={apiSecret}
                      onChange={e => setApiSecret(e.target.value)}
                      placeholder="Enter your API secret"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="webhookSecret">Webhook Secret (optional)</Label>
                  <Input
                    id="webhookSecret"
                    type="password"
                    value={webhookSecret}
                    onChange={e => setWebhookSecret(e.target.value)}
                    placeholder="For verifying incoming webhooks"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used to verify that webhooks are genuinely from {providerInfo?.name || provider}
                  </p>
                </div>

                <Button
                  onClick={handleApiKeyConnect}
                  disabled={!apiKey.trim() || createConnection.isPending}
                  className="w-full sm:w-auto"
                >
                  {createConnection.isPending ? (
                    <><Loader2 className="size-4 mr-1.5 animate-spin" />Connecting...</>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 mr-1.5" />
                      Save &amp; Connect
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
