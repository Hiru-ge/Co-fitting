// vite-plugin-pwa の virtual:pwa-register をテスト環境でスタブ化する
export function registerSW(_options?: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (r: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}): () => void {
  return () => {};
}
