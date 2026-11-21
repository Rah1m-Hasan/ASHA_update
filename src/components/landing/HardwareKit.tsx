import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { CameraIcon, MountIcon, ShieldIcon, SwitchIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { kit } from "@/content/landing";

const partIcons = { camera: CameraIcon, mount: MountIcon, switch: SwitchIcon };

export function HardwareKit() {
  return (
    <Section id="kit" tone="mist" space="sm" className="sm:pt-24 sm:pb-28">
      <Container width="page">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow={kit.eyebrow}
              title={kit.title}
              lead={kit.lead}
            />

            <ol className="mt-10 divide-y divide-mist-line border-y border-mist-line">
              {kit.parts.map((p, i) => {
                const Icon = partIcons[p.key as keyof typeof partIcons];
                return (
                  <li key={p.key} className="flex gap-4 py-5">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px] bg-surface text-brand shadow-card">
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold tracking-[0.14em] text-accent-deep uppercase">
                        {String(i + 1).padStart(2, "0")}
                      </p>
                      <h3 className="mt-1.5 font-medium text-[1.25rem] leading-[1.25] text-heading">{p.title}</h3>
                      <p className="mt-1.5 text-[15px] leading-[1.65] text-body">{p.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-[1.5rem] leading-none font-semibold text-heading">{kit.price}</span>
              <span className="text-[15px] text-body">{kit.priceNote}</span>
            </div>

            <div className="mt-8 rounded-[20px] border border-mist-line bg-surface/70 p-5">
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px] bg-brand-soft text-brand">
                  <ShieldIcon size={17} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-medium text-[1.125rem] leading-[1.3] text-heading">{kit.privacy.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-[1.65] text-body">{kit.privacy.text}</p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <ButtonLink href="#contact" variant="secondary">
                Ask about your setup
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal>
            <figure className="m-0 overflow-hidden rounded-[28px] bg-surface p-5 shadow-panel sm:p-8">
              <Image
                src={kit.image.src}
                alt={kit.image.alt}
                width={1200}
                height={520}
                className="mx-auto h-auto w-full max-w-[720px]"
              />
              <figcaption className="mt-5 text-center text-[13px] text-body">{kit.caption}</figcaption>
            </figure>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
