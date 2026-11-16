"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { acceptLink } from "@/features/session/actions";

/** Paste a private patient/caregiver link to connect this device. */
export function LinkConnect() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const role = acceptLink(value.trim());
          router.push(`/dashboard/${role}`);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <label htmlFor="private-link" className="sr-only">
        Private link
      </label>
      <input
        id="private-link"
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste the private link"
        // `flex-1` would set the *height* basis while the form is a column,
        // so it only applies once the form lies out as a row.
        className="h-11 w-full rounded-xl border border-line px-3 focus:border-brand focus:outline-none sm:flex-1"
      />
      <Button type="submit" disabled={!value.trim()}>
        Connect
      </Button>
      {error && <p className="text-sm text-danger sm:basis-full">{error}</p>}
    </form>
  );
}
