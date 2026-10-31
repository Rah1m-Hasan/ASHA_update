import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { faqs } from "@/content/landing";

export function Faq() {
  return (
    <Section id="faq">
      <Container width="text">
        <SectionHeading eyebrow="A few things to know" title="Honest answers." />
        <div className="mt-12 divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium text-ink">
                {f.q}
                <span className="text-2xl leading-none text-brand transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-base leading-7 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
