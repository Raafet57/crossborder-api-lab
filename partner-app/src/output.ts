type Cell = string | number | null | undefined;

export function printTable(headers: string[], rows: Cell[][]) {
  const allRows = [headers, ...rows].map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))),
  );

  const widths = headers.map((_, idx) =>
    Math.max(...allRows.map((row) => row[idx]?.length ?? 0)),
  );

  const formatRow = (row: string[]) =>
    row
      .map((cell, idx) => cell.padEnd(widths[idx] ?? 0))
      .join("  ")
      .trimEnd();

  console.log(formatRow(allRows[0] ?? []));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of allRows.slice(1)) {
    console.log(formatRow(row));
  }
}

export function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}
