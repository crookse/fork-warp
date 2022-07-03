/**
 * A cache that stores its values per contract tx id and sort key.
 * A sort key is a value that the SmartWeave protocol is using
 * to sort contract transactions ({@link LexicographicalInteractionsSorter}.
 *
 * All values should be stored in a lexicographical order (per contract) -
 * sorted by the sort key.
 */
export interface SortKeyCache<V> {
  getLessOrEqual(key: string, sortKey: string): Promise<SortKeyCacheResult<V> | null>;

  /**
   * returns latest value stored for given key
   */
  getLast(key: string): Promise<SortKeyCacheResult<V> | null>;

  /**
   * returns value for the key and exact blockHeight
   */
  get(contractTxId: string, sortKey: string, returnDeepCopy?: boolean): Promise<SortKeyCacheResult<V> | null>;

  /**
   * puts new value in cache under given {@link StateCacheKey.key} and {@link StateCacheKey.blockHeight}.
   */
  put(stateCacheKey: StateCacheKey, value: V): Promise<void>;

  close(): Promise<void>;

  /**
   * used mostly for debugging, allows to dump the current content cache
   */
  dump(): Promise<any>;
}

export class StateCacheKey {
  constructor(readonly contractTxId: string, readonly sortKey: string) {}
}

// tslint:disable-next-line:max-classes-per-file
export class SortKeyCacheResult<V> {
  constructor(readonly sortKey: string, readonly cachedValue: V) {}
}
