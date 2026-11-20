import { VERDICT } from './art';
import { checkFraming, type Check, type Framing } from './framing';
import { createLivePose } from './pose';

/** The pose landmark pairs that make up the drawn skeleton. */
const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const GOOD = '#1eaa52';
const SMOOTH = 3; // a check needs to hold in 2 of the last 3 looks, so the list does not flicker

const NO_CAMERA = 'This browser cannot open the camera here. Camera access needs a secure address (https) or localhost.';

/** Full-screen live view with a checklist: is the person framed the way the analysis needs? Nothing is recorded or sent anywhere. */
export function openFramingCheck(): void {
  if (document.querySelector('.camcheck')) return;
  const opener = document.activeElement as HTMLElement | null;
  const root = document.createElement('div');
  root.className = 'camcheck';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Framing check');
  root.innerHTML = `
    <div class="cam-stage">
      <div class="cam-view"><video playsinline muted></video><canvas></canvas></div>
      <div class="cam-msg"><p data-msg></p><button class="btn primary" data-start>Start camera</button></div>
    </div>
    <aside class="cam-panel">
      <div class="row between"><h2>Framing check</h2><button class="btn small" data-close>Close</button></div>
      <p class="cam-say" data-say role="status">Stand where you will jump, with the phone where you will film from.</p>
      <ul class="cam-checks" data-checks></ul>
      <div class="row"><button class="btn small" data-flip hidden>Flip camera</button></div>
      <p class="muted small">Nothing is recorded or uploaded. When it says good, leave the phone exactly there and film with your camera app at 60 fps.</p>
    </aside>`;
  document.body.append(root);
  document.documentElement.classList.add('sheet-open'); // same scroll lock as the session sheet

  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const video = $<HTMLVideoElement>('video');
  const canvas = $<HTMLCanvasElement>('canvas');
  const ctx = canvas.getContext('2d')!;
  const view = $('.cam-view');
  const msgBox = $('.cam-msg');
  const msg = $('[data-msg]');
  const startBtn = $<HTMLButtonElement>('[data-start]');
  const flipBtn = $<HTMLButtonElement>('[data-flip]');
  const sample = document.createElement('canvas');
  sample.width = 32;
  sample.height = 18;

  let stream: MediaStream | null = null;
  let pose: Awaited<ReturnType<typeof createLivePose>> | null = null;
  let raf = 0;
  let closed = false;
  let facing: 'user' | 'environment' = 'user'; // the front camera by default: you can see the screen while you stand in front of it
  const recent: Framing[] = [];

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  const close = (): void => {
    closed = true;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    pose?.close();
    document.removeEventListener('keydown', onKey);
    root.remove();
    document.documentElement.classList.remove('sheet-open');
    opener?.focus?.();
  };
  document.addEventListener('keydown', onKey);
  $('[data-close]').onclick = close;
  $<HTMLButtonElement>('[data-close]').focus();

  const stage = (text: string | null): void => {
    msgBox.hidden = text === null;
    msg.textContent = text ?? '';
  };
  stage('The camera is only used on this screen to check your framing.');

  const brightness = (): number => {
    const c = sample.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(video, 0, 0, sample.width, sample.height);
    const px = c.getImageData(0, 0, sample.width, sample.height).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    return sum / (px.length / 4);
  };

  /** Majority of the last few looks, so one bad frame does not turn the list red. */
  const settled = (latest: Framing): Framing => {
    recent.push(latest);
    if (recent.length > SMOOTH) recent.shift();
    const checks: Check[] = latest.checks.map((c) => ({ ...c, ok: recent.filter((f) => f.checks.find((x) => x.id === c.id)?.ok).length * 2 > recent.length }));
    const first = checks.find((c) => !c.ok);
    return { checks, ready: !first, say: first ? first.hint : latest.say };
  };

  const paintList = (f: Framing): void => {
    $('[data-checks]').innerHTML = f.checks.map((c) => `<li class="${c.ok ? 'ok' : 'no'}">${VERDICT(c.ok)}<span>${c.label}</span></li>`).join('');
    $('[data-say]').textContent = f.say;
  };

  const draw = (lm: { x: number; y: number; v: number }[] | null, ready: boolean): void => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const unit = w / 220;
    // where the whole body should fit
    ctx.lineWidth = unit;
    ctx.setLineDash([unit * 5, unit * 4]);
    ctx.strokeStyle = ready ? GOOD : 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.roundRect(w * 0.22, h * 0.1, w * 0.56, h * 0.84, unit * 6);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!lm) return;
    ctx.strokeStyle = ready ? GOOD : '#ffffff';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineCap = 'round';
    ctx.lineWidth = unit * 1.6;
    for (const [a, b] of BONES) {
      if (lm[a].v < 0.4 || lm[b].v < 0.4) continue;
      ctx.beginPath();
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(lm[0].x * w, lm[0].y * h, unit * 3.2, 0, Math.PI * 2);
    ctx.fill();
  };

  let last = 0;
  let lastLight = 0;
  let light: number | undefined;
  const tick = (now: number): void => {
    if (closed) return;
    raf = requestAnimationFrame(tick);
    if (now - last < 130 || video.readyState < 2 || !pose) return;
    last = now;
    if (now - lastLight > 600) {
      light = brightness();
      lastLight = now;
    }
    const lm = pose.detect(video);
    const f = settled(checkFraming(lm, video.videoWidth / video.videoHeight, light));
    draw(lm, f.ready);
    paintList(f);
  };

  const start = async (): Promise<void> => {
    startBtn.hidden = true;
    stream?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(raf);
    recent.length = 0;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      stage(NO_CAMERA);
      return;
    }
    try {
      stage('Opening the camera...');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (closed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      view.style.setProperty('--ar', `${video.videoWidth} / ${video.videoHeight}`);
      view.classList.toggle('mirror', facing === 'user');
      flipBtn.hidden = false;
      if (!pose) {
        stage('Loading the body tracker...');
        pose = await createLivePose();
        if (closed) {
          pose.close();
          return;
        }
      }
      stage(null);
      raf = requestAnimationFrame(tick);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      stage(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Camera access was blocked. Allow the camera for this site in the browser settings, then try again.'
          : name === 'NotFoundError'
            ? 'No camera found on this device.'
            : e instanceof Error && e.message
              ? e.message
              : 'The camera could not be started.',
      );
      startBtn.textContent = 'Try again';
      startBtn.hidden = false;
    }
  };

  startBtn.onclick = () => void start();
  flipBtn.onclick = () => {
    facing = facing === 'user' ? 'environment' : 'user';
    void start();
  };
}
