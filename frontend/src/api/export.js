import { ApiError } from './client.js';

export function markdownFilename(disposition, version) {
  const fallback = `spark-collision-v${version}.md`;
  let name;
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition || '');
  if (encoded) { try { name = decodeURIComponent(encoded[1].trim()); } catch { /* Use the ordinary filename or fallback. */ } }
  if (!name) name = /filename\s*=\s*"([^"]+)"/i.exec(disposition || '')?.[1] || /filename\s*=\s*([^;]+)/i.exec(disposition || '')?.[1]?.trim();
  if (!name) return fallback;
  name = name.replace(/[\u0000-\u001f\u007f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069<>:"/\\|?*]/g, '_').trim().replace(/^\.+/, '');
  if (!/\.md$/i.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(name) || name.length > 160) return fallback;
  return name;
}

// A file response has a different protocol from the JSON API. Never send it
// through request().json(), nor download an error document as if it were a report.
export function createMarkdownExporter(baseUrl, fetchFile = (...args) => fetch(...args)) {
  const base = baseUrl.replace(/\/$/, '');
  return async (projectId, version, signal) => {
    if (!Number.isInteger(version) || version < 1) throw new Error('请先选择已生成的分析版本。');
    const url = new URL(`${base}/projects/${encodeURIComponent(projectId)}/export`);
    url.searchParams.set('format', 'markdown'); url.searchParams.set('version', String(version));
    const timeout = AbortSignal.timeout(30000);
    let response;
    try {
      response = await fetchFile(url, { method: 'GET', headers: { Accept: 'text/markdown' }, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiError(timeout.aborted ? '导出等待超时，可以重试所选版本。' : '无法下载报告，请检查引擎连接后重试。', 'NETWORK_ERROR', null, 0, true);
    }
    if (!response.ok) {
      let payload;
      try { payload = await response.json(); } catch { /* Keep the HTTP failure even if a proxy returns HTML. */ }
      throw new ApiError(payload?.error?.message || `导出失败（HTTP ${response.status}），没有下载文件。`, payload?.error?.code || 'EXPORT_FAILED', payload?.request_id, response.status, payload?.error?.retryable ?? false, payload?.error?.details ?? {});
    }
    const type = response.headers.get('Content-Type') || '';
    const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(type)?.[1];
    if (!/^text\/markdown(?:\s*;|\s*$)/i.test(type) || charset && charset.toLowerCase() !== 'utf-8') throw new ApiError('服务未返回 UTF-8 Markdown 文件，未下载异常响应。', 'RESPONSE_INVALID', null, response.status);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(await response.arrayBuffer()); }
    catch { throw new ApiError('报告读取失败或编码不是有效的 UTF-8，请重试。', 'RESPONSE_INVALID', null, response.status, true); }
    let jsonDocument = false;
    if (/^\s*[\[{]/.test(text)) { try { JSON.parse(text); jsonDocument = true; } catch { /* A normal Markdown link or checklist may start with [. */ } }
    if (!text.trim() || /^\s*(?:<!doctype\s+html|<html\b)/i.test(text) || jsonDocument) throw new ApiError('导出返回了空文件或错误页面，未下载。', 'RESPONSE_INVALID', null, response.status);
    return { text, filename: markdownFilename(response.headers.get('Content-Disposition'), version), version };
  };
}
