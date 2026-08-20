import Image from "next/image";

/**
 * Logos are vendored into /public/providers so the site never hotlinks the
 * CRM (which is behind a login and unreachable to visitors).
 */
export function ProviderLogo({
  logo,
  name,
  size = 40,
  className = "",
}: {
  logo: string;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/providers/${logo}`}
      alt={name}
      width={size * 2.5}
      height={size}
      className={`object-contain ${className}`}
      // Logos vary wildly in aspect ratio, so pin the height and let the width
      // follow. Setting both via CSS is what triggers Next's aspect warning.
      style={{ height: size, width: "auto", maxWidth: size * 2.5 }}
    />
  );
}
