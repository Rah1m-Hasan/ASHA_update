import { cn } from "@/lib/cn";

const widths = {
  text: "max-w-[664px]", // reading column
  content: "max-w-[1080px]",
  wide: "max-w-[1300px]",
  page: "max-w-[1320px]", // the full editorial grid
};

export function Container({
  width = "content",
  className,
  children,
}: {
  width?: keyof typeof widths;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto w-full px-5 sm:px-8", widths[width], className)}>{children}</div>;
}
