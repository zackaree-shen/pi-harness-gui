/**
 * Flattens a nested message object into dot-joined keys.
 * e.g. { sidebar: { newThread: "x" } } -> "sidebar.newThread"
 */
export type FlattenKeys<
  T,
  Prefix extends string = "",
> = {
  [K in keyof T]: T[K] extends string
    ? `${Prefix}${K & string}`
    : FlattenKeys<T[K], `${Prefix}${K & string}.`>;
}[keyof T];

export type AppLanguage = "zh-CN" | "en";

/** Placeholder interpolation values passed to t() */
export type TValues = Record<string, string | number>;
