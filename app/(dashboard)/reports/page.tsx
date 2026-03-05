import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  Sparkles,
  ChefHat,
} from "lucide-react";
import { PageGuide } from "@/components/help/PageGuide";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Insights and analytics to run your operation smarter
          </p>
        </div>
        <PageGuide pageKey="reports" />
      </div>

      {/* Featured: AI Forecast — full width */}
      <Link href="/reports/forecast" className="block">
        <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:border-purple-300/60 cursor-pointer border-purple-500/20/40">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] to-violet-500/[0.06] pointer-events-none" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="rounded-lg p-2.5 bg-purple-500/10 ring-1 ring-purple-500/20">
                  <Brain className="h-5 w-5 text-purple-400" />
                </div>
                AI Demand Forecast
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] uppercase tracking-wider font-semibold"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                AI-Powered
              </Badge>
            </div>
            <CardDescription className="ml-[52px]">
              Predict future consumption, prevent stockouts, and get intelligent
              order suggestions
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="ml-[52px] grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                Consumption trend analysis
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                Stockout risk predictions
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                Auto order suggestions
              </div>
            </div>
            <div className="ml-[52px] mt-4 text-sm font-medium text-purple-400 flex items-center gap-1 group-hover:gap-2 transition-all">
              Open Forecast
              <ArrowRight className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Featured: Food Cost Analysis — full width */}
      <Link href="/reports/food-cost" className="block">
        <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:border-orange-300/60 cursor-pointer border-orange-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.03] to-red-500/[0.06] pointer-events-none" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="rounded-lg p-2.5 bg-orange-500/10 ring-1 ring-orange-500/20">
                  <ChefHat className="h-5 w-5 text-orange-400" />
                </div>
                Actual vs Theoretical Food Cost
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px] uppercase tracking-wider font-semibold"
              >
                Premium
              </Badge>
            </div>
            <CardDescription className="ml-[52px]">
              Compare what food SHOULD cost vs what it ACTUALLY costs — identify
              waste, shrinkage, and portioning issues
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="ml-[52px] grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Recipe cost × POS sales
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Variance & shrinkage analysis
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Category breakdowns
              </div>
            </div>
            <div className="ml-[52px] mt-4 text-sm font-medium text-orange-400 flex items-center gap-1 group-hover:gap-2 transition-all">
              Analyse Food Cost
              <ArrowRight className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Other reports in 3-column grid */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-3">
        <Link href="/reports/benchmark">
          <Card className="group transition-all hover:shadow-md hover:border-primary/30 cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="rounded-lg p-2.5 bg-blue-500/10 ring-1 ring-blue-500/20">
                  <BarChart3 className="h-5 w-5 text-blue-400" />
                </div>
                Store Benchmarking
              </CardTitle>
              <CardDescription className="ml-[52px]">
                Compare performance across all your stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="ml-[52px] text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-blue-400" />
                  Side-by-side comparison
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-blue-400" />
                  Health scores & rankings
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-blue-400" />
                  Activity trends & KPIs
                </li>
              </ul>
              <div className="ml-[52px] mt-4 text-sm font-medium text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                View Report
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reports/daily-summary">
          <Card className="group transition-all hover:shadow-md hover:border-primary/30 cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="rounded-lg p-2.5 bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <FileText className="h-5 w-5 text-emerald-400" />
                </div>
                Stock Summary
              </CardTitle>
              <CardDescription className="ml-[52px]">
                Complete log of every stock change by date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="ml-[52px] text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-emerald-400" />
                  Counts, receptions & adjustments
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-emerald-400" />
                  Full audit trail by user
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-emerald-400" />
                  CSV export & print
                </li>
              </ul>
              <div className="ml-[52px] mt-4 text-sm font-medium text-emerald-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                View Report
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reports/low-stock">
          <Card className="group transition-all hover:shadow-md hover:border-primary/30 cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="rounded-lg p-2.5 bg-amber-500/10 ring-1 ring-amber-500/20">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                Low Stock Alert
              </CardTitle>
              <CardDescription className="ml-[52px]">
                Items below PAR level that need restocking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="ml-[52px] text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-amber-400" />
                  Ranked by shortage severity
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-amber-400" />
                  Current vs PAR comparison
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-amber-400" />
                  One-click CSV export
                </li>
              </ul>
              <div className="ml-[52px] mt-4 text-sm font-medium text-amber-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                View Report
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
