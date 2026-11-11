// Development-only storage (ASHA_MEMORY_STORE=1). Data lives in server memory and is lost on restart.
const data = (globalThis.__ashaMemoryStore ??= new Map());

export const memoryStore = {
  async read(path) {
    return data.has(path) ? structuredClone(data.get(path)) : null;
  },
  async write(path, value, overwrite = false) {
    if (!overwrite && data.has(path)) throw Error("Already exists");
    data.set(path, structuredClone(value));
  },
  async list(prefix, max = 500) {
    return [...data.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, max);
  },
  async remove(paths) {
    for (const p of paths) data.delete(p);
  },
};
