/**
 * Uniform grid spatial hash for fast neighbor queries by particle index.
 */
export class SpatialHash {
  private readonly invCellSize: number;
  private readonly cells = new Map<string, number[]>();

  constructor(cellSize: number) {
    this.invCellSize = 1 / cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(index: number, x: number, y: number): void {
    const cx = Math.floor(x * this.invCellSize);
    const cy = Math.floor(y * this.invCellSize);
    const key = `${cx},${cy}`;
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(index);
  }

  queryRadius(x: number, y: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const minCx = Math.floor((x - radius) * this.invCellSize);
    const maxCx = Math.floor((x + radius) * this.invCellSize);
    const minCy = Math.floor((y - radius) * this.invCellSize);
    const maxCy = Math.floor((y + radius) * this.invCellSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.cells.get(`${cx},${cy}`);
        if (!bucket) {
          continue;
        }
        for (let k = 0; k < bucket.length; k++) {
          out.push(bucket[k]);
        }
      }
    }
    return out;
  }
}
