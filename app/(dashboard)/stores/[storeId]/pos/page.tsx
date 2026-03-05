"use client";

import { useState, use } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  usePosConnections,
  usePosSaleEvents,
  type PosConnection,
  type PosSaleEvent as PosSaleEventType,
} from "@/hooks/usePosConnections";
import { POS_PROVIDERS } from "@/lib/services/pos";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide } from "@/components/help/PageGuide";
import { ProviderSelector } from "@/components/integrations/pos/ProviderSelector";
import { ConnectionWizard } from "@/components/integrations/pos/ConnectionWizard";
import { MenuSyncTable } from "@/components/integrations/pos/MenuSyncTable";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  Monitor,
  Wifi,
  WifiOff,
  Clock,
  AlertCircle,
  CheckCircle2,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const SYNC_STATUS_COLORS: Record<string, string> = {
  synced: "bg-emerald-500/10 text-emerald-800",
  syncing: "bg-blue-500/10 text-blue-400",
  pending: "bg-amber-500/10 text-amber-400",
  error: "bg-destructive/10 text-destructive",
};

const EVENT_STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  processed: CheckCircle2,
  failed: AlertCircle,
  pending: Clock,
  skipped: Clock,
};

function ConnectionCard({
  connection,
  storeId,
  isExpanded,
  onToggle,
}: {
  connection: PosConnection;
  storeId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const provider =
    POS_PROVIDERS[connection.provider as keyof typeof POS_PROVIDERS];

  return (
    <div className="space-y-0">
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                <Monitor className="size-5" />
              </div>
              <div>
                <h3 className="font-medium">{connection.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {provider?.name ?? connection.provider}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connection.is_active ? (
                <Wifi className="size-4 text-emerald-500" />
              ) : (
                <WifiOff className="size-4 text-muted-foreground" />
              )}
              <Badge
                variant="secondary"
                className={SYNC_STATUS_COLORS[connection.sync_status] ?? ""}
              >
                {connection.sync_status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div>
              {connection.last_synced_at && (
                <p className="text-xs text-muted-foreground">
                  Last synced:{" "}
                  {new Date(connection.last_synced_at).toLocaleString()}
                </p>
              )}
              {connection.sync_error && (
                <p className="text-xs text-destructive mt-0.5">
                  {connection.sync_error}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <Settings className="size-3.5 mr-1" />
              Item Mapping
              {isExpanded ? (
                <ChevronUp className="size-3.5 ml-1" />
              ) : (
                <ChevronDown className="size-3.5 ml-1" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expandable item mapping section */}
      {isExpanded && (
        <div className="border border-t-0 rounded-b-xl bg-muted/20 p-4">
          <MenuSyncTable
            storeId={storeId}
            connectionId={connection.id}
            connectionProvider={connection.provider}
          />
        </div>
      )}
    </div>
  );
}

function SaleEventRow({ event }: { event: PosSaleEventType }) {
  const StatusIcon = EVENT_STATUS_ICONS[event.status] ?? Clock;

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon
          className={`size-4 ${
            event.status === "processed"
              ? "text-emerald-500"
              : event.status === "failed"
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        />
        <div>
          <p className="text-sm font-medium">
            {event.event_type} - {event.external_event_id.slice(0, 12)}...
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(event.occurred_at).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="text-right">
        {event.total_amount !== null && (
          <p className="text-sm font-medium">
            £{event.total_amount.toFixed(2)}
          </p>
        )}
        <Badge variant="secondary" className="text-xs">
          {event.status}
        </Badge>
      </div>
    </div>
  );
}

export default function PosSettingsPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = use(params);
  const { role } = useAuth();
  const { data: connections, isLoading: connectionsLoading } =
    usePosConnections(storeId);
  const { data: events, isLoading: eventsLoading } = usePosSaleEvents(storeId);
  const searchParams = useSearchParams();

  const [view, setView] = useState<"main" | "add" | "wizard">("main");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [expandedConnection, setExpandedConnection] = useState<string | null>(
    null,
  );

  // Handle OAuth success redirect
  const success = searchParams.get("success");
  const successProvider = searchParams.get("provider");
  useEffect(() => {
    if (success === "connected" && successProvider) {
      const providerName =
        POS_PROVIDERS[successProvider]?.name || successProvider;
      toast.success(`${providerName} connected successfully!`);
    }
  }, [success, successProvider]);

  // Handle OAuth error redirect
  const error = searchParams.get("error");
  useEffect(() => {
    if (error) {
      toast.error(`POS connection failed: ${error}`);
    }
  }, [error]);

  if (role !== "Owner" && role !== "Manager") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="POS Integration"
          description="Connect your point-of-sale system"
        >
          <PageGuide pageKey="pos" />
        </PageHeader>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            This feature is only available to Owners and Managers.
          </CardContent>
        </Card>
      </div>
    );
  }

  const connectedProviders = (connections || [])
    .filter((c) => c.is_active)
    .map((c) => c.provider);

  // Add New Connection flow
  if (view === "add") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="POS Integration"
          description="Add a new POS connection"
        >
          <Button variant="outline" size="sm" onClick={() => setView("main")}>
            Back
          </Button>
          <PageGuide pageKey="pos" />
        </PageHeader>
        <ProviderSelector
          onSelect={(provider) => {
            setSelectedProvider(provider);
            setView("wizard");
          }}
          connectedProviders={connectedProviders}
        />
      </div>
    );
  }

  // Connection Wizard
  if (view === "wizard" && selectedProvider) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="POS Integration"
          description="Connect your POS system"
        >
          <PageGuide pageKey="pos" />
        </PageHeader>
        <ConnectionWizard
          provider={selectedProvider}
          storeId={storeId}
          onComplete={() => {
            setView("main");
            setSelectedProvider(null);
          }}
          onBack={() => {
            setView("add");
            setSelectedProvider(null);
          }}
        />
      </div>
    );
  }

  // Main view
  return (
    <div className="space-y-6">
      <PageHeader
        title="POS Integration"
        description="Connect your Point-of-Sale system to automatically track sales"
      >
        <Button size="sm" onClick={() => setView("add")}>
          <Plus className="size-4 mr-1.5" />
          Add Connection
        </Button>
        <PageGuide pageKey="pos" />
      </PageHeader>

      {/* Connections */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Connected Systems
        </h2>

        {connectionsLoading ? (
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : connections && connections.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                storeId={storeId}
                isExpanded={expandedConnection === conn.id}
                onToggle={() =>
                  setExpandedConnection(
                    expandedConnection === conn.id ? null : conn.id,
                  )
                }
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <Monitor className="size-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">No POS systems connected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your POS to automatically deduct inventory when sales
                occur.
              </p>
              <Button size="sm" onClick={() => setView("add")}>
                <Plus className="size-4 mr-1.5" />
                Add Your First Connection
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How POS Integration Works</CardTitle>
          <CardDescription>
            Automatic inventory deduction from sales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>
              Connect your POS system (Square, Zettle, SumUp, Lightspeed, and
              more)
            </li>
            <li>Map POS menu items to your inventory items</li>
            <li>When a sale occurs, the POS sends an event via webhook</li>
            <li>Inventory is automatically deducted based on your mappings</li>
            <li>Stock history records every POS-triggered change</li>
          </ol>
          {connections && connections.length > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">
                Webhook URL for your POS system:
              </p>
              <code className="text-xs text-muted-foreground break-all">
                {typeof window !== "undefined"
                  ? window.location.origin
                  : "https://your-app.com"}
                /api/pos/webhook/{connections[0].id}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recent Sale Events
        </h2>

        {eventsLoading ? (
          <Card>
            <CardContent className="pt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between py-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : events && events.length > 0 ? (
          <Card>
            <CardContent className="pt-4">
              {events.slice(0, 20).map((event) => (
                <SaleEventRow key={event.id} event={event} />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="text-sm">
                No sale events yet. Events will appear here once your POS system
                starts sending data.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
