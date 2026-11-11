import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { footer } from "@/content/landing";

export function Footer() {
  return (
    <footer className="bg-wash pt-16 pb-10">
      <Container width="wide">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Image src="/assets/brand/asha-wordmark-light.png" style={{ width: "auto" }} alt="Asha" width={156} height={26} className="h-[26px] w-auto" />
            <p className="mt-4 max-w-xs text-muted">{footer.tagline}</p>
          </div>
          {footer.groups.map((g) => (
            <nav key={g.title} aria-label={g.title}>
              <h2 className="text-sm font-semibold text-ink">{g.title}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-muted hover:text-ink"
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
        <p className="mt-14 border-t border-line pt-6 text-sm text-muted">{footer.legal}</p>
      </Container>
    </footer>
  );
}
