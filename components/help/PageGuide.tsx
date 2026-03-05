"use client";

import { useState, useCallback } from "react";
import { HelpCircle, Lightbulb } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePageGuide } from "@/hooks/usePageGuide";
import {
  PAGE_GUIDES,
  type PageKey,
  type GuideTip,
} from "@/lib/help/page-guides";
import { cn } from "@/lib/utils";

interface PageGuideProps {
  pageKey: PageKey;
  className?: string;
}

export function PageGuide({ pageKey, className }: PageGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { hasSeen, markSeen } = usePageGuide(pageKey);
  const guide = PAGE_GUIDES[pageKey];

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open && !hasSeen) {
        markSeen();
      }
    },
    [hasSeen, markSeen],
  );

  if (!guide) return null;

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleOpenChange(true)}
              className={cn(
                "relative inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent",
                className,
              )}
              aria-label="Open page guide"
            >
              <HelpCircle className="h-4 w-4" />
              {!hasSeen && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Page guide</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="bg-card p-0 gap-0 flex flex-col overflow-hidden"
        >
          <SheetHeader className="px-6 pt-6 pb-5 border-b border-border shrink-0">
            <SheetTitle>{guide.title}</SheetTitle>
            <SheetDescription>{guide.overview}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-5 space-y-5">
              {guide.tips.map((tip, index) => (
                <TipItem key={index} tip={tip} index={index} />
              ))}
              {guide.proTip && <ProTipBox text={guide.proTip} />}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TipItem({ tip, index }: { tip: GuideTip; index: number }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <span className="text-xs font-semibold text-primary">{index + 1}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{tip.title}</p>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
          {tip.description}
        </p>
      </div>
    </div>
  );
}

function ProTipBox({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
        <p className="text-xs font-semibold text-amber-400">Pro tip</p>
      </div>
      <p className="text-sm text-amber-400 leading-relaxed">{text}</p>
    </div>
  );
}
