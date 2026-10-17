import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/api/client.js';

function fakeStream(parts) {
  return new Response(new ReadableStream({ start(controller) { for (const part of parts) controller.enqueue(new TextEncoder().encode(part)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('Kimi event stream assembles split events and preserves sent history', async () => {
  const old = globalThis.fetch;
  let sent;
  globalThis.fetch = async (_url, options) => { sent = JSON.parse(options.body); return fakeStream(['event: delta\ndata: {"text":"你', '好"}\n\nevent: delta\ndata: {"text":"！"}\n\nevent: done\ndata: {"characters":3}\n\n']); };
  try {
    const chunks = [];
    await createApiClient().chatStream([{ role: 'user', content: '你好' }], text => chunks.push(text));
    assert.deepEqual(chunks, ['你好', '！']);
    assert.deepEqual(sent.messages, [{ role: 'user', content: '你好' }]);
  } finally { globalThis.fetch = old; }
});

test('Kimi stream failure or missing completion is not treated as a reply', async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async () => fakeStream(['event: error\ndata: {"code":"UPSTREAM_NETWORK_ERROR","message":"暂时不可用"}\n\n']);
    await assert.rejects(createApiClient().chatStream([{ role: 'user', content: '你好' }], () => {}), error => error.code === 'UPSTREAM_NETWORK_ERROR');
    globalThis.fetch = async () => fakeStream(['event: delta\ndata: {"text":"未完成"}\n\n']);
    await assert.rejects(createApiClient().chatStream([{ role: 'user', content: '你好' }], () => {}), error => error.code === 'CHAT_INCOMPLETE');
  } finally { globalThis.fetch = old; }
});
