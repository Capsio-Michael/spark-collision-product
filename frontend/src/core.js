import { matchesSpark } from './spark-model.js';

export const DIMENSIONS = [
  ['key_facts', '关键事实'], ['cognitive_breakthroughs', '认知突破'],
  ['hidden_constraints', '隐藏约束'], ['ai_operations', 'AI 运营空间'],
  ['reusable_opportunities', '复用机会'], ['validation_questions', '下一步验证'],
];
export const TYPE_LABELS = { fact: '事实', opinion: '观点', inference: '推断', hypothesis: '待验证假设' };
export const LIMITS = { perRecord: 20000, total: 60000, perBatch: 5, records: 10, bytes: 1048576 };
export const SOURCE_LABELS = { interview: '访谈', meeting: '会议', chat: '讨论', research: '调研', other: '其他' };
export const characterCount = value => Array.from(value).length;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function filterInsights(insights, query = '', filter = 'all', evidence = [], version) {
  const term = query.trim().toLocaleLowerCase();
  return insights.filter(insight => {
    const matches = `${insight.title} ${insight.judgment.text} ${insight.judgment.conditions.join(' ')}`.toLocaleLowerCase().includes(term);
    return matches && (['single', 'cross'].includes(filter) ? matchesSpark(insight, filter, evidence, version) : filter === 'all' || filter === 'changed' && insight.last_change.is_breakthrough
      || filter === 'disputed' && insight.dispute_status === 'open');
  });
}

export function validateDrafts(incoming, existing = []) {
  if (!incoming.length || incoming.length > LIMITS.perBatch) return '每次请导入 1–5 份材料。';
  if (incoming.length + existing.length > LIMITS.records) return '当前项目最多保存 10 份材料草稿。';
  for (const record of incoming) {
    if (!record.title.trim() || characterCount(record.title.trim()) > 120) return '材料标题需为 1–120 个字符。';
    if (!record.content.trim()) return '材料内容不能为空。';
    if (characterCount(record.content) > LIMITS.perRecord) return '每份材料最多 20,000 个字符，请拆分后导入。';
    if (!['synthetic', 'authorized'].includes(record.material_basis)) return '请选择合成材料或已获使用授权的材料。';
    if (record.material_basis === 'authorized' && !record.authorization_note?.trim()) return '请填写这份材料的使用授权说明。';
    if (record.authorization_note && characterCount(record.authorization_note) > 1000) return '授权说明最多 1,000 个字符。';
    if (!Object.hasOwn(SOURCE_LABELS, record.source_type)) return '请选择有效的材料类型。';
    if (record.meeting_id != null && (typeof record.meeting_id !== 'string' || characterCount(record.meeting_id.trim()) > 120)) return '所属会议标识最多 120 个字符；不确定时可以留空。';
    if (record.source_date) {
      const date = new Date(`${record.source_date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(record.source_date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== record.source_date) return '请填写有效的材料日期，或留空。';
    }
    if (record.source_name && characterCount(record.source_name) > 255) return '来源文件名最多 255 个字符。';
    if (!Array.isArray(record.participants) || record.participants.some(person => !person || typeof person.id !== 'string' || !person.id || typeof person.label !== 'string' || !person.label.trim() || characterCount(person.label) > 80)) return '参与者需有有效标识，名称最多 80 个字符；不确定时可以不填。';
    if (new Set(record.participants.map(person => person.id)).size !== record.participants.length) return '同一份材料不能重复添加相同参与者。';
  }
  const identities = new Map();
  for (const record of [...existing, ...incoming]) for (const person of record.participants || []) {
    if (identities.has(person.id) && identities.get(person.id) !== person.label) return '同一个参与者标识不能对应不同名称，请复用已有参与者或新建标识。';
    identities.set(person.id, person.label);
  }
  if ([...existing, ...incoming].reduce((count, record) => count + characterCount(record.content), 0) > LIMITS.total) return '项目材料总计最多 60,000 个字符。';
  if (new TextEncoder().encode(JSON.stringify({ records: incoming })).byteLength > LIMITS.bytes) return '本次材料超过 1 MiB，请分批导入。';
  return null;
}

export function readDrafts(storage) {
  try {
    const value = JSON.parse(storage.getItem('spark-collision:drafts:v1') || '[]');
    if (!Array.isArray(value) || value.length > LIMITS.records || value.some(item => !item || typeof item.client_record_id !== 'string' || typeof item.title !== 'string' || typeof item.content !== 'string' || !Object.hasOwn(SOURCE_LABELS, item.source_type) || !['synthetic', 'authorized'].includes(item.material_basis))) {
      return { records: [], error: '本地草稿格式异常。原存储尚未修改，请先备份浏览器数据。' };
    }
    return { records: value, error: null };
  } catch {
    return { records: [], error: '暂时无法读取本地草稿，请检查浏览器存储权限。' };
  }
}

export function saveDrafts(storage, records) {
  try { storage.setItem('spark-collision:drafts:v1', JSON.stringify(records)); return null; }
  catch { return '无法保存到浏览器。材料仍保留在输入框中，请复制备份后再试。'; }
}
