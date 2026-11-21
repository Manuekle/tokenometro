/**
 * Least-recently-used map. Reading or writing a key makes it the newest;
 * going over capacity drops the oldest. Used to bound how many big tokenizers
 * stay in memory.
 */
export class LruMap<K, V> {
  private map = new Map<K, V>();

  constructor(
    private readonly capacity: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {
    if (capacity < 1) throw new RangeError("capacity must be at least 1");
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as K;
      const evicted = this.map.get(oldest) as V;
      this.map.delete(oldest);
      this.onEvict?.(oldest, evicted);
    }
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }

  /** Oldest first. */
  keys(): K[] {
    return [...this.map.keys()];
  }
}
