// One place to find ffmpeg for the video scripts (capture/recorder.mjs, vo.mjs, track.mjs, music.mjs).
// Order: $FFMPEG, then the copy bundled with Remotion for this machine (npm installs exactly one of its
// @remotion/compositor-<platform>-<arch>[-libc] packages: darwin-arm64/x64, linux-arm64/x64 gnu/musl, win32-x64-msvc),
// then an ffmpeg on the PATH. The bundled one loads libraries from its own folder, so that folder goes on the library
// path the way Remotion itself runs it.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

let found = null;
export function ffmpeg() {
  if (found) return found;
  if (process.env.FFMPEG) return (found = { bin: process.env.FFMPEG, env: {} });
  const scope = path.join(HERE, 'node_modules/@remotion');
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const prefix = `compositor-${process.platform}-${process.arch}`;
  const dirs = fs.existsSync(scope) ? fs.readdirSync(scope).filter((d) => d === prefix || d.startsWith(prefix + '-')) : [];
  for (const d of dirs) {
    const dir = path.join(scope, d), bin = path.join(dir, exe);
    if (!fs.existsSync(bin)) continue;
    const libVar = process.platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : process.platform === 'linux' ? 'LD_LIBRARY_PATH' : null;
    const env = libVar ? { [libVar]: [dir, process.env[libVar]].filter(Boolean).join(path.delimiter) } : {};
    return (found = { bin, env });
  }
  return (found = { bin: 'ffmpeg', env: {} });
}

// execFileSync for ffmpeg, with a clear message when none can be found
export function runFf(args, opts = {}) {
  const { bin, env } = ffmpeg();
  try {
    return execFileSync(bin, args, { ...opts, env: { ...process.env, ...env, ...(opts.env || {}) } });
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`No ffmpeg found. Run npm install in video/ (Remotion brings one for ${process.platform}-${process.arch}), install ffmpeg, or set FFMPEG to its path.`);
    throw e;
  }
}
