import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * false on the server and during hydration, true right after.
 *
 * App state is initialised from localStorage (branch, user, cart, staff role…), which the server cannot see.
 * Rendering the app before mount made server and client HTML differ for every returning visitor, so React
 * discarded the server HTML ("Hydration failed … tree will be regenerated") and rebuilt the whole page.
 * Gating the first render on this hook keeps hydration deterministic.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
