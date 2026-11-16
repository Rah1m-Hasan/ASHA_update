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
    <Section id="team" tone="wash">
      <Container width="text">
        <Reveal>
          <SectionHeading
            eyebrow="Meet the team"
            title="Built with purpose. And a lot of heart."
            lead="Technical implementation, product direction and care-focused business thinking, together."
          />
        </Reveal>
      </Container>
      <Container width="content" className="mt-14">
        <ul className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {team.map((m, i) => (
            <Reveal as="li" key={m.name} className="text-center">
                <Image
                  src={m.photo}
                  alt={m.name}
                  width={112}
                  height={112}
                  className="mx-auto size-28 rounded-full object-cover ring-8 ring-surface"
                />
                <h3 className="mt-5 text-xl font-medium text-ink">{m.name}</h3>
                <p className="mt-1 text-muted">{m.role}</p>
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
                            className="grid size-9 place-items-center rounded-full bg-surface text-muted ring-1 ring-line transition hover:text-brand hover:ring-brand"
                          >
                            <Icon size={16} />
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
