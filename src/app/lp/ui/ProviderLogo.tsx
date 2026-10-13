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
  logo: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  /*
   * ⚠️ לוגו חסר אינו `<Image>` — הוא כלום. `src={`/providers/${logo}`}`
   * על `null` היה מבקש `/providers/null` (404 על כל כרטיס), ועל
   * `provider: null` זרק `TypeError` ברינדור השרת והפיל את `/lp` כולו.
   * שם הספק מודפס לצד הלוגו בשני המשטחים שקוראים לכאן, ולכן אין כאן
   * אובדן מידע. ראה `providerLogo` ב-`catalog.ts`.
   */
  if (!logo) return null;
  return (
    <Image
      src={`/providers/${logo}`}
      alt={name}
      width={size * 2.5}
      height={size}
      className={`object-contain ${className}`}
      // Logos vary wildly in aspect ratio, so pin the height and let the width
      // follow. Setting both via CSS is what triggers Next's aspect warning.
      style={{ height: size, width: "auto", maxWidth: `min(${size * 2.5}px, 100%)` }}
    />
  );
}
