import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { closing } from "@/content/landing";

export function Closing() {
  return (
    <section className="py-24 sm:py-40">
      <Container width="text" className="text-center">
        <Reveal>
          <h2 className="text-[40px] leading-[1.05] font-medium tracking-tight text-balance text-ink sm:text-[64px] sm:leading-[1]">
            {closing.title}
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href={closing.primary.href} hardNavigation>
              {closing.primary.label}
            </ButtonLink>
            <ButtonLink href={closing.secondary.href} variant="secondary">
              {closing.secondary.label}
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
