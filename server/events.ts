type Listener = (event: { type: string }) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(userId: string, listener: Listener): () => void {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(userId);
  };
}

export function emit(userId: string, event: { type: string }): void {
  const set = listeners.get(userId);
  if (!set) return;
  for (const listener of set) listener(event);
}

export function emitMany(events: { userId: string; event: { type: string } }[]): void {
  for (const item of events) emit(item.userId, item.event);
}
