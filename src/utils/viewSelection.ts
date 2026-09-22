export function pickVisibleViewIds(
  allIds: string[],
  gridLayout: number,
  selection: string[]
): string[] {
  const maxVisible = Math.max(1, Math.min(gridLayout, allIds.length));

  if (selection.length > 0) {
    const validSelection = selection.filter((id) => allIds.includes(id));
    if (validSelection.length > 0) {
      return validSelection.slice(0, maxVisible);
    }
  }

  return allIds.slice(0, maxVisible);
}
