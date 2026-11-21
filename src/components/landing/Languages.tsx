import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { languages } from "@/content/landing";

/** Bangla and English, set as type rather than as icons. */
export function Languages() {
  const pairs = [
    { bangla: languages.greetings[0], english: languages.greetings[1] },
    { bangla: languages.greetings[2], english: languages.greetings[3] },
  ];

  return (
    <Section label="Languages" tone="pale">
      <Container width="page">
        <Reveal>
          <Eyebrow as="h2" className="mx-auto justify-center">
            {languages.title}
          </Eyebrow>
        </Reveal>

        <dl className="mt-12 grid gap-y-10 sm:grid-cols-2 sm:gap-x-16">
          {pairs.map((pair, i) => (
            <Reveal key={pair.bangla.text} stagger={(i + 1) as 1 | 2}>
              <div className="border-t border-line pt-6">
                <dt className="font-bangla text-[clamp(2rem,5.5vw,3.75rem)] leading-[1.15] font-medium text-display">
                  <span lang={pair.bangla.lang}>{pair.bangla.text}</span>
                </dt>
                <dd className="mt-3 text-[clamp(1rem,1.4vw,1.25rem)] text-accent-deep">
                  <span lang={pair.english.lang}>{pair.english.text}</span>
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>

        <Reveal stagger={3}>
          <p className="mx-auto mt-14 max-w-[54ch] text-center text-[clamp(1.0625rem,1.3vw,1.25rem)] leading-[1.65] text-body">
            {languages.text}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
