import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatsCardVariant = "default" | "warning" | "success" | "danger";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  variant?: StatsCardVariant;
}

const cardStyles: Record<StatsCardVariant, string> = {
  default: "",
  warning: "border-amber-500 bg-amber-500/10",
  success: "border-emerald-500 bg-emerald-500/10",
  danger: "border-destructive bg-destructive/10",
};

const iconStyles: Record<StatsCardVariant, string> = {
  default:
    "text-muted-foreground group-hover:text-foreground transition-colors duration-200",
  warning: "text-amber-400",
  success: "text-emerald-400",
  danger: "text-destructive",
};

const valueStyles: Record<StatsCardVariant, string> = {
  default: "",
  warning: "",
  success: "",
  danger: "text-destructive",
};

export function StatsCard({
  title,
  value,
  description,
  icon,
  className,
  variant = "default",
}: StatsCardProps) {
  return (
    <Card className={cn("group py-5 gap-4", cardStyles[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={iconStyles[variant]}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight",
            valueStyles[variant],
          )}
        >
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
