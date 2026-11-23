export const VIDEO_ERROR = 'This browser cannot decode the video. iPhone videos in HEVC (H.265) often need Safari or Edge: open the app there, or convert the video to an H.264 MP4 first.';

export interface VideoInfo {
  fps: number; // frame rate of the file
  sampleFps: number; // rate we analyze at: the file rate, halved or more when it is above 60
  duration: number; // seconds
  width: number;
  height: number;
}

interface Box {
  type: string;
  start: number; // payload start
  end: number;
}

function boxes(view: DataView, start: number, end: number): Box[] {
  const out: Box[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = view.getUint32(pos);
    const type = String.fromCharCode(view.getUint8(pos + 4), view.getUint8(pos + 5), view.getUint8(pos + 6), view.getUint8(pos + 7));
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(pos + 8));
      header = 16;
    } else if (size === 0) size = end - pos;
    if (size < header || pos + size > end) break;
    out.push({ type, start: pos + header, end: pos + size });
    pos += size;
  }
  return out;
}

const find = (view: DataView, parent: Box, type: string): Box | undefined => boxes(view, parent.start, parent.end).find((b) => b.type === type);

/** Reads the video frame rate from the MP4/MOV header (the stts table), which is exact. */
export async function readFileFps(file: File): Promise<number | null> {
  // top level: find the moov box without reading the whole file
  let pos = 0;
  while (pos < file.size) {
    const head = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
    if (head.byteLength < 8) return null;
    let size = head.getUint32(0);
    const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7));
    if (size === 1) size = Number(head.getBigUint64(8));
    else if (size === 0) size = file.size - pos;
    if (size < 8) return null;
    if (type === 'moov') {
      const view = new DataView(await file.slice(pos, pos + size).arrayBuffer());
      return fpsFromMoov(view, { type, start: 8, end: size });
    }
    pos += size;
  }
  return null;
}

function fpsFromMoov(view: DataView, moov: Box): number | null {
  for (const trak of boxes(view, moov.start, moov.end).filter((b) => b.type === 'trak')) {
    const mdia = find(view, trak, 'mdia');
    const hdlr = mdia && find(view, mdia, 'hdlr');
    if (!mdia || !hdlr) continue;
    const handler = String.fromCharCode(...[8, 9, 10, 11].map((o) => view.getUint8(hdlr.start + o)));
    if (handler !== 'vide') continue;
    const mdhd = find(view, mdia, 'mdhd');
    const stbl = (() => {
      const minf = find(view, mdia, 'minf');
      return minf && find(view, minf, 'stbl');
    })();
    const stts = stbl && find(view, stbl, 'stts');
    if (!mdhd || !stts) continue;
    const timescale = view.getUint32(mdhd.start + (view.getUint8(mdhd.start) === 1 ? 20 : 12));
    const entries = view.getUint32(stts.start + 4);
    let samples = 0;
    let ticks = 0;
    for (let i = 0; i < entries; i++) {
      const count = view.getUint32(stts.start + 8 + i * 8);
      const delta = view.getUint32(stts.start + 12 + i * 8);
      samples += count;
      ticks += count * delta;
    }
    return ticks ? (samples * timescale) / ticks : null;
  }
  return null;
}

/** A recording from MediaRecorder often has no duration in its header. Seeking far past the end makes the browser work it out. */
async function settleDuration(video: HTMLVideoElement): Promise<void> {
  if (Number.isFinite(video.duration)) return;
  await new Promise<void>((resolve) => {
    const done = (): void => {
      video.removeEventListener('durationchange', check);
      resolve();
    };
    const check = (): void => {
      if (Number.isFinite(video.duration)) {
        video.currentTime = 0;
        done();
      }
    };
    video.addEventListener('durationchange', check);
    setTimeout(done, 5000);
    video.currentTime = 1e9;
  });
}

/** `knownFps` is for clips recorded in the app: their header has no usable frame rate, but the camera told us. */
export async function probeVideo(file: File, video: HTMLVideoElement, knownFps?: number): Promise<VideoInfo> {
  if (!video.videoWidth) {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error(VIDEO_ERROR)), { once: true });
    });
  }
  await settleDuration(video);
  let fps = 30; // fallback when the header cannot be read
  try {
    fps = (await readFileFps(file)) ?? knownFps ?? 30;
  } catch {
    fps = knownFps ?? 30;
  }
  // 120 or 240 fps files are analyzed at an exact divisor (60 or so), frames stay aligned and tracking stays fast
  const sampleFps = fps > 62 ? fps / Math.ceil(fps / 60) : fps;
  return { fps, sampleFps, duration: video.duration, width: video.videoWidth, height: video.videoHeight };
}
