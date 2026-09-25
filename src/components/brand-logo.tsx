import Image from "next/image";

// The official Akani BEE Ratings logo, for pages that companies and leads see
// (unsubscribe, permission, booking). The in-app "Sales Intelligent System"
// mark is for staff only.
export function BrandLogo({ width = 180 }: { width?: number }) {
  return (
    <Image
      src="/email/akani-logo.png"
      alt="Akani BEE Ratings — Together we build"
      width={width}
      height={Math.round((width * 169) / 480)}
      priority
    />
  );
}
