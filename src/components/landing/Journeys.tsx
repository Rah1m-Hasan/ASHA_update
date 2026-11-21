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
          <Eyebrow as="h2" id="journeys-title">
            A person, not a diagnosis
          </Eyebrow>
        </Reveal>

        <div className="relative mt-10 md:mt-12">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[5.5px] hidden h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent md:block"
          />
          <div aria-hidden="true" className="absolute top-2 bottom-2 left-[5px] w-px bg-line md:hidden" />

          <ul className="grid gap-12 pl-8 md:grid-cols-3 md:gap-10 md:pl-0">
            {journeys.map((j, i) => (
              <Reveal as="li" key={j.n} stagger={(i + 1) as 1 | 2 | 3}>
                <SignalNode className="-ml-8 mb-7 md:ml-0" />
                <p
                  aria-hidden="true"
                  className="font-semibold text-[clamp(2.5rem,4.6vw,3.5rem)] leading-none text-ink/25"
                >
                  {j.n}
                </p>
                <h3 className="mt-4 font-medium text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.2] text-heading">
                  {j.title}
                </h3>
                <p className="mt-2.5 text-[1.0625rem] leading-[1.7] text-body">{j.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
