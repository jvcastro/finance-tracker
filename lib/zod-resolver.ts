import { zodResolver as zodResolverBase } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";

/**
 * Bridges Zod 4 + @hookform/resolvers v5 overloads (avoids TS mismatch on `_zod.version.minor`).
 */
export function zodResolver<T extends FieldValues>(schema: unknown): Resolver<T> {
  return zodResolverBase(schema as never) as Resolver<T>;
}
