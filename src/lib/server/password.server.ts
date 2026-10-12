import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

/**
 * Password hashing (scrypt, Node built-in — no extra package).
 * Stored format: scrypt$<salt-hex>$<hash-hex> (same as the old code, so every
 * existing hash keeps working). Plain-text "legacy" passwords are NOT accepted
 * any more; scripts/migrate.mjs hashes or locks them at deploy time.
 */
const PREFIX = "scrypt$";

function derive(plain: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(plain, salt, 32, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(plain, salt)).toString("hex");
  return `${PREFIX}${salt}$${hash}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored.startsWith(PREFIX)) return false;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const salt = parts[1]!;
  const expected = Buffer.from(parts[2]!, "hex");
  if (expected.length !== 32) return false;
  const actual = await derive(plain, salt);
  return timingSafeEqual(actual, expected);
}

/** Burn the same CPU time as a real check, so "unknown user" is not faster. */
export async function dummyVerify(): Promise<void> {
  await derive("dummy-password", "0".repeat(32));
}

const COMMON = new Set([
  "a123456a",
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "password",
  "password1",
  "qwerty123",
  "qwertyui",
  "abc12345",
]);

/** Returns a Persian error message, or null when the password is acceptable. */
export function passwordProblem(password: string, username?: string): string | null {
  if (password.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد.";
  if (password.length > 128) return "رمز عبور خیلی طولانی است.";
  if (COMMON.has(password.toLowerCase())) return "این رمز خیلی ساده/معروف است؛ رمز دیگری انتخاب کنید.";
  if (username && password.toLowerCase() === username.toLowerCase()) {
    return "رمز عبور نباید با نام کاربری یکسان باشد.";
  }
  return null;
}
