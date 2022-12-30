export const knownWarpPluginsPartial = [`^smartweave-extension-`] as const;
export const knownWarpPlugins = [
  'evm-signature-verification',
  'subscription',
  'ivm-handler-api',
  'evaluation-progress',
  'fetch-options',
  ...knownWarpPluginsPartial
] as const;
export type WarpPluginType = typeof knownWarpPlugins[number];

export interface WarpPlugin<T, R> {
  type(): WarpPluginType;

  process(input: T): R;
}
