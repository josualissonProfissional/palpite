import Image from "next/image";

export function AppLoadingScreen({
  label = "Preparando seu bolão...",
}: {
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background px-4"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Logo with breathing animation + glow */}
      <div className="relative">
        <div
          className="absolute inset-0 scale-150 rounded-full bg-primary/20 blur-2xl"
          style={{ animation: "logo-glow 2.4s ease-in-out infinite" }}
        />

        <Image
          src="/logo/logo-apenas-desenho-sem-fundo.svg"
          alt="Palpitô"
          width={140}
          height={146}
          className="relative h-auto w-28 sm:w-36"
          style={{ animation: "logo-breathe 2.4s ease-in-out infinite" }}
          priority
        />
      </div>

      {/* Shimmer loading bar */}
      <div className="flex flex-col items-center gap-3">
        <div className="h-1.5 w-44 overflow-hidden rounded-full bg-muted sm:w-52">
          <div
            className="h-full w-2/5 rounded-full bg-primary"
            style={{ animation: "shimmer-slide 1.6s ease-in-out infinite" }}
          />
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      </div>

      <style>{`
        @keyframes logo-breathe {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes logo-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes shimmer-slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(180%); }
          100% { transform: translateX(-100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          html[data-reduced-motion] * {
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
