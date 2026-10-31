import { Container } from "@/components/ui/Container";
import { FeatureItem } from "@/components/ui/FeatureItem";
import { CheckIcon, ShieldIcon, SparkIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { principles } from "@/content/landing";

const icons = [<SparkIcon key="a" />, <ShieldIcon key="b" />, <CheckIcon key="c" />];

export function Principles() {
  return (
    <Section>
      <Container width="text">
        <Reveal>
          <SectionHeading eyebrow="Thoughtful by design" title="Different journeys. Shared dignity." />
        </Reveal>
      </Container>
      <Container width="content" className="mt-14">
        <div className="grid gap-12 md:grid-cols-3 md:gap-10">
          {principles.map((p, i) => (
            <Reveal key={p.title}>
              <FeatureItem title={p.title} icon={icons[i]}>
                {p.text}
              </FeatureItem>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
