import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { contact } from "@/content/landing";
import { EnquiryForm } from "@/features/enquiry/EnquiryForm";

const channels = [
  { label: "Email", value: contact.email, href: `mailto:${contact.email}` },
  { label: "Call", value: contact.phoneDisplay, href: contact.phoneHref },
  { label: "WhatsApp", value: "Chat with the Asha team", href: contact.whatsapp },
];

export function Contact() {
  return (
    <Section id="contact" tone="wash">
      <Container width="text">
        <SectionHeading
          eyebrow="Let’s find the right fit"
          title="Book a demo. Start a conversation."
          lead="For families, care teams, hospitals and partners. Tell us what you want to explore — we’ll discuss the next step and confirm a suitable time."
        />
      </Container>
      <Container width="content" className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <ul className="space-y-3">
            {channels.map((c) => (
              <li key={c.label}>
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="block rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:ring-brand"
                >
                  <span className="text-xs font-semibold tracking-wide text-muted uppercase">{c.label}</span>
                  <span className="mt-1 block font-medium text-ink">{c.value} ↗</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm leading-6 text-muted">{contact.disclaimer}</p>
        </div>
        <EnquiryForm />
      </Container>
    </Section>
  );
}
