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
  // `realtime` must be applied AFTER the spread: with `{...props}` last, an
  // explicit `realtime={undefined}` (very common when forwarding an optional prop)
  // would overwrite the default and silently drop back to polling-only.
  return (
    <BaseProvider
      {...props}
      realtime={
        props.realtime === undefined ? reactNativeSseTransport : props.realtime
      }
    />
  );
}

export type { ElaanProviderProps };
