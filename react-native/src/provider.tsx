import {
  ElaanProvider as BaseProvider,
  type ElaanProviderProps,
} from "@elaanio/react-core";
import { reactNativeSseTransport } from "./realtime";

/**
 * React Native <ElaanProvider>: the shared React binding with the
 * react-native-sse realtime transport wired in by default. Realtime falls back
 * to polling automatically when the deployment has it off; pass `realtime={null}`
 * to force polling only.
 */
export function ElaanProvider(props: ElaanProviderProps) {
  return <BaseProvider realtime={reactNativeSseTransport} {...props} />;
}

export type { ElaanProviderProps };
