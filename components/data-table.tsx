"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

/** Same logic as the table’s global filter — use for alternate mobile layouts. */
export function filterRowsByGlobalFilter<T>(data: T[], filterValue: string): T[] {
  const q = String(filterValue ?? "").toLowerCase().trim();
  if (!q) return data;
  try {
    return data.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(q),
    );
  } catch {
    return data;
  }
}

function jsonRowGlobalFilter<TData>(): FilterFn<TData> {
  return (row, _columnId, filterValue) => {
    const q = String(filterValue ?? "").toLowerCase().trim();
    if (!q) return true;
    try {
      return JSON.stringify(row.original).toLowerCase().includes(q);
    } catch {
      return false;
    }
  };
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  /** Shown only below `sm` when you use responsive column hiding—explains horizontal scroll. */
  mobileScrollHint?: string;
  /** Applied to the `<table>` (e.g. `min-w-[720px]` if you prefer scroll over hiding columns). */
  tableClassName?: string;
  /** When set with `onGlobalFilterChange`, filters rows and shows a search field above the table. */
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  filterPlaceholder?: string;
  /** When true, filtering still applies but the search input is not rendered (e.g. shared input elsewhere). */
  hideFilterInput?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No rows yet.",
  mobileScrollHint,
  tableClassName,
  globalFilter,
  onGlobalFilterChange,
  filterPlaceholder = "Search…",
  hideFilterInput = false,
}: DataTableProps<TData, TValue>) {
  const filterEnabled =
    globalFilter !== undefined && onGlobalFilterChange !== undefined;

  const table = useReactTable({
    data,
    columns,
    state: filterEnabled ? { globalFilter } : {},
    onGlobalFilterChange: filterEnabled ? onGlobalFilterChange : undefined,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: filterEnabled ? getFilteredRowModel() : undefined,
    globalFilterFn: filterEnabled ? jsonRowGlobalFilter<TData>() : undefined,
  });

  const filteredRows = table.getRowModel().rows;
  const hasFilterText = Boolean(globalFilter?.trim());
  const showNoMatch =
    filterEnabled && hasFilterText && data.length > 0 && filteredRows.length === 0;
  const emptyCellMessage = showNoMatch ? "No rows match your filter." : emptyMessage;

  return (
    <div className="min-w-0 space-y-2">
      {filterEnabled && !hideFilterInput ? (
        <Input
          type="search"
          placeholder={filterPlaceholder}
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          className="max-w-sm"
          aria-label={filterPlaceholder}
        />
      ) : null}
      {/* Border wraps the scroll container inside `Table` (shadcn). */}
      <div className="rounded-lg border border-border/80 bg-card shadow-sm">
        <Table className={tableClassName}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.columnDef.meta?.className}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-16 text-center text-xs"
                >
                  {emptyCellMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {mobileScrollHint ? (
        <p className="text-muted-foreground px-1 text-center text-xs sm:hidden">
          {mobileScrollHint}
        </p>
      ) : null}
    </div>
  );
}
