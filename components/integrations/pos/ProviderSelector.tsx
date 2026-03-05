"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POS_PROVIDERS } from "@/lib/services/pos";
import {
  Monitor,
  CreditCard,
  Smartphone,
  ShoppingCart,
  Store,
  Wifi,
  Globe,
  Zap,
  Settings,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  square: CreditCard,
  toast: Store,
  clover: ShoppingCart,
  lightspeed: Zap,
  zettle: Smartphone,
  sumup: CreditCard,
  epos_now: Monitor,
  tevalis: Globe,
  foodics: Globe,
  oracle_micros: Monitor,
  ncr_voyix: Monitor,
  spoton: CreditCard,
  revel: Smartphone,
  touchbistro: Smartphone,
  gastrofix: Smartphone,
  iiko: Globe,
  posrocket: Globe,
  par_brink: Monitor,
  heartland: CreditCard,
  hungerrush: Store,
  cake: Smartphone,
  lavu: Smartphone,
  focus_pos: Monitor,
  shopify_pos: ShoppingCart,
  aldelo_express: Monitor,
  squirrel: Monitor,
  gotab: Smartphone,
  xenial: Monitor,
  qu_pos: Store,
  future_pos: Monitor,
  upserve: CreditCard,
  sicom: Monitor,
  positouch: Monitor,
  harbortouch: CreditCard,
  digital_dining: Monitor,
  maitred: Store,
  speedline: Store,
  custom: Settings,
};

interface ProviderSelectorProps {
  onSelect: (provider: string) => void;
  connectedProviders?: string[];
}

export function ProviderSelector({
  onSelect,
  connectedProviders = [],
}: ProviderSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredProviders = Object.entries(POS_PROVIDERS).filter(
    ([_key, provider]) =>
      provider.name.toLowerCase().includes(search.toLowerCase()) ||
      provider.description.toLowerCase().includes(search.toLowerCase()) ||
      provider.region.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Choose your POS provider</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select the point-of-sale system your restaurant uses
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search POS providers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProviders.map(([key, provider]) => {
          const Icon = PROVIDER_ICONS[key] || Monitor;
          const isConnected = connectedProviders.includes(key);

          return (
            <Card
              key={key}
              className={`cursor-pointer transition-colors hover:border-foreground/20 ${
                isConnected ? "border-emerald-500/20 bg-emerald-500/10" : ""
              }`}
              onClick={() => !isConnected && onSelect(key)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{provider.name}</h3>
                      {isConnected && (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-400 text-xs"
                        >
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {provider.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {provider.authType === "oauth2" ? (
                          <>
                            <Wifi className="size-3 mr-1" />
                            OAuth
                          </>
                        ) : (
                          <>
                            <Settings className="size-3 mr-1" />
                            API Key
                          </>
                        )}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {provider.region}
                      </Badge>
                    </div>
                  </div>
                </div>

                {!isConnected && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(key);
                    }}
                  >
                    Connect
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
