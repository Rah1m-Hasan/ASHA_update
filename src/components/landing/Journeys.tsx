import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { journeys } from "@/content/landing";
import { SignalNode } from "./Signal";

/** Who Asha is designed for — a person, not a diagnosis. */
export function Journeys() {
  return (
    <section aria-labelledby="journeys-title" className="pb-20 sm:pb-24">
      <Container width="page">
        <Reveal>
          <Eyebrow>A person, not a diagnosis</Eyebrow>
          <h2 id="journeys-title" className="mt-4 max-w-[18ch] text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.12] font-medium tracking-[-0.02em] text-heading">
            Support that adapts to the person.
          </h2>
        </Reveal>

        <div className="relative mt-8 md:mt-10">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[5.5px] hidden h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent md:block"
          />
          <div aria-hidden="true" className="absolute top-2 bottom-2 left-[5px] w-px bg-line md:hidden" />

          <ul className="grid gap-12 pl-8 md:grid-cols-3 md:gap-10 md:pl-0">
            {journeys.map((j) => (
              <Reveal as="li" key={j.n}>
                <SignalNode className="-ml-8 mb-7 md:ml-0" />
                <p className="text-[12px] font-semibold tracking-[0.12em] text-accent-deep uppercase">{j.n}</p>
                <h3 className="mt-4 font-medium text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.2] text-heading">
                  {j.title}
                </h3>
                <p className="mt-2.5 max-w-[34ch] text-base leading-[1.6] text-body">{j.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
