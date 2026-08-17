export interface BinCoordinate {
  id: string;
  code: string;
  aisle: string;
  rack: number;
  shelf: number;
}

export function generateOptimizedPickPath(bins: BinCoordinate[]): BinCoordinate[] {
  // Sort sequence: Aisle alphabetically -> Rack numerically -> Shelf ascending
  return [...bins].sort((a, b) => {
    if (a.aisle !== b.aisle) return a.aisle.localeCompare(b.aisle);
    if (a.rack !== b.rack) return a.rack - b.rack;
    return a.shelf - b.shelf;
  });
}