import {
  ElaanProvider as BaseProvider,
  fetchStreamTransport,
  type ElaanProviderProps,
} from "@elaanio/react-core";

/**
 * Web <ElaanProvider>: the shared React binding with the fetch-SSE realtime
 * transport wired in by default (override `realtime` to disable/replace it).
 */
export function ElaanProvider(props: ElaanProviderProps) {
  // `realtime` must be applied AFTER the spread: with `{...props}` last, an
  // explicit `realtime={undefined}` (very common when forwarding an optional prop)
  // would overwrite the default and silently drop back to polling-only.
  return (
    <BaseProvider
      {...props}
      realtime={props.realtime === undefined ? fetchStreamTransport : props.realtime}
    />
  );
}

export type { ElaanProviderProps };
