/**
 * In-memory caching service for static data
 * Caches violations, categories, and hearing officers with TTL
 */

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

class CacheService {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttl = CACHE_DURATION) {
    const expiry = Date.now() + ttl;
    this.store.set(key, { value, expiry });
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  clear(key) {
    this.store.delete(key);
  }

  clearAll() {
    this.store.clear();
  }

  has(key) {
    return this.get(key) !== null;
  }
}

export const cacheService = new CacheService();
