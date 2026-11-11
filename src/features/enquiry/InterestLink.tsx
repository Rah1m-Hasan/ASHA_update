"use client";

import { buttonClass } from "@/components/ui/Button";
import { selectInterest } from "./interest";

export function InterestLink({
  interest,
  variant = "secondary",
  className,
  children,
}: {
  interest: string;
  variant?: "primary" | "secondary";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href="#contact" className={buttonClass(variant, "md", className)} onClick={() => selectInterest(interest)}>
      {children}
    </a>
  );
}
