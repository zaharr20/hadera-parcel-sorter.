// Session token derived from APP_PASSWORD. Changing the password logs every device out.
export const AUTH_COOKIE = "ps_auth";

export async function tokenFor(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`parcel-sorter:v1:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string compare, so the check does not leak how much of a guess was right.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
