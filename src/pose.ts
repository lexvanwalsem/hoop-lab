import { FilesetResolver, ObjectDetector, PoseLandmarker } from '@mediapipe/tasks-vision';
import { pickBalls } from './ball';
import { armFrame, VIDEO_ERROR } from './video';

export interface Pt {
  x: number; // normalized 0..1
  y: number; // normalized 0..1, down is positive
}

export interface Pose {
  fps: number;
  width: number;
  height: number;
  frames: (Pt[] | null)[]; // one entry per sampled frame, null when no person found
  balls: (Pt | null)[]; // ball center per frame, null when no ball found
  world: (Pt3[] | null)[]; // 3D landmarks in meters (hip-centered), independent of camera angle
}

export interface Pt3 {
  x: number;
  y: number;
  z: number;
}

type Files = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

const MODELS_MISSING = 'The tracking models could not be loaded. Run "npm install" once so they are downloaded to public/models, then restart the app.';

async function withGpuFallback<T>(make: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  try {
    return await make('GPU');
  } catch {
    try {
      return await make('CPU');
    } catch {
      throw new Error(MODELS_MISSING);
    }
  }
}

const createPoseLandmarker = (files: Files) =>
  withGpuFallback((delegate) =>
    PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: import.meta.env.BASE_URL + 'models/pose_landmarker_heavy.task', delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    }),
  );

const createBallDetector = (files: Files) =>
  withGpuFallback((delegate) =>
    ObjectDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: import.meta.env.BASE_URL + 'models/efficientdet_lite2.tflite', delegate },
      runningMode: 'VIDEO',
      scoreThreshold: 0.15,
      maxResults: 5,
      categoryAllowlist: ['sports ball'],
    }),
  );

/** Waits for a video event. Listeners are removed afterwards and a stalled video fails instead of hanging forever. */
function waitFor(el: HTMLVideoElement, event: 'loadedmetadata' | 'seeked', timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      el.removeEventListener(event, ok);
      el.removeEventListener('error', bad);
    };
    const ok = (): void => {
      cleanup();
      resolve();
    };
    const bad = (): void => {
      cleanup();
      reject(new Error(VIDEO_ERROR));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('The video stopped responding while it was being read. Try again, or convert it to an H.264 MP4.'));
    }, timeoutMs);
    el.addEventListener(event, ok);
    el.addEventListener('error', bad);
  });
}

/**
 * Moves the video to a time and waits until that frame is ready. A long or high-resolution clip (4K, HEVC) can need a while per seek,
 * so it waits up to 20 seconds, and a seek that goes unanswered is tried once more from a slightly different time.
 */
async function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  if (Math.abs(video.currentTime - t) < 1e-4) return; // already there: the browser would not report a seek
  for (let attempt = 0; ; attempt++) {
    const seeked = waitFor(video, 'seeked', 20000);
    const frame = armFrame(video);
    video.currentTime = t + attempt * 0.0007;
    try {
      await seeked;
      await frame();
      return;
    } catch (e) {
      if (attempt >= 1 || (e instanceof Error && e.message === VIDEO_ERROR)) throw e;
    }
  }
}

/** Steps through the video at `fps` and runs pose and ball detection on every step. Pass a signal to cancel. */
export async function extractPose(
  video: HTMLVideoElement,
  fps: number,
  onProgress: (fraction: number) => void,
  trackBall: boolean,
  signal?: AbortSignal,
): Promise<Pose> {
  if (!video.videoWidth) await waitFor(video, 'loadedmetadata', 15000);
  const files = await FilesetResolver.forVisionTasks(import.meta.env.BASE_URL + 'wasm');
  const landmarker = await createPoseLandmarker(files);
  const detector = trackBall ? await createBallDetector(files) : null;
  const count = Math.floor(video.duration * fps);
  const frames: (Pt[] | null)[] = [];
  const cands: Pt[][] = []; // every ball the detector sees per frame; the one in play is picked afterwards
  const world: (Pt3[] | null)[] = [];
  try {
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      await seekTo(video, (i + 0.5) / fps); // middle of frame i, so a seek always lands on the same frame
      const ts = Math.round((i * 1000) / fps);
      const result = landmarker.detectForVideo(video, ts);
      const lm = result.landmarks[0];
      frames.push(lm ? lm.map((p) => ({ x: p.x, y: p.y })) : null);
      const w = result.worldLandmarks[0];
      world.push(w ? w.map((p) => ({ x: p.x, y: p.y, z: p.z })) : null);

      // detections come back in pixels; all of them are kept, because there can be more than one ball in the picture
      const dets = detector ? detector.detectForVideo(video, ts).detections : [];
      cands.push(dets.flatMap((d) => (d.boundingBox ? [{ x: (d.boundingBox.originX + d.boundingBox.width / 2) / video.videoWidth, y: (d.boundingBox.originY + d.boundingBox.height / 2) / video.videoHeight }] : [])));
      if (i % 5 === 0) onProgress(i / count);
    }
  } finally {
    landmarker.close();
    detector?.close();
  }
  onProgress(1);
  const balls = pickBalls(frames, cands, video.videoWidth, video.videoHeight, fps);
  return { fps, width: video.videoWidth, height: video.videoHeight, frames, balls, world };
}

/** A tracker for a live camera: call detect() on a playing video. Used by the framing check. */
export async function createLivePose(): Promise<{ detect: (video: HTMLVideoElement) => { x: number; y: number; v: number }[] | null; close: () => void }> {
  const files = await FilesetResolver.forVisionTasks(import.meta.env.BASE_URL + 'wasm');
  const landmarker = await createPoseLandmarker(files);
  let last = -1;
  return {
    detect(video) {
      const ts = Math.max(performance.now(), last + 1); // timestamps must keep increasing
      last = ts;
      const lm = landmarker.detectForVideo(video, ts).landmarks[0];
      return lm ? lm.map((p) => ({ x: p.x, y: p.y, v: p.visibility ?? 0 })) : null;
    },
    close: () => landmarker.close(),
  };
}
