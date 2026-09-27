/** The user's uploaded picture, or their initial on a solid circle if they haven't set one. */
export function UserAvatar({
  name,
  avatarUrl,
  size = "h-8 w-8 text-xs",
  tone = "gold",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: string;
  /** "gold" (navy initial on gold) for dark chrome, "navy" (white initial on navy) for light chrome. */
  tone?: "gold" | "navy";
}) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- small, user-uploaded, frequently-changing; next/image buys nothing here.
    return <img src={avatarUrl} alt="" className={`shrink-0 rounded-full object-cover ${size}`} />;
  }
  const toneClasses = tone === "gold" ? "bg-akani-gold text-akani-navy" : "bg-akani-navy text-white";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${toneClasses} ${size}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
