// Copies the MediaPipe WASM files and downloads the models (once) into public/.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(root, 'public', 'wasm');
if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log('WASM copied to public/wasm');
}

const base = 'https://storage.googleapis.com/mediapipe-models/';
const models = {
  'pose_landmarker_heavy.task': base + 'pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task',
  'efficientdet_lite2.tflite': base + 'object_detector/efficientdet_lite2/float32/latest/efficientdet_lite2.tflite',
};

// SKIP_MODELS=1 is for CI, where only the tests run and the 50 MB of models are not needed
for (const [name, url] of process.env.SKIP_MODELS ? [] : Object.entries(models)) {
  const dst = join(root, 'public', 'models', name);
  if (existsSync(dst)) continue;
  mkdirSync(dirname(dst), { recursive: true });
  console.log('Downloading', name);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.warn('Download failed:', e.message, '\nDownload manually from', url, 'to', dst);
  }
}
