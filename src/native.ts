/** What makes the installed app behave like a native one: screen stays on, install help, update notice. */

// ---------- keep the screen on ----------

let lock: WakeLockSentinel | null = null;
let wanted = false;

async function take(): Promise<void> {
  try {
    if (wanted && !lock && document.visibilityState === 'visible') {
      lock = (await navigator.wakeLock?.request('screen')) ?? null;
      lock?.addEventListener('release', () => (lock = null));
    }
  } catch {
    // not supported or refused: the screen may dim, nothing else changes
  }
}

/** Keeps the screen on while an analysis or a recording runs. The browser drops the lock when the app is hidden, so it is taken again on return. */
export function keepAwake(on: boolean): void {
  wanted = on;
  if (on) void take();
  else {
    void lock?.release().catch(() => undefined);
    lock = null;
  }
}
document.addEventListener('visibilitychange', () => void take());

// ---------- install ----------

interface InstallEvent extends Event {
  prompt(): Promise<unknown>;
}
let deferred: InstallEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallEvent;
});
window.addEventListener('appinstalled', () => (deferred = null));

export const installed = (): boolean => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** The line that helps installing, or nothing when the app is already installed. */
export function installHelp(): { text: string; action?: () => void; label?: string } | null {
  if (installed()) return null;
  if (deferred) {
    const ev = deferred;
    return { text: 'Install Hoop Lab as an app: its own icon, full screen, works offline.', label: 'Install', action: () => void ev.prompt() };
  }
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return { text: 'To install: tap the Share button in Safari, then "Add to Home Screen". It opens full screen like an app.' };
  return { text: 'To install: open the browser menu and choose "Install app" or "Add to Home screen".' };
}

// ---------- updates ----------

/** The service worker swaps itself in on a new version. This tells the person, so a reload brings the new screens. */
export function watchUpdates(): void {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (document.querySelector('.toast')) return;
    const bar = document.createElement('div');
    bar.className = 'toast';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>A new version is ready.</span><button class="btn small primary" type="button">Reload</button>';
    bar.querySelector('button')!.onclick = () => location.reload();
    document.body.append(bar);
  });
}

// ---------- small feedback ----------

/** A short message at the bottom that goes away by itself. */
export function toast(text: string): void {
  document.querySelector('.toast.brief')?.remove();
  const bar = document.createElement('div');
  bar.className = 'toast brief';
  bar.setAttribute('role', 'status');
  bar.textContent = text;
  document.body.append(bar);
  setTimeout(() => bar.remove(), 2400);
}

/** A tiny tick on a tap, where the phone allows it (Android). iPhones do not offer vibration to web pages. */
export function tick(): void {
  try {
    navigator.vibrate?.(8);
  } catch {
    // no haptics here
  }
}
