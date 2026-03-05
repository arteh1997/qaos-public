"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const API_SCOPES: Record<string, string> = {
  "inventory:read": "Read inventory items and stock levels",
  "inventory:write": "Create and update inventory items",
  "stock:read": "Read stock history and counts",
  "stock:write": "Submit stock counts and receptions",
  "reports:read": "Access analytics and reports",
  "webhooks:manage": "Manage webhook endpoints",
  "*": "Full access to all API endpoints",
};

const apiKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  scopes: z.array(z.string()).min(1, "Select at least one scope"),
  expires_in_days: z.string().optional(),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

interface ApiKeyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    scopes: string[];
    expires_in_days?: number;
  }) => Promise<{ key: string } | undefined>;
}

export function ApiKeyForm({ open, onOpenChange, onSubmit }: ApiKeyFormProps) {
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: "",
      scopes: [],
      expires_in_days: "never",
    },
  });

  const handleSubmit = async (values: ApiKeyFormValues) => {
    try {
      setIsSubmitting(true);
      const result = await onSubmit({
        name: values.name,
        scopes: values.scopes,
        expires_in_days:
          values.expires_in_days !== "never"
            ? parseInt(values.expires_in_days!)
            : undefined,
      });
      if (result?.key) {
        setCreatedKey(result.key);
      }
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCreatedKey(null);
    form.reset();
    onOpenChange(false);
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast.success("API key copied to clipboard");
    }
  };

  // Show key display after creation
  if (createdKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your API key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
              {createdKey}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={copyKey}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                Store this key in a secure location. It will only be shown once.
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
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Generate a new API key for programmatic access to your store data.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., POS Integration Key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scopes"
              render={() => (
                <FormItem>
                  <FormLabel>Scopes *</FormLabel>
                  <div className="space-y-2">
                    {Object.entries(API_SCOPES).map(([scope, description]) => (
                      <FormField
                        key={scope}
                        control={form.control}
                        name="scopes"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(scope)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  field.onChange(
                                    checked
                                      ? [...current, scope]
                                      : current.filter(
                                          (s: string) => s !== scope,
                                        ),
                                  );
                                }}
                              />
                            </FormControl>
                            <div className="leading-none">
                              <span className="text-sm font-medium font-mono">
                                {scope}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                {description}
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expires_in_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Key"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
