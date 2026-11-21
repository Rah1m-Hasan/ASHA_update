import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site, steps } from "@/content/landing";
import { cn } from "@/lib/cn";
import { SignalNode } from "./Signal";

export function CareLoop() {
  return (
    <Section id="care">
      <Container width="page">
        <Reveal>
          <SectionHeading
            layout="split"
            eyebrow="Less guesswork. More connection."
            title="From a small signal to “I’m here.”"
            lead="Asha supports the conversation. The patient stays in control, and the caregiver stays in the loop."
          />
        </Reveal>

        <div className="relative mt-12 sm:mt-16">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[5.5px] hidden h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent md:block"
          />

          <ol className="grid gap-6 md:grid-cols-3 md:gap-8">
            {steps.map((s, i) => {
              const central = s.side === "The patient";
              return (
                <Reveal as="li" key={s.n} stagger={(i + 1) as 1 | 2 | 3} className="h-full">
                  <div className="flex h-full flex-col">
                    <div className="flex items-center gap-3">
                      <SignalNode />
                      <p className="text-[12px] font-semibold tracking-[0.14em] text-accent-deep uppercase">
                        {s.n} / {s.tag}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "mt-5 flex h-full flex-col rounded-[24px] p-6 sm:p-7",
                        central ? "bg-brand-soft ring-1 ring-brand-mint" : "border border-line",
                      )}
                    >
                      <h3 className="font-medium text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.2] text-heading">
                        {s.title}
                      </h3>
                      <p className="mt-3 text-[1.0625rem] leading-[1.7] text-body">{s.text}</p>
                      <p className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.1em] text-ink uppercase">
                        {s.side}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </ol>
        </div>

        <Reveal className="mt-10">
          <ButtonLink href={site.caregiverUrl} variant="outline" hardNavigation>
            Explore the caregiver view
          </ButtonLink>
        </Reveal>
      </Container>
    </Section>
  );
}
