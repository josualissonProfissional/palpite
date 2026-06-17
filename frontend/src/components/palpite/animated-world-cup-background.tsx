import type { Team } from "@/lib/palpite-data";
import { TeamFlag } from "@/components/palpite/team-flag";

export function AnimatedWorldCupBackground({ teams = [] }: { teams?: Team[] }) {
  const visibleTeams = teams.slice(0, 8);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="world-cup-grid absolute inset-0 opacity-80" />
      <div
        className="absolute -left-28 top-6 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl"
        style={{ animation: "aurora-shift 12s ease-in-out infinite" }}
      />
      <div
        className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-orange-400/25 blur-3xl"
        style={{ animation: "aurora-shift 14s ease-in-out infinite reverse" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
        style={{ animation: "aurora-shift 16s ease-in-out infinite" }}
      />
      {visibleTeams.length > 0 ? (
        <div
          className="absolute left-0 top-36 hidden w-[120%] gap-5 opacity-70 md:flex"
          style={{ animation: "field-scan 18s ease-in-out infinite alternate" }}
        >
          {visibleTeams.concat(visibleTeams).map((team, index) => (
            <div
              key={`${team.shortName}-${index}`}
              className="rounded-xl border border-white/70 bg-white/60 p-2 backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/50"
            >
              <TeamFlag team={team} size="sm" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
