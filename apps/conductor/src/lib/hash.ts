// WebCrypto SHA-256, hex. The device matches an entered code against the
// cached salted hash with one of these; the plaintext code list never exists
// on the phone.
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
