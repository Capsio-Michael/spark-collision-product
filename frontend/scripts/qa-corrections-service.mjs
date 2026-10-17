// Browser QA fixture only: synthetic in-memory data, no model and no production persistence.
// Run explicitly with node scripts/qa-corrections-service.mjs; type quit on stdin to stop.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoInsights, demoOverview, demoRecords } from '../src/fixtures/demo.js';
import { getDemoInsightDetail } from '../src/fixtures/insight-details.js';

const projectId = 'prj_corrections_browser_qa';
const snapshots = new Map(); const requests = new Map(); let current = 2;
const root = fileURLToPath(new URL('../', import.meta.url));
const initial = structuredClone(demoOverview); initial.project.id = projectId;
initial.project.name = '纠错交互验收 · 合成服务';
snapshots.set(2, { overview: initial, details: new Map(demoInsights.map(item => [item.id, getDemoInsightDetail(item.id)])) });
const versionLog = [];
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const server = http.createServer(async (req, res) => {
  const allowed = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
  if (allowed.has(req.headers.origin)) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const respond = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && !url.pathname.startsWith('/api/v1/')) {
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const target = path.resolve(root, relative); const resolved = path.relative(root, target);
      if (resolved.startsWith('..') || path.isAbsolute(resolved) || !['index.html', 'favicon.svg'].includes(relative) && !relative.startsWith('src/')) throw fail(404, 'NOT_FOUND', '没有该验收资源');
      const bytes = await readFile(target);
      res.writeHead(200, { 'Content-Type': `${{ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' }[path.extname(target)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' }); res.end(bytes); return;
    }
    const apiPath = url.pathname.replace('/api/v1', '');
    let data;
    if (req.method === 'GET' && apiPath === '/health') data = { status: 'ok', api_version: '0.1', engine_mode: 'mock', model_configured: false };
    else if (req.method === 'GET' && apiPath === '/projects') data = { items: [snapshots.get(current).overview.project] };
    else {
      if (!apiPath.startsWith(`/projects/${projectId}/`)) throw fail(404, 'PROJECT_NOT_FOUND', '仅提供独立的合成验收项目。');
      const route = apiPath.slice(`/projects/${projectId}`.length);
      const version = Number(url.searchParams.get('version') || current); const snapshot = snapshots.get(version);
      if (req.method === 'GET' && route === '/records') data = { items: demoRecords };
      else if (req.method === 'GET' && route.startsWith('/records/')) data = demoRecords.find(item => item.id === route.slice('/records/'.length));
      else if (req.method === 'GET' && route === '/versions') data = { items: versionLog };
      else if (req.method === 'GET' && route === '/overview' && snapshot) {
        data = structuredClone(snapshot.overview); data.project.current_version = current;
      } else if (req.method === 'GET' && route.startsWith('/insights/') && snapshot) data = snapshot.details.get(route.slice('/insights/'.length));
      else if (req.method === 'POST' && route === '/corrections') {
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 65536) throw fail(413, 'PAYLOAD_TOO_LARGE', '验收请求过大'); }
        const body = JSON.parse(raw); const key = req.headers['idempotency-key'];
        if (!key) throw fail(422, 'VALIDATION_ERROR', '需要幂等标识');
        const previous = requests.get(key);
        if (previous) {
          if (previous.raw !== raw) throw fail(409, 'IDEMPOTENCY_CONFLICT', '原请求内容发生变化');
          data = previous.receipt;
        } else {
          if (body.expected_version !== current) throw fail(409, 'VERSION_CONFLICT', '合成项目已有新版本');
          const old = snapshots.get(current); const original = old.details.get(body.insight_id);
          if (!original || body.expected_judgment_id !== original.judgment.id) throw fail(409, 'VERSION_CONFLICT', '判断已变化');
          const details = structuredClone(old.details); const detail = details.get(body.insight_id);
          const oldId = detail.judgment.id; const candidateId = detail.candidate_judgment?.id || null;
          if (!body.actor_label || !body.reason) throw fail(422, 'VALIDATION_ERROR', '称呼和理由必填');
          if (detail.dispute_status === 'open') {
            if (!['accept_candidate', 'reject_candidate'].includes(body.action) || body.candidate_judgment_id !== candidateId) throw fail(409, 'CANDIDATE_CONFLICT', '候选状态不同');
            if (body.action === 'accept_candidate') detail.judgment = { ...detail.candidate_judgment, review_status: 'confirmed' };
            detail.candidate_judgment = null; detail.dispute_status = 'none';
          } else if (body.action === 'confirm_current') {
            if (detail.judgment.review_status === 'confirmed') throw fail(409, 'ALREADY_CONFIRMED', '已确认');
            detail.judgment.review_status = 'confirmed';
          } else if (body.action === 'edit_current' && body.replacement) detail.judgment = { ...body.replacement, id: `qa_judgment_${current + 1}`, review_status: 'confirmed' };
          else throw fail(422, 'VALIDATION_ERROR', '操作不支持');
          const receipt = { id: `qa_correction_${current + 1}`, insight_id: body.insight_id, action: body.action,
            actor_label: body.actor_label, reason: body.reason, previous_version: current, result_version: current + 1, created_at: new Date().toISOString() };
          const overview = structuredClone(old.overview); current++;
          for (const item of details.values()) item.snapshot_version = current;
          detail.last_change = { insight_id: detail.id, type: body.action === 'edit_current' || body.action === 'accept_candidate' ? 'revised' : 'unchanged', reason: body.reason,
            evidence_ids: detail.judgment.evidence_ids, previous_judgment_id: oldId, current_judgment_id: detail.judgment.id, candidate_judgment_id: null, is_breakthrough: false };
          overview.project.current_version = current; overview.snapshot_version = current;
          overview.insights = [...details.values()]; overview.changes = [detail.last_change]; overview.pending_confirmation_count = [...details.values()].filter(item => item.dispute_status === 'open').length;
          snapshots.set(current, { overview, details });
          versionLog.unshift({ version: current, parent_version: current - 1, created_at: receipt.created_at, cause: 'correction', job_id: null, correction_id: receipt.id,
            source_record_ids: overview.source_record_ids, outcome: 'updated', summary: `合成服务：${body.action}`, changes: overview.changes, actor_label: body.actor_label, correction_reason: body.reason });
          requests.set(key, { raw, receipt }); data = receipt;
        }
      }
      if (!data) throw fail(404, 'NOT_FOUND', '没有该验收资源');
    }
    respond(req.method === 'POST' ? 201 : 200, { data, request_id: 'qa-only' });
  } catch (failure) { respond(failure.status || 500, { error: { code: failure.code || 'QA_SERVICE_ERROR', message: failure.message, retryable: false, details: {} }, request_id: 'qa-only' }); }
});
server.on('error', failure => { process.stderr.write(`${failure.message}\n`); process.exitCode = 1; process.stdin.pause(); });
server.listen(Number(process.env.QA_CORRECTIONS_PORT || 8073), '127.0.0.1', () => process.stdout.write('QA ONLY · synthetic in-memory corrections service · http://127.0.0.1:8073/api/v1 · type quit to stop\n'));
process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { if (chunk.trim() === 'quit') server.close(() => { process.stdin.pause(); }); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.stdin.pause()));
