import type { Person } from "./types";

export function personName(p: Person): string {
  return `${p.firstName} ${p.lastName}`;
}

export function personById(people: Person[], id: string | null | undefined): Person | undefined {
  if (!id) return undefined;
  return people.find((p) => p.id === id);
}
