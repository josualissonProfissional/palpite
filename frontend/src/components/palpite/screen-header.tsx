import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NeonGradientCard } from "@/components/ui/neon-gradient-card";

type ScreenHeaderProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function ScreenHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
}: ScreenHeaderProps) {
  return (
    <NeonGradientCard
      autoSize
      borderSize={2}
      borderRadius={14}
      neonColors={{ firstColor: "#2563eb", secondColor: "#f97316" }}
      className="min-h-0"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-1 text-[11px]">
              {eyebrow}
            </Badge>
            <h1 className="font-heading text-xl font-bold tracking-normal text-slate-950 dark:text-white sm:text-2xl">
              {title}
            </h1>
            <p className="max-w-2xl text-xs text-muted-foreground sm:text-sm">
              {description}
            </p>
          </div>
        </div>
        {action ? <div className="w-full md:w-auto [&>*]:w-full md:[&>*]:w-auto">{action}</div> : null}
      </div>
    </NeonGradientCard>
  );
}
