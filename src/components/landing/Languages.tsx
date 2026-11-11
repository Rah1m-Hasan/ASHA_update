import { Container } from "@/components/ui/Container";
import { FeatureItem } from "@/components/ui/FeatureItem";
import { Reveal } from "@/components/ui/Reveal";
import { languages } from "@/content/landing";

export function Languages() {
  return (
    <section aria-label="Languages" className="pb-24 sm:pb-32">
      <Container width="text">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-3xl font-medium text-ink/80 sm:text-4xl">
          {languages.greetings.map((g, i) => (
            <Reveal as="span" key={g.text} className={i % 2 ? "text-brand" : undefined}>
              <span lang={g.lang}>{g.text}</span>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-14">
          <FeatureItem title={languages.title}>{languages.text}</FeatureItem>
        </Reveal>
      </Container>
    </section>
  );
}
