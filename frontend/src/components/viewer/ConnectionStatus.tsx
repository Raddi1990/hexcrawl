import { cn } from "@/lib/utils";

// A capability the old 3s-polling design had no equivalent for: a failed poll was
// simply invisible. WebSocket push makes connection health worth surfacing.
export function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur">
      <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
      {connected ? "Verbunden" : "Verbinde…"}
    </div>
  );
}
