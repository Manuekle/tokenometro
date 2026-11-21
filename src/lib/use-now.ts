import { useSyncExternalStore } from "react";

let snapshot = 0;
const subscribe = () => () => undefined;
const getSnapshot = () => (snapshot ||= Date.now());
const getServerSnapshot = () => 0;

/**
 * Current time (ms) on the client, frozen at first read; 0 on the server and
 * during hydration. Server and client therefore agree on the first render and
 * time-dependent labels appear right after, with no hydration mismatch.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
