import { SpatialHash } from './spatial-hash';

describe('SpatialHash', () => {
  let hash: SpatialHash;
  let out: number[];

  beforeEach(() => {
    hash = new SpatialHash(50);
    out = [];
  });

  it('should return inserted indices within query radius', () => {
    hash.insert(0, 10, 10);
    hash.insert(1, 55, 10);
    hash.insert(2, 500, 500);

    hash.queryRadius(10, 10, 60, out);
    expect(out).toContain(0);
    expect(out).toContain(1);
    expect(out).not.toContain(2);
  });

  it('should find neighbors across cell boundaries', () => {
    hash.insert(0, 49, 25);
    hash.insert(1, 51, 25);

    hash.queryRadius(50, 25, 5, out);
    expect(out).toContain(0);
    expect(out).toContain(1);
  });

  it('should clear all buckets', () => {
    hash.insert(0, 10, 10);
    hash.clear();
    hash.queryRadius(10, 10, 100, out);
    expect(out.length).toBe(0);
  });

  it('should reuse the output buffer', () => {
    hash.insert(3, 20, 20);
    const first = hash.queryRadius(20, 20, 10, out);
    const second = hash.queryRadius(20, 20, 10, out);
    expect(first).toBe(second);
    expect(second).toEqual([3]);
  });
});
