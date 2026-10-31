import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { story } from "@/content/landing";
import { PhonePreview } from "./PhonePreview";

export function Story() {
  return (
    <section id="why" className="scroll-mt-20 py-20 sm:pt-20 sm:pb-32">
      <Container width="text">
        <Reveal>
          <SectionHeading eyebrow={story.eyebrow} title={story.title} />
          <div className="mt-6 space-y-4 text-center text-lg leading-7 text-muted sm:text-xl sm:leading-8">
            {story.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </Reveal>
      </Container>
      <Container width="text" className="mt-14">
        <Reveal>
          <PhonePreview />
        </Reveal>
      </Container>
    </section>
  );
}
