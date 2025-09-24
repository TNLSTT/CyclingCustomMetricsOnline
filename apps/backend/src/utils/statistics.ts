export interface XYPoint {
  x: number;
  y: number;
}

export function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error('Cannot compute median of empty array');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    throw new Error('Cannot compute quantile of empty array');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function linearRegression(points: XYPoint[]) {
  if (points.length === 0) {
    throw new Error('Cannot compute regression of empty points');
  }
  const n = points.length;
  const sumX = points.reduce((acc, point) => acc + point.x, 0);
  const sumY = points.reduce((acc, point) => acc + point.y, 0);
  const sumXY = points.reduce((acc, point) => acc + point.x * point.y, 0);
  const sumXX = points.reduce((acc, point) => acc + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = n === 0 ? 0 : (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const point of points) {
    const predicted = slope * point.x + intercept;
    ssTot += (point.y - meanY) ** 2;
    ssRes += (point.y - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2, ssRes, ssTot };
}

export function theilSenSlope(points: XYPoint[]): { slope: number; intercept: number } | null {
  if (points.length < 2) {
    return null;
  }
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[j].x - points[i].x;
      if (dx === 0) {
        continue;
      }
      slopes.push((points[j].y - points[i].y) / dx);
    }
  }

  if (slopes.length === 0) {
    return null;
  }

  const slope = median(slopes);
  const intercepts = points.map((point) => point.y - slope * point.x);
  const intercept = median(intercepts);

  return { slope, intercept };
}

export function computeR2(points: XYPoint[], slope: number, intercept: number) {
  if (points.length === 0) {
    return { r2: 0, ssRes: 0, ssTot: 0 };
  }
  const meanY =
    points.reduce((acc, point) => acc + point.y, 0) / points.length;
  let ssTot = 0;
  let ssRes = 0;
  for (const point of points) {
    const predicted = slope * point.x + intercept;
    ssTot += (point.y - meanY) ** 2;
    ssRes += (point.y - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { r2, ssRes, ssTot };
}
