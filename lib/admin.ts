export function isAdmin(email: string | null | undefined): boolean {
  const list = process.env.ADMIN_EMAILS;
  if (!list || typeof list !== "string") return false;
  const emails = list.split(",").map((e) => e.trim().toLowerCase());
  return email ? emails.includes(email.toLowerCase()) : false;
}
