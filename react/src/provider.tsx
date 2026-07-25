import {
  ElaanProvider as BaseProvider,
  fetchStreamTransport,
  type ElaanProviderProps,
} from "@elaan/react-core";

/**
 * Web <ElaanProvider>: the shared React binding with the fetch-SSE realtime
 * transport wired in by default (override `realtime` to disable/replace it).
 */
export function ElaanProvider(props: ElaanProviderProps) {
  return <BaseProvider realtime={fetchStreamTransport} {...props} />;
}

export type { ElaanProviderProps };
