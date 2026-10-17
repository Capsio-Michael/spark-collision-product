/** HTTP adapter for docs/api-contract.md. The first homepage uses explicit fixtures. */
export class ApiError extends Error {
  constructor(message, code, requestId, status, retryable = false, details = {}) {
    super(message); this.name = 'ApiError'; this.code = code; this.requestId = requestId; this.status = status;
    this.retryable = retryable; this.details = details;
  }
}

export function createApiClient(baseUrl = 'http://127.0.0.1:8000/api/v1') {
  const base = baseUrl.replace(/\/$/, '');
  const segment = value => encodeURIComponent(value);
  async function request(path, { method = 'GET', body, idempotencyKey, version } = {}) {
    const url = new URL(`${base}${path}`);
    if (version !== undefined) url.searchParams.set('version', String(version));
    if (method === 'POST' && !idempotencyKey) throw new Error('POST 必须显式传入可在重试时复用的幂等 key。');
    let response;
    try { response = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    }); } catch (error) {
      throw new ApiError(error.name === 'TimeoutError' ? '请求等待超时，处理结果尚未确认。请使用原请求重试。' : '无法连接引擎，请确认服务已启动、地址正确，并允许当前页面跨域访问。', 'NETWORK_ERROR', null, 0, true);
    }
    let payload;
    try { payload = await response.json(); }
    catch { throw new ApiError('服务返回的内容不是有效 JSON，请检查接口地址。', 'RESPONSE_INVALID', null, response.status, true); }
    if (!response.ok) throw new ApiError(payload.error?.message || '请求失败', payload.error?.code || 'UNKNOWN_ERROR', payload.request_id, response.status, payload.error?.retryable ?? false, payload.error?.details ?? {});
    return payload.data;
  }
  const project = id => `/projects/${segment(id)}`;
  return {
    health: () => request('/health'),
    projects: () => request('/projects'),
    createProject: (body, key) => request('/projects', { method: 'POST', body, idempotencyKey: key }),
    records: id => request(`${project(id)}/records`),
    record: (id, recordId) => request(`${project(id)}/records/${segment(recordId)}`),
    importRecords: (id, records, key) => request(`${project(id)}/records`, { method: 'POST', body: { records }, idempotencyKey: key }),
    analyze: (id, body, key) => request(`${project(id)}/analyses`, { method: 'POST', body, idempotencyKey: key }),
    job: (id, jobId) => request(`${project(id)}/jobs/${segment(jobId)}`),
    overview: (id, version) => request(`${project(id)}/overview`, { version }),
    insight: (id, insightId, version) => request(`${project(id)}/insights/${segment(insightId)}`, { version }),
    versions: id => request(`${project(id)}/versions`),
    correct: (id, body, key) => request(`${project(id)}/corrections`, { method: 'POST', body, idempotencyKey: key }),
  };
}
