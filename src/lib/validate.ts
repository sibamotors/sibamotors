import { z } from "zod";

/**
 * Turns a zod schema into a TanStack Start input validator.
 * Usage: createServerFn().validator(parse(z.object({ id: z.string() })))
 * The client call stays fully typed (z.input) and the server really validates.
 */
export function parse<S extends z.ZodType>(schema: S) {
  return (input: z.input<S>): z.output<S> => schema.parse(input);
}

/** Trimmed, length-limited text (rejects empty by default). */
export const text = (max: number, min = 1) => z.string().trim().min(min).max(max);

/** Lower-cased username (same rule used everywhere in the app). */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9._-]+$/, "invalid username");
