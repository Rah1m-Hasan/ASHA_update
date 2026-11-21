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
          <Reveal>
            {modulesIntro.video.src ? (
              <VideoFrame {...modulesIntro.video} mode="ambient" />
            ) : (
              <ModuleRail />
            )}
          </Reveal>
        </div>
      </Container>

      <Container width="page" className="mt-14 sm:mt-16">
        {/* A consistent two-column showcase keeps all eight ways to connect easy to scan. */}
        <ol className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          {modules.map((m) => (
            <Reveal
              as="li"
              key={m.key}
              className="group flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 transition-colors hover:border-brand/55 hover:bg-surface-hover sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-brand-soft text-brand transition-colors group-hover:bg-brand-strong group-hover:text-on-brand">
                  <ModuleIcon module={m.key} size={18} />
                </span>
                <p className="text-[12px] font-semibold tracking-[0.12em] text-accent-deep uppercase">{m.name}</p>
              </div>

              <h3 className="mt-5 text-[1.25rem] leading-[1.3] font-medium text-heading">{m.title}</h3>
              <p className="mt-2.5 text-base leading-[1.6] text-body">{m.text}</p>

              <a
                href={`/dashboard/patient/${m.key}`}
                className="mt-auto inline-flex min-h-11 items-center gap-1.5 self-start pt-4 text-[15px] font-medium text-brand transition-colors hover:text-brand-hover hover:underline"
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
