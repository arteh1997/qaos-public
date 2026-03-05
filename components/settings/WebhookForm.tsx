"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_EVENTS: Record<string, string> = {
  "inventory.item_created": "When a new inventory item is added",
  "inventory.item_updated": "When an inventory item is modified",
  "inventory.item_deleted": "When an inventory item is removed",
  "stock.counted": "When a stock count is submitted",
  "stock.received": "When a stock reception is recorded",
  "stock.low_alert": "When stock falls below PAR level",
  "waste.recorded": "When waste is logged",
  "purchase_order.created": "When a new PO is created",
  "purchase_order.status_changed": "When a PO status changes",
  "purchase_order.received": "When a PO is received",
};

const webhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.string()).min(1, "Select at least one event"),
  description: z.string().max(500).optional(),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

interface WebhookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    url: string;
    events: string[];
    description?: string;
  }) => Promise<{ secret: string } | undefined>;
}

export function WebhookForm({
  open,
  onOpenChange,
  onSubmit,
}: WebhookFormProps) {
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      url: "",
      events: [],
      description: "",
    },
  });

  const handleSubmit = async (values: WebhookFormValues) => {
    try {
      setIsSubmitting(true);
      const result = await onSubmit({
        url: values.url,
        events: values.events,
        description: values.description || undefined,
      });
      if (result?.secret) {
        setCreatedSecret(result.secret);
      }
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCreatedSecret(null);
    form.reset();
    onOpenChange(false);
  };

  const copySecret = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      toast.success("Webhook secret copied to clipboard");
    }
  };

  if (createdSecret) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Created</DialogTitle>
            <DialogDescription>
              Copy your signing secret now. You won&apos;t be able to see it
              again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
              {createdSecret}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={copySecret}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                Use this secret to verify webhook signatures (HMAC-SHA256). It
                will only be shown once.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Webhook Endpoint</DialogTitle>
          <DialogDescription>
            Configure a URL to receive real-time event notifications.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint URL *</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://your-app.com/webhooks"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="events"
              render={() => (
                <FormItem>
                  <FormLabel>Events *</FormLabel>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {Object.entries(WEBHOOK_EVENTS).map(
                      ([event, description]) => (
                        <FormField
                          key={event}
                          control={form.control}
                          name="events"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(event)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    field.onChange(
                                      checked
                                        ? [...current, event]
                                        : current.filter(
                                            (e: string) => e !== event,
                                          ),
                                    );
                                  }}
                                />
                              </FormControl>
                              <div className="leading-none">
                                <span className="text-sm font-medium font-mono">
                                  {event}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {description}
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      ),
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What this webhook is for..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Webhook"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
