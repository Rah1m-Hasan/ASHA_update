import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FacebookIcon, GithubIcon, LinkedinIcon } from "@/components/ui/icons";
import { team, type SocialKey } from "@/content/landing";

const socialOrder: SocialKey[] = ["github", "linkedin", "facebook"];
const socialMeta = {
  github: { label: "GitHub", Icon: GithubIcon },
  linkedin: { label: "LinkedIn", Icon: LinkedinIcon },
  facebook: { label: "Facebook", Icon: FacebookIcon },
};

export function Team() {
  return (
    <Section id="team">
      <Container width="page">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Meet the team"
            title="Built with purpose and care."
          />
        </Reveal>

        <ul className="mt-12 grid gap-10 text-center sm:grid-cols-3 sm:gap-8">
          {team.map((m) => (
            <Reveal as="li" key={m.name}>
              <Image
                src={m.photo}
                alt={m.name}
                width={300}
                height={300}
                className="mx-auto size-[120px] rounded-full object-cover shadow-card ring-4 ring-surface sm:size-[135px] lg:size-[150px]"
              />
              <h3 className="mt-5 text-[1.125rem] leading-[1.25] font-medium text-heading">{m.name}</h3>
              <p className="mt-1 text-[15px] text-body">{m.role}</p>
              <ul className="mt-4 flex justify-center gap-2" aria-label={`${m.name} on social media`}>
                {socialOrder
                  .filter((k) => m.socials[k])
                  .map((k) => {
                    const { label, Icon } = socialMeta[k];
                    return (
                      <li key={k}>
                        <a
                          href={m.socials[k]}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${m.name} on ${label}`}
                          className="grid size-9 place-items-center rounded-full border border-line bg-surface text-body transition-colors hover:border-brand hover:text-brand"
                        >
                          <Icon size={15} />
                        </a>
                      </li>
                    );
                  })}
              </ul>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
