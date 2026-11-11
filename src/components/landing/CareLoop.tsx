import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { FeatureItem } from "@/components/ui/FeatureItem";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site, steps } from "@/content/landing";

export function CareLoop() {
  return (
    <Section id="care">
      <Container width="text">
        <Reveal>
          <SectionHeading
            eyebrow="Less guesswork. More connection."
            title="From a small signal to “I’m here.”"
            lead="Asha supports the conversation. The patient stays in control, and the caregiver stays in the loop."
          />
        </Reveal>
        <div className="mt-16 space-y-12">
          {steps.map((s, i) => (
            <Reveal key={s.n}>
              <FeatureItem title={s.title} kicker={`${s.n} / ${s.tag}`}>
                {s.text}
              </FeatureItem>
            </Reveal>
          ))}
        </div>
        <div className="mt-12">
          <ButtonLink href={site.caregiverUrl} variant="secondary" hardNavigation>
            Explore the caregiver view
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
