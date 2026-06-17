import { cn } from "@/lib/utils";
import { flagUrl, initials, type Team } from "@/lib/palpite-data";

type TeamFlagProps = {
  team: Team;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { frame: "h-7 w-9", width: 40, height: 28 },
  md: { frame: "h-9 w-12", width: 80, height: 56 },
  lg: { frame: "h-12 w-16", width: 80, height: 56 },
};

export function TeamFlag({
  team,
  size = "md",
  showName = false,
  className,
}: TeamFlagProps) {
  const dimensions = sizeMap[size];

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        className={cn(
          "flag-sticker-shadow relative grid shrink-0 place-items-center overflow-hidden rounded-md bg-white text-xs font-bold text-slate-700",
          dimensions.frame
        )}
      >
        {team.logoUrl || team.code !== "un" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.logoUrl ?? flagUrl(team.code, dimensions.width === 40 ? 40 : 80)}
            alt={`Bandeira de ${team.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          initials(team.name) || "TBD"
        )}
      </span>
      {showName ? (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">
            {team.name}
          </span>
          <span className="block text-xs font-medium text-muted-foreground">
            Grupo {team.group} · {team.shortName}
          </span>
        </span>
      ) : null}
    </div>
  );
}
