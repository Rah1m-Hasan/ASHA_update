import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { closing } from "@/content/landing";
import { SignalLine } from "./Signal";

export function Closing() {
  return (
    <section className="bg-gradient-to-br from-band-from to-band-to py-24 sm:py-32">
      <Container width="page">
        <Reveal>
          <div className="mx-auto max-w-[760px] text-center">
            <h2 className="text-[clamp(2.25rem,5.4vw,4rem)] leading-[1.02] font-semibold tracking-[-0.02em] text-balance text-on-scrim">
              {closing.title}
            </h2>

            <div className="mx-auto mt-10 max-w-[420px]">
              <SignalLine draw onBlue />
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <ButtonLink href={closing.primary.href} variant="inverse" hardNavigation>
                {closing.primary.label}
              </ButtonLink>
              <ButtonLink href={closing.secondary.href} variant="onBlue">
                {closing.secondary.label}
              </ButtonLink>
            </div>

            {/* Full white: white/80 on the blue band is 3.9:1, under AA for 14px text. */}
            <p className="mx-auto mt-8 max-w-[52ch] text-[14px] leading-[1.6] text-on-scrim">
              An assistive communication prototype — not a medical device, and not an emergency service.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
