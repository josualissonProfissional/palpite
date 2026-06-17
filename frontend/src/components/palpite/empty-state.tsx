import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Card className="border-white/70 bg-white/82 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
      <CardContent className="grid min-h-48 place-items-center p-6 text-center">
        <div>
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <h2 className="font-heading text-2xl font-bold">{title}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {description}
          </p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
