import Link from "next/link";
import { TextType } from "@/components/ui/text-type";

const socialLinks = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/josue.alisson/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/josu%C3%A9-alisson-1612ab1aa/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
        <path d="M5.35 8.97H2.43V21h2.92V8.97ZM3.9 3a1.69 1.69 0 1 0 0 3.38A1.69 1.69 0 0 0 3.9 3Zm17.67 10.92c0-3.23-1.72-5.22-4.52-5.22-1.7 0-2.76.92-3.2 1.57h-.04v-1.3h-2.8V21h2.92v-6.15c0-1.62.31-3.18 2.31-3.18 1.97 0 2 1.84 2 3.28V21h2.93v-7.08h.4Z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/josualissonProfissional",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2.25c-5.38 0-9.75 4.37-9.75 9.75 0 4.31 2.79 7.96 6.66 9.25.49.09.67-.21.67-.47v-1.8c-2.71.59-3.28-1.16-3.28-1.16-.44-1.13-1.08-1.43-1.08-1.43-.88-.6.07-.59.07-.59.98.07 1.49 1 1.49 1 .87 1.48 2.28 1.05 2.84.8.09-.63.34-1.05.62-1.29-2.16-.25-4.43-1.08-4.43-4.82 0-1.06.38-1.93 1-2.61-.1-.25-.43-1.24.1-2.58 0 0 .82-.26 2.68 1a9.23 9.23 0 0 1 4.88 0c1.86-1.26 2.68-1 2.68-1 .53 1.34.2 2.33.1 2.58.62.68 1 1.55 1 2.61 0 3.75-2.28 4.57-4.45 4.81.35.3.66.9.66 1.82v2.7c0 .26.18.57.67.47A9.75 9.75 0 0 0 21.75 12c0-5.38-4.37-9.75-9.75-9.75Z" />
      </svg>
    ),
  },
];

export function CreatorFooter() {
  return (
    <footer className="relative z-20 border-t border-white/60 bg-background/86 px-4 py-3 backdrop-blur dark:border-white/10">
      <div className="mx-auto flex w-full max-w-6xl flex-row flex-wrap items-center justify-center gap-3 text-center sm:justify-between sm:text-left">
        <TextType
          as="p"
          text={["By: Josué Alisson"]}
          typingSpeed={70}
          deletingSpeed={35}
          pauseDuration={5000}
          loop
          showCursor
          cursorCharacter="|"
          className="byline-gradient-text min-h-5 font-heading text-base font-bold tracking-normal sm:text-lg"
          cursorClassName="byline-gradient-cursor"
        />
        <nav aria-label="Redes sociais de Josué Alisson" className="flex items-center gap-2">
          {socialLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-white/70 bg-white/70 text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-md dark:border-white/10 dark:bg-slate-950/70"
              aria-label={link.label}
              title={link.label}
            >
              {link.icon}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
