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
    <Section id="plans">
      <Container width="page">
        <Reveal>
          <SectionHeading
            layout="split"
            eyebrow="A simple start · planned launch pricing"
            title="From home to the bedside."
            lead="Explore the demo today without purchasing a plan or kit. Subscriptions and hardware are proposed launch offers."
          />
        </Reveal>

        <div className="mt-14 grid gap-8 sm:mt-16 lg:grid-cols-3 lg:gap-7">
          {plans.map((p, i) => {
            const featured = "featured" in p && p.featured;
            return (
              <Reveal key={p.name} stagger={(i + 1) as 1 | 2 | 3} className="h-full">
                <article
                  className={cn(
                    "flex h-full flex-col rounded-[24px] p-7 sm:p-8",
                    featured
                      ? "bg-brand-soft ring-2 ring-brand shadow-panel"
                      : "border border-line bg-surface shadow-card",
                  )}
                >
                  <p className="text-[12px] font-semibold tracking-[0.14em] text-accent-deep uppercase">{p.audience}</p>
                  <h3 className="mt-3 text-[clamp(1.625rem,2.4vw,2rem)] leading-[1.2] font-medium text-heading">
                    {p.name}
                  </h3>
                  <p className="mt-5 flex items-baseline gap-2">
                    <span className="text-[clamp(2.5rem,4.2vw,3.5rem)] leading-none font-semibold text-heading">
                      {p.price}
                    </span>
                    <span className="text-[15px] text-body">{p.period}</span>
                  </p>
                  <p className="mt-4 text-[15px] leading-[1.65] text-body">{p.summary}</p>
                  <ul className="mt-7 space-y-3 text-[15px] leading-[1.55] text-ink">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <CheckIcon size={17} className="mt-0.5 shrink-0 text-brand" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-9">
                    <InterestLink
                      interest={p.interest}
                      variant={featured ? "primary" : "outline"}
                      className="w-full"
                    >
                      {p.cta}
                    </InterestLink>
                    <p className="mt-3 text-center text-[13px] text-body">{p.note}</p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <p className="mx-auto mt-12 max-w-[68ch] text-center text-[15px] leading-[1.6] text-body">{plansNote}</p>
      </Container>
    </Section>
  );
}
