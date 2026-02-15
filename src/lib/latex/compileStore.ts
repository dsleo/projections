import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type CompileEntry = {
  dir: string;
  pdfPath: string;
  synctexPath: string;
  inputName: string;
  inputPath: string;
  createdAt: number;
};

const TTL_MS = 1000 * 60 * 60; // 1 hour
const baseDir = path.join(os.tmpdir(), 'discourse-pipeline-tex');

async function ensureBaseDir() {
  await fs.mkdir(baseDir, { recursive: true }).catch(() => null);
}

async function cleanupExpired() {
  await ensureBaseDir();
  const entries = await fs.readdir(baseDir).catch(() => []);
  const now = Date.now();
  await Promise.all(
    entries.map(async (token) => {
      const metaPath = path.join(baseDir, token, 'meta.json');
      const metaRaw = await fs.readFile(metaPath, 'utf8').catch(() => null);
      if (!metaRaw) return;
      const meta = JSON.parse(metaRaw) as CompileEntry;
      if (now - meta.createdAt > TTL_MS) {
        await fs.rm(meta.dir, { recursive: true, force: true }).catch(() => null);
        await fs.rm(path.join(baseDir, token), { recursive: true, force: true }).catch(() => null);
      }
    })
  );
}

export async function saveCompilation(entry: Omit<CompileEntry, 'createdAt'>) {
  await cleanupExpired();
  const token = crypto.randomUUID();
  const tokenDir = path.join(baseDir, token);
  await fs.mkdir(tokenDir, { recursive: true });
  const meta: CompileEntry = {
    dir: entry.dir,
    pdfPath: entry.pdfPath,
    synctexPath: entry.synctexPath,
    inputName: entry.inputName,
    inputPath: entry.inputPath,
    createdAt: Date.now(),
  };
  await fs.writeFile(path.join(tokenDir, 'meta.json'), JSON.stringify(meta), 'utf8');
  return token;
}

export async function getCompilation(token: string) {
  await cleanupExpired();
  const metaPath = path.join(baseDir, token, 'meta.json');
  const metaRaw = await fs.readFile(metaPath, 'utf8').catch(() => null);
  if (!metaRaw) return null;
  return JSON.parse(metaRaw) as CompileEntry;
}

export async function deleteCompilation(token: string) {
  const metaPath = path.join(baseDir, token, 'meta.json');
  const metaRaw = await fs.readFile(metaPath, 'utf8').catch(() => null);
  if (metaRaw) {
    const meta = JSON.parse(metaRaw) as CompileEntry;
    await fs.rm(meta.dir, { recursive: true, force: true }).catch(() => null);
  }
  await fs.rm(path.join(baseDir, token), { recursive: true, force: true }).catch(() => null);
}
