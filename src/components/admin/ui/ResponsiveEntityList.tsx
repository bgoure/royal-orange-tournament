import type { ReactNode } from "react";

export type EntityColumn<T> = {
  /** Stable key for the column, also used as the React key. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Extra classes for both the header cell and body cells. */
  className?: string;
};

type Props<T> = {
  rows: readonly T[];
  columns: readonly EntityColumn<T>[];
  getRowKey: (row: T) => string;
  /** Mobile presentation for a single row. */
  renderCard: (row: T) => ReactNode;
  /** Screen-reader description of the table. */
  caption?: string;
  emptyState?: ReactNode;
  className?: string;
};

/**
 * One data set, two presentations: a table from `md` up and stacked cards
 * below it, so admin lists stay usable on a phone at the field.
 */
export function ResponsiveEntityList<T>({
  rows,
  columns,
  getRowKey,
  renderCard,
  caption,
  emptyState,
  className = "",
}: Props<T>) {
  if (rows.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={className}>
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""} ${
                    col.className ?? ""
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="text-zinc-800">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 align-top ${
                      col.align === "right" ? "text-right" : ""
                    } ${col.className ?? ""}`}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li
            key={getRowKey(row)}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            {renderCard(row)}
          </li>
        ))}
      </ul>
    </div>
  );
}
