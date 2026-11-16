import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { FeatureItem } from "@/components/ui/FeatureItem";
import { CameraIcon, MountIcon, ShieldIcon, SwitchIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { kit } from "@/content/landing";

const partIcons = { camera: CameraIcon, mount: MountIcon, switch: SwitchIcon };

export function HardwareKit() {
  return (
    <Section id="kit" space="sm" className="sm:pt-16 sm:pb-24">
      <Container width="text">
        <Reveal>
          <SectionHeading eyebrow={kit.eyebrow} title={kit.title} lead={kit.lead} />
        </Reveal>
      </Container>

      <Container width="wide" className="mt-14">
        <Reveal>
          <figure className="overflow-hidden rounded-[28px] bg-wash p-6 sm:p-10">
            <Image
              src={kit.image.src}
              alt={kit.image.alt}
              width={1200}
              height={520}
              className="mx-auto h-auto w-full max-w-[1000px]"
            />
            <figcaption className="mt-4 text-center text-sm text-muted">{kit.caption}</figcaption>
          </figure>
        </Reveal>
      </Container>

      <Container width="text" className="mt-12">
        <ul className="flex flex-wrap justify-center gap-3" aria-label="Kit parts">
          {kit.parts.map((p) => {
            const Icon = partIcons[p.key as keyof typeof partIcons];
            return (
              <li key={p.key} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink">
                <Icon size={16} className="text-brand" />
                {p.title}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-center text-sm text-muted">{kit.price} · Subscription separate · No required kit purchase</p>

      </Container>

      <Container width="content" className="mt-16">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-10">
          {kit.parts.map((p, i) => (
            <Reveal key={p.key}>
              <FeatureItem title={p.title} kicker={`0${i + 1}`}>
                {p.text}
              </FeatureItem>
            </Reveal>
          ))}
        </div>
      </Container>

      <Container width="text" className="mt-20">
        <Reveal>
          <FeatureItem title={kit.privacy.title} icon={<ShieldIcon />}>
            {kit.privacy.text}
          </FeatureItem>
        </Reveal>

        <div className="mt-10">
          <ButtonLink href="#contact" variant="secondary">
            Ask about your setup
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
