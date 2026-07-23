import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

function SkeletonRows({ count = 4, rowHeight = 60 }: { count?: number; rowHeight?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} style={{ height: rowHeight }} />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonRows };
