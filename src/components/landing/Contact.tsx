import { Container } from "@/components/ui/Container";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { contact } from "@/content/landing";
import { EnquiryForm } from "@/features/enquiry/EnquiryForm";

export function Contact() {
  return (
    <Section id="contact" tone="mist">
      <Container width="page">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-16">
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow="Let’s find the right fit"
              title="Book a demo. Start a conversation."
              lead="For families, care teams and accessibility partners. Tell us what you’d like to explore."
            />

            <ul className="mt-10 border-t border-mist-line">
              {contact.channels.map((c) => (
                <li key={c.key} className="border-b border-mist-line">
                  <a
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-4 py-5"
                  >
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold tracking-[0.14em] text-accent-deep uppercase">
                        {c.label}
                      </span>
                      <span className="mt-1 block truncate font-medium text-[clamp(1.125rem,1.8vw,1.375rem)] text-heading">
                        {c.value}
                      </span>
                    </span>
                    <ArrowRightIcon
                      size={20}
                      className="shrink-0 text-brand transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </a>
                </li>
              ))}
            </ul>

            <p className="mt-7 rounded-[18px] border border-mist-line bg-surface/70 p-5 text-[15px] leading-[1.65] text-body">
              {contact.disclaimer}
            </p>
          </Reveal>

          <Reveal>
            <EnquiryForm />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
