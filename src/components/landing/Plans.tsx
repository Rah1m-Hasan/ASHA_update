import { InterestLink } from "@/features/enquiry/InterestLink";
import { Container } from "@/components/ui/Container";
import { CheckIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { plans, plansNote } from "@/content/landing";
import { cn } from "@/lib/cn";

export function Plans() {
  return (
    <Section id="plans" tone="wash">
      <Container width="text">
        <Reveal>
          <SectionHeading
            eyebrow="A simple start · planned launch pricing"
            title="From home to the bedside."
            lead="Explore the demo today without purchasing a plan or kit. Subscriptions and hardware are proposed launch offers."
          />
        </Reveal>
      </Container>
      <Container width="content" className="mt-14">
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((p, i) => {
            const featured = "featured" in p && p.featured;
            return (
              <Reveal key={p.name}>
                <article
                  className={cn(
                    "flex h-full flex-col rounded-[28px] bg-surface p-7",
                    featured ? "shadow-float ring-2 ring-brand" : "ring-1 ring-line",
                  )}
                >
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">{p.audience}</p>
                  <h3 className="mt-3 text-2xl font-medium text-ink">{p.name}</h3>
                  <p className="mt-3">
                    <span className="text-4xl font-medium text-ink">{p.price}</span>
                    <span className="text-muted"> {p.period}</span>
                  </p>
                  <p className="mt-3 text-muted">{p.summary}</p>
                  <ul className="mt-6 space-y-3 text-sm text-ink">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <CheckIcon size={18} className="shrink-0 text-brand" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    <InterestLink interest={p.interest} variant={featured ? "primary" : "secondary"} className="w-full">
                      {p.cta}
                    </InterestLink>
                    <p className="mt-3 text-center text-xs text-muted">{p.note}</p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
        <p className="mx-auto mt-8 max-w-[664px] text-center text-sm text-muted">{plansNote}</p>
      </Container>
    </Section>
  );
}
