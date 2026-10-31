import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { journeys } from "@/content/landing";

/** Social-proof style rail: who Asha is designed for. */
export function Journeys() {
  return (
    <section aria-labelledby="journeys-title" className="pb-20 sm:pb-24">
      <Container width="text">
        <h2 id="journeys-title" className="mb-8 text-center text-sm font-semibold tracking-wide text-muted uppercase">
          A person, not a diagnosis
        </h2>
        <ul className="space-y-10">
          {journeys.map((j, i) => (
            <Reveal as="li" key={j.n} className="mx-auto max-w-[486px] text-center">
                <span className="text-sm font-semibold text-brand">{j.n}</span>
                <p className="mt-2 text-xl leading-7 font-medium text-ink">{j.title}</p>
                <p className="mt-1 text-base text-muted">{j.text}</p>
              </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
