import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/ui/Wordmark";

/** The page a bad link lands on. It stays inside the Asha shell, in the same voice. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-wash">
      <div className="mx-auto flex w-full max-w-[1300px] items-center px-4 py-6 sm:px-8">
        <Link href="/" aria-label="Asha home">
          <Wordmark height={24} />
        </Link>
      </div>
      <Container width="text" className="flex flex-1 flex-col justify-center py-16">
        <p className="text-sm font-medium text-brand">Page not found</p>
        <h1 className="mt-3 font-display text-title-sm font-medium text-ink text-balance sm:text-title">
          That page is not here.
        </h1>
        <p className="mt-3 text-lg leading-7 text-muted">
          The link may be old, or the page may have moved. Nothing has been lost — your data stays on this
          device.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-brand px-5 py-2 font-medium text-on-brand transition-colors hover:bg-brand-hover"
          >
            Back to the start
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-brand-soft px-5 py-2 font-medium text-brand transition-colors hover:bg-brand-mint"
          >
            Open my space
          </Link>
        </div>
      </Container>
    </main>
  );
}
