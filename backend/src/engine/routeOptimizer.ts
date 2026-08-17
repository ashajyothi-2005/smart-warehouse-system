export interface BinLocation3D {
  id: string;
  aisle: string | number; // Handles string "A", "B" or numeric 1, 2
  rack: number;  // Y coordinate
  shelf: number; // Z coordinate (shelf level)
  label?: string;
}

// Convert aisle string ('A' -> 1, 'B' -> 2) or number to a numeric coordinate
function getAisleIndex(aisle: string | number): number {
  if (typeof aisle === 'number') return aisle;
  const upper = aisle.toUpperCase();
  return upper.charCodeAt(0) - 64; // 'A' -> 1, 'B' -> 2
}

// 3D Euclidean Distance Calculator
function calculateDistance3D(a: BinLocation3D, b: BinLocation3D): number {
  const dx = getAisleIndex(a.aisle) - getAisleIndex(b.aisle);
  const dy = a.rack - b.rack;
  const dz = (a.shelf - b.shelf) * 0.5; // Z height scaling factor
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Total route distance
function calculateTotalPathDistance(path: BinLocation3D[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += calculateDistance3D(path[i], path[i + 1]);
  }
  return total;
}

// 2-Opt Optimization Solver for 3D TSP
export function generateOptimizedPickPath(bins: BinLocation3D[]): {
  optimizedPath: BinLocation3D[];
  totalDistanceMeters: number;
} {
  if (bins.length <= 1) {
    return { optimizedPath: bins, totalDistanceMeters: 0 };
  }

  // Start with Nearest Neighbor heuristic initial path
  let unvisited = [...bins];
  let current = unvisited.shift()!;
  let path = [current];

  while (unvisited.length > 0) {
    unvisited.sort((a, b) => calculateDistance3D(current, a) - calculateDistance3D(current, b));
    current = unvisited.shift()!;
    path.push(current);
  }

  // Refine using 2-Opt Swap Heuristic
  let improved = true;
  let bestDistance = calculateTotalPathDistance(path);

  while (improved) {
    improved = false;
    for (let i = 1; i < path.length - 2; i++) {
      for (let j = i + 1; j < path.length - 1; j++) {
        const newPath = [
          ...path.slice(0, i),
          ...path.slice(i, j + 1).reverse(),
          ...path.slice(j + 1),
        ];
        const newDistance = calculateTotalPathDistance(newPath);

        if (newDistance < bestDistance) {
          path = newPath;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }

  return {
    optimizedPath: path,
    totalDistanceMeters: Number((bestDistance * 2.5).toFixed(2)),
  };
}