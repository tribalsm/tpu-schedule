export interface InstallPrompt extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPrompt | undefined;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
  window.dispatchEvent(new Event('tpu-install-ready'));
});

window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  window.dispatchEvent(new Event('tpu-install-ready'));
});

export function isStandalone() {
  const ios = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || Boolean(ios.standalone);
}

export async function promptInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = undefined;
  await prompt.prompt();
  return true;
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return Promise.resolve(undefined);
  return navigator.serviceWorker.register(new URL('./sw.js', location.href), { updateViaCache: 'none' });
}
