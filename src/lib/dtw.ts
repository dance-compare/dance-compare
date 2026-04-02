// Dynamic Time Warping implementation
// Aligns two sequences to handle tempo differences

export interface DTWResult {
  distance: number;
  path: [number, number][]; // pairs of [refIndex, userIndex]
}

export function dtw(
  refAngles: number[][],
  userAngles: number[][],
  distanceFn: (a: number[], b: number[]) => number
): DTWResult {
  const n = refAngles.length;
  const m = userAngles.length;

  if (n === 0 || m === 0) {
    return { distance: Infinity, path: [] };
  }

  // Cost matrix
  const cost: number[][] = Array.from({ length: n }, () => new Array(m).fill(Infinity));

  cost[0][0] = distanceFn(refAngles[0], userAngles[0]);

  // First column
  for (let i = 1; i < n; i++) {
    cost[i][0] = cost[i - 1][0] + distanceFn(refAngles[i], userAngles[0]);
  }

  // First row
  for (let j = 1; j < m; j++) {
    cost[0][j] = cost[0][j - 1] + distanceFn(refAngles[0], userAngles[j]);
  }

  // Fill the rest
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const d = distanceFn(refAngles[i], userAngles[j]);
      cost[i][j] = d + Math.min(cost[i - 1][j], cost[i][j - 1], cost[i - 1][j - 1]);
    }
  }

  // Backtrack to find optimal path
  const path: [number, number][] = [];
  let i = n - 1;
  let j = m - 1;
  path.push([i, j]);

  while (i > 0 || j > 0) {
    if (i === 0) {
      j--;
    } else if (j === 0) {
      i--;
    } else {
      const min = Math.min(cost[i - 1][j], cost[i][j - 1], cost[i - 1][j - 1]);
      if (min === cost[i - 1][j - 1]) {
        i--;
        j--;
      } else if (min === cost[i - 1][j]) {
        i--;
      } else {
        j--;
      }
    }
    path.push([i, j]);
  }

  path.reverse();

  return {
    distance: cost[n - 1][m - 1],
    path,
  };
}
