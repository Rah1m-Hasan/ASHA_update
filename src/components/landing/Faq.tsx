import { Container } from "@/components/ui/Container";
import { ChevronIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { faqs } from "@/content/landing";

export function Faq() {
  return (
    <Section id="faq" tone="wash">
      <Container width="page">
        <Reveal>
          <SectionHeading eyebrow="A few things to know" title="Honest answers." />
        </Reveal>

        <div className="mx-auto mt-12 max-w-[900px] border-t border-line">
          {faqs.map((f, i) => (
            <Reveal key={f.q} stagger={(i + 1) as 1 | 2 | 3 | 4}>
              <details className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                  <span className="flex gap-4 sm:gap-6">
                    <span aria-hidden="true" className="mt-1 font-semibold text-[15px] text-ink/30">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-medium text-[clamp(1.125rem,1.6vw,1.375rem)] leading-[1.35] text-heading">
                      {f.q}
                    </span>
                  </span>
                  <span className="mt-1 shrink-0 text-brand">
                    <ChevronIcon
                      size={20}
                      className="rotate-90 transition-transform duration-300 group-open:rotate-180"
                    />
                  </span>
                </summary>
                <p className="pb-7 pl-[2.65rem] text-[1.0625rem] leading-[1.7] text-body sm:pl-[3.65rem]">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
