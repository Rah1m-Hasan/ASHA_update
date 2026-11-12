import Image from "next/image";

/**
 * The Asha wordmark, in both themes.
 *
 * Two images are rendered and CSS shows the right one, so a theme change
 * never needs a round trip to the server and the mark never flashes the
 * wrong colour. The two files are not the same width, so each keeps its own
 * natural width and the box is sized by the light mark.
 */
export function Wordmark({
  height = 26,
  className = "",
  priority = false,
  alt = "Asha",
}: {
  height?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <span className={`asha-wordmark relative inline-block align-middle ${className}`} style={{ height }}>
      <Image
        src="/assets/brand/asha-wordmark-light.png"
        alt={alt}
        width={960}
        height={160}
        priority={priority}
        className="asha-wordmark--light absolute inset-0 h-full w-auto"
      />
      <Image
        src="/assets/brand/asha-wordmark-dark.png"
        alt=""
        aria-hidden="true"
        width={1050}
        height={160}
        priority={priority}
        className="asha-wordmark--dark absolute inset-0 h-full w-auto"
      />
    </span>
  );
}
