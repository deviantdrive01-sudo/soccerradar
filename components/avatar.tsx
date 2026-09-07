function initials(username: string | null): string {
  if (!username) return "?";
  return username.slice(0, 2).toUpperCase();
}

/** Shared avatar circle — a photo if one exists, otherwise username-initials fallback. */
export function Avatar({
  avatarUrl,
  username,
  size = "size-8",
  textSize = "text-xs",
}: {
  avatarUrl: string | null;
  username: string | null;
  size?: string;
  textSize?: string;
}) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-muted ${textSize} font-semibold text-muted-foreground`}>
      {initials(username)}
    </div>
  );
}
