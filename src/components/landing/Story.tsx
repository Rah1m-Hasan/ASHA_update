import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { story } from "@/content/landing";
import { MessageThread } from "./MessageThread";

/** The reason Asha exists. */
export function Story() {
  return (
    <Section id="why">
      <Container width="page">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-x-16 lg:gap-y-16">
          <Reveal>
            <Eyebrow>{story.eyebrow}</Eyebrow>
            <h2 className="mt-6 max-w-[16ch] font-medium text-[clamp(2rem,3.6vw,3.125rem)] leading-[1.06] tracking-[-0.015em] text-balance text-display">
              {story.title}
            </h2>
            <p className="mt-7 max-w-[52ch] text-[clamp(1.0625rem,1.5vw,1.375rem)] leading-[1.6] text-body">
              {story.paragraphs[0]}
            </p>
          </Reveal>

          <Reveal stagger={2}>
            <div className="rounded-[28px] bg-mist p-5 sm:p-8">
              <MessageThread />
            </div>
          </Reveal>

          <Reveal className="lg:col-start-1">
            <blockquote className="border-l-2 border-accent pl-6">
              <p className="font-medium text-[clamp(1.375rem,2.2vw,1.875rem)] leading-[1.35] text-heading">
                {story.pullQuote}
              </p>
            </blockquote>
          </Reveal>

          <Reveal stagger={2} className="lg:col-start-2 lg:row-start-2">
            <p className="max-w-[52ch] text-[1.0625rem] leading-[1.7] text-body">{story.paragraphs[1]}</p>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
