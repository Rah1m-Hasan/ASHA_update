import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VideoFrame } from "@/components/ui/VideoFrame";
import { modules, modulesIntro } from "@/content/landing";
import { ModuleIcon } from "./ModuleIcon";

export function Modules() {
  return (
    <Section id="modules" tone="wash" space="sm" className="sm:pt-20 sm:pb-32">
      <Container width="text">
        <Reveal>
          <SectionHeading eyebrow={modulesIntro.eyebrow} title={modulesIntro.title} lead={modulesIntro.lead}>
            <div className="mt-8">
              <ButtonLink href="/dashboard/patient/facespeak" hardNavigation>
                Try the live demo
              </ButtonLink>
            </div>
          </SectionHeading>
        </Reveal>
        <Reveal className="mt-14">
          <VideoFrame {...modulesIntro.video} mode="ambient" />
        </Reveal>
      </Container>

      <Container width="text" className="mt-20 sm:mt-28">
        <ol className="divide-y divide-line">
          {modules.map((m, i) => (
            <Reveal as="li" key={m.key} className="grid gap-4 py-8 sm:grid-cols-[48px_1fr] sm:gap-6">
                <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand shadow-card">
                  <ModuleIcon module={m.key} size={22} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-brand">
                    {String(i + 1).padStart(2, "0")} · {m.name}
                  </p>
                  <h3 className="mt-1 text-2xl leading-[1.25] font-medium text-ink">{m.title}</h3>
                  <p className="mt-2 text-lg leading-7 text-muted">{m.text}</p>
                  <a href={`/dashboard/patient/${m.key}`} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
                    Explore {m.name} →
                  </a>
                </div>
              </Reveal>
          ))}
        </ol>
        <p className="mt-6 text-center text-sm text-muted">
          All five modules are available in the live demo. Camera and microphone access begin only when you choose.
        </p>
      </Container>
    </Section>
  );
}
