import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center max-w-md gap-6">
        <span className="font-display text-[8rem] font-bold leading-none text-foreground/10 select-none">
          404
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/">Go to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/support">Get help</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
