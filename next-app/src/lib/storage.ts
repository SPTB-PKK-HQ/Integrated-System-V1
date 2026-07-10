export const storage = {
  get<T>(key: string): T | null {
    try {
      const val = window.localStorage.getItem(key);
      if (val === null) return null;
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  },

  set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('storage.set error:', error);
    }
  },

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error('storage.remove error:', error);
    }
  },

  getKeys<T>(keys: string[]): Record<string, T | null> {
    const result: Record<string, T | null> = {};
    keys.forEach(key => {
      result[key] = this.get<T>(key);
    });
    return result;
  },

  setKeys(obj: Record<string, unknown>): void {
    Object.entries(obj).forEach(([key, value]) => this.set(key, value));
  },

  removeKeys(keys: string[]): void {
    keys.forEach(key => this.remove(key));
  },
};
