import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VideoFrame } from "@/components/ui/VideoFrame";
import { ArrowRightIcon } from "@/components/ui/icons";
import { modules, modulesIntro, site } from "@/content/landing";
import { ModuleIcon } from "./ModuleIcon";
import { ModuleRail } from "./ModuleRail";

export function Modules() {
  return (
    <Section id="modules" tone="brand" space="sm" className="sm:pt-24 sm:pb-28">
      <Container width="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-16">
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow={modulesIntro.eyebrow}
              title={modulesIntro.title}
              lead={modulesIntro.lead}
            >
              <div className="mt-8">
                <ButtonLink href={site.appUrl} hardNavigation>
                  Try Asha
                </ButtonLink>
              </div>
            </SectionHeading>
          </Reveal>
          <Reveal stagger={2}>
            {modulesIntro.video.src ? (
              <VideoFrame {...modulesIntro.video} mode="ambient" />
            ) : (
              <ModuleRail />
            )}
          </Reveal>
        </div>
      </Container>

      <Container width="page" className="mt-14 sm:mt-16">
        {/* Two equal columns from 640px up. Every card is the same shape and the
            same padding, and the Explore link sits at the bottom of each card,
            so all eight align however long a description runs. */}
        <ol className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          {modules.map((m, i) => (
            <Reveal
              as="li"
              key={m.key}
              stagger={((i % 3) + 1) as 1 | 2 | 3}
              className="flex h-full flex-col rounded-[22px] border border-line bg-surface p-6 shadow-card transition-colors hover:border-brand/45 sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-brand-soft text-brand">
                  <ModuleIcon module={m.key} size={18} />
                </span>
                <span aria-hidden="true" className="font-semibold text-[13px] tracking-[0.14em] text-brand/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>

              <p className="mt-4 text-[12px] font-semibold tracking-[0.14em] text-accent-deep uppercase">{m.name}</p>
              <h3 className="mt-2 text-[1.375rem] leading-[1.25] font-medium text-heading">{m.title}</h3>
              <p className="mt-3 text-[1.0625rem] leading-[1.7] text-body">{m.text}</p>

              <a
                href={`/dashboard/patient/${m.key}`}
                className="mt-auto inline-flex items-center gap-1.5 self-start pt-6 text-[15px] font-medium text-brand transition-colors hover:text-brand-hover hover:underline"
              >
                Explore {m.name}
                <ArrowRightIcon size={16} />
              </a>
            </Reveal>
          ))}
        </ol>

        <p className="mt-12 max-w-[60ch] text-center text-[15px] leading-[1.6] text-body sm:mx-auto">
          Every module is available in the live demo. Camera and microphone access begin only when you choose.
        </p>
      </Container>
    </Section>
  );
}
