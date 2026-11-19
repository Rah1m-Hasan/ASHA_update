import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { AuthShowcase, type ShowcaseCopy } from "./AuthShowcase";

/** Split screen: product illustration on the left, form on the right (stacked on mobile). */
export function AuthLayout({
  showcase,
  title,
  subtitle,
  children,
}: {
  showcase: ShowcaseCopy;
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-2">
      <AuthShowcase copy={showcase} />
      <main className="flex flex-col px-4 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Asha home" className="lg:invisible">
            <Wordmark height={24} />
          </Link>
          <Link href="/" className="inline-block py-0.5 text-sm font-medium text-muted hover:text-ink">
            ← Back to home
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-title-sm font-medium text-ink sm:text-title">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-center text-xs text-muted">Assistive communication prototype · Not an emergency service</p>
      </main>
    </div>
  );
}
