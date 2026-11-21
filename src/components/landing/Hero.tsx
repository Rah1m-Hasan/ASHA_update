import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VideoFrame } from "@/components/ui/VideoFrame";
import { hero } from "@/content/landing";
import { HeroScene } from "./HeroScene";

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-28">
      <div aria-hidden="true" className="accent-glow absolute -top-40 -left-40 size-[520px] opacity-60" />

      <Container width="page" className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] lg:gap-14">
          <Reveal>
            <SectionHeading
              level={1}
              align="left"
              eyebrow={hero.badge}
              title={
                <>
                  {hero.titleLines.map((line, i) => (
                    <span key={line.text} className={line.accent ? "block text-brand" : "block"}>
                      {/* The space keeps the two lines apart in the accessible
                          name; a leading space in a block box collapses away. */}
                      {(i > 0 ? " " : "") + line.text}
                    </span>
                  ))}
                </>
              }
              lead={hero.lead}
            />
            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ButtonLink href={hero.primary.href} hardNavigation className="w-full justify-center sm:w-auto">
                {hero.primary.label}
              </ButtonLink>
              <ButtonLink href={hero.secondary.href} variant="outline" className="w-full justify-center sm:w-auto">
                {hero.secondary.label}
              </ButtonLink>
            </div>
            <p className="mt-7 max-w-[52ch] text-[15px] leading-[1.65] text-body">{hero.notes}</p>
          </Reveal>

          <Reveal>
            {hero.video.src ? (
              <VideoFrame {...hero.video} />
            ) : (
              <HeroScene />
            )}
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
