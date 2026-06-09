export function getUserInitials(email: string): string {
  if (!email) return "U";
  const name = email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.slice(0, 1).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function getUserDisplayName(email: string): string {
  if (!email) return "Account";
  const local = email.split("@")[0] ?? email;
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return email;
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
