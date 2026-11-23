import { snapBox } from './snapview';
import type { Snap } from './snapshots';

/**
 * Optional photos of the key moments, cut around the person and kept on this device only (IndexedDB, not in backups).
 * Off by default: a photo shows a face and the surroundings, which the drawings do not.
 */

const DB = 'hooplab-photos';
const STORE = 'photos';
const SETTING = 'hooplab.keepPhotos';
const WIDTH = 360; // pixels; the crop is 4:5, so about 25 KB as a JPEG

export function keepPhotos(): boolean {
  try {
    return localStorage.getItem(SETTING) === '1';
  } catch {
    return false;
  }
}

export function setKeepPhotos(on: boolean): void {
  try {
    localStorage.setItem(SETTING, on ? '1' : '0');
  } catch {
    // the setting just stays off
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const key = (sessionId: string, i: number): string => `${sessionId}:${i}`;

export async function getPhotoUrl(sessionId: string, i: number): Promise<string | null> {
  try {
    const blob = await run<Blob | undefined>('readonly', (s) => s.get(key(sessionId, i)));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

/** Removes the photos of one session. */
export async function deletePhotos(sessionId: string): Promise<void> {
  try {
    await run('readwrite', (s) => void s.delete(IDBKeyRange.bound(`${sessionId}:`, `${sessionId}:￿`)));
  } catch {
    // nothing to clean up
  }
}

export async function clearPhotos(): Promise<void> {
  try {
    await run('readwrite', (s) => void s.clear());
  } catch {
    // nothing to clean up
  }
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('seek timed out')), 4000);
    video.addEventListener(
      'seeked',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    video.currentTime = time;
  });
}

/** A JPEG of the area around the person at one frame. Parts outside the video are filled grey. */
async function cutPhoto(video: HTMLVideoElement, fps: number, snap: Snap): Promise<Blob | null> {
  if (snap.frame === undefined) return null;
  await seek(video, (snap.frame + 0.5) / fps);
  const { norm } = snapBox(snap);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = Math.round((WIDTH * (norm.h * vh)) / (norm.w * vw));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8a8a8c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // the part of the crop that lies inside the frame
  const sx = Math.max(0, norm.x * vw);
  const sy = Math.max(0, norm.y * vh);
  const ex = Math.min(vw, (norm.x + norm.w) * vw);
  const ey = Math.min(vh, (norm.y + norm.h) * vh);
  if (ex <= sx || ey <= sy) return null;
  const k = canvas.width / (norm.w * vw);
  ctx.drawImage(video, sx, sy, ex - sx, ey - sy, (sx - norm.x * vw) * k, (sy - norm.y * vh) * k, (ex - sx) * k, (ey - sy) * k);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.78));
}

/** Cuts and stores a photo for every snapshot of the given sessions. Returns how many were saved. A failure here never loses the results. */
export async function savePhotos(video: HTMLVideoElement, fps: number, sessions: { id: string; snaps: Snap[] }[]): Promise<number> {
  let saved = 0;
  try {
    for (const s of sessions) {
      for (let i = 0; i < s.snaps.length; i++) {
        const blob = await cutPhoto(video, fps, s.snaps[i]);
        if (blob) {
          await run('readwrite', (st) => st.put(blob, key(s.id, i)));
          saved++;
        }
      }
    }
  } catch {
    // storage full or blocked: the drawings are still saved
  }
  return saved;
}
