import { Container } from "@/components/ui/Container";
import { ThemeFollowDevice } from "@/components/ui/ThemeToggle";
import { footer } from "@/content/landing";

export function Footer() {
  return (
    <footer className="border-t border-line bg-brand-pale pt-14 pb-10">
      <Container width="page">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)] md:gap-8">
          <div>
            <span role="img" aria-label="Asha" className="wordmark h-[26px] w-[156px]" />
            <p className="mt-4 max-w-[30ch] text-[15px] leading-[1.6] text-body">{footer.tagline}</p>
          </div>
          {footer.groups.map((g) => (
            <nav key={g.title} aria-label={g.title}>
              <h2 className="text-[13px] font-semibold tracking-[0.14em] text-heading uppercase">{g.title}</h2>
              <ul className="mt-4 space-y-3 text-[15px]">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-body transition-colors hover:text-brand"
                      {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        {/* text-muted on this pale band is 4.4:1 — under AA for body text. text-body is 7:1. */}
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <p className="max-w-[62ch] text-[14px] leading-[1.7] text-body">{footer.legal}</p>
          <ThemeFollowDevice />
        </div>
      </Container>
    </footer>
  );
}
