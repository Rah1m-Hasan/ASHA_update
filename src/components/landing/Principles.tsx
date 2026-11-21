import { Container } from "@/components/ui/Container";
import { CheckIcon, ShieldIcon, SparkIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { principles } from "@/content/landing";

const icons = [<SparkIcon key="a" />, <ShieldIcon key="b" />, <CheckIcon key="c" />];

export function Principles() {
  return (
    <Section tone="wash">
      <Container width="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16 lg:items-start">
          <Reveal className="lg:sticky lg:top-24 lg:self-start">
            <SectionHeading align="left" eyebrow="Thoughtful by design" title="Different journeys. Shared dignity." />
          </Reveal>

          <ol className="border-t border-line">
            {principles.map((p, i) => (
              <Reveal as="li" key={p.title}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 border-b border-line py-7 sm:gap-7">
                  <span className="grid size-10 place-items-center rounded-[14px] bg-surface text-brand shadow-card">
                    {icons[i]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold tracking-[0.14em] text-accent-deep uppercase">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-2 font-medium text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.2] text-heading">
                      {p.title}
                    </h3>
                    <p className="mt-3 text-[1.0625rem] leading-[1.7] text-body">{p.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
