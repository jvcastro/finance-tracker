import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // Match TanStack generics; names are required for declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Merged onto header and body cells (e.g. `hidden md:table-cell`). */
    className?: string;
  }
}
