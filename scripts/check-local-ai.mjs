#!/usr/bin/env node

const API = process.env.API_URL ?? 'http://localhost:3000';
const OLLAMA = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text';

const results = [];
async function check(label, action) {
  try {
    results.push({ ok: true, label, detail: await action() });
  } catch (error) {
    results.push({ ok: false, label, detail: error instanceof Error ? error.message : String(error) });
  }
}

await check('API /health', async () => {
  const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.db !== 'ok') throw new Error(`db=${body.db}`);
  return JSON.stringify(body);
});

let installedModels = [];
await check('Ollama reachable', async () => {
  const response = await fetch(`${OLLAMA.replace(/\/+$/, '')}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  installedModels = Array.isArray(body.models) ? body.models.map((model) => model.name).filter(Boolean) : [];
  if (!installedModels.length) throw new Error('no models installed — run: ollama pull qwen2.5');
  return installedModels.join(', ');
});

await check('Embedding model present', async () => {
  if (!installedModels.some((name) => name === EMBEDDING_MODEL || name.startsWith(`${EMBEDDING_MODEL}:`))) {
    throw new Error(`missing ${EMBEDDING_MODEL} — generation works, RAG will not`);
  }
  return EMBEDDING_MODEL;
});

for (const { ok, label, detail } of results) {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label.padEnd(24)} ${detail}`);
}
process.exitCode = results.every((result) => result.ok) ? 0 : 1;
