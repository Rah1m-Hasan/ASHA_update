import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VideoFrame } from "@/components/ui/VideoFrame";
import { hero } from "@/content/landing";

export function Hero() {
  return (
    <section id="home" className="pt-16 pb-16 sm:pt-16 sm:pb-20">
      <Container width="text">
        <Reveal>
          <SectionHeading level={1} eyebrow={hero.badge} title={hero.title} lead={hero.lead} />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href={hero.primary.href} hardNavigation>
              {hero.primary.label}
            </ButtonLink>
            <ButtonLink href={hero.secondary.href} variant="secondary">
              {hero.secondary.label}
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
      <Container width="content" className="mt-14 sm:mt-16">
        <Reveal className="mx-auto max-w-[880px]">
          <VideoFrame {...hero.video} />
        </Reveal>
      </Container>
    </section>
  );
}
