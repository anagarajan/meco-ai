function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashSecret(secret: string): Promise<string> {
  const bytes = encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return toHex(new Uint8Array(digest));
}

export async function verifySecret(secret: string, expectedHash?: string): Promise<boolean> {
  if (!expectedHash) return false;
  return (await hashSecret(secret)) === expectedHash;
}
