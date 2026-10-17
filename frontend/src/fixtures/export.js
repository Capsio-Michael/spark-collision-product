import { DIMENSIONS, TYPE_LABELS, SOURCE_LABELS } from '../core.js';
import { demoHistorySource } from './history.js';
import { insightMetrics } from '../insight-metrics.js';
import { meetingEvidence } from '../meeting-evidence-model.js';
import { RELATION_LABELS } from '../insight-detail-model.js';

const array = value => Array.isArray(value) ? value : [];
// Text is quoted as Markdown data, never treated as report structure or HTML.
const md = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#!|~]/g, '\\$&');
const text = value => md(value || '待补充');
const bullet = (values, fallback = '未提供；不表示已排除或核实。') => array(values).length ? values.map(value => `- ${md(value)}`).join('\n') : `- ${fallback}`;
const type = value => TYPE_LABELS[value] || '类型待确认';
const review = value => value === 'confirmed' ? '已确认判断（不等于批准行动）' : '待核查';

// This serializer is exclusively for the authored synthetic example. Real
// projects download the engine's report and never use these fixtures as filler.
export async function buildSyntheticReport(version, { source = demoHistorySource, now = () => new Date() } = {}) {
  const versions = array((await source.loadVersions()).items).filter(item => item.version <= version).sort((a, b) => a.version - b.version);
  if (!Number.isInteger(version) || version < 1 || !versions.some(item => item.version === version)) throw new Error('合成示例没有这个版本。');
  const snapshots = await Promise.all(versions.map(async item => {
    const overview = await source.loadOverview(item.version);
    if (overview.snapshot_version !== item.version || overview.project.id !== source.projectId) throw new Error('合成快照不匹配。');
    const details = await Promise.all(overview.insights.map(insight => source.loadDetail(insight.id, item.version)));
    if (details.some((detail, index) => detail.snapshot_version !== item.version || detail.id !== overview.insights[index].id)) throw new Error('合成详情版本不匹配。');
    return { version: item, overview, details };
  }));
  const current = snapshots.at(-1), overview = current.overview;
  const recordIds = [...new Set(snapshots.flatMap(item => item.overview.source_record_ids))];
  const records = new Map(await Promise.all(recordIds.map(async id => {
    const record = await source.loadRecord(id);
    if (record.id !== id) throw new Error('合成引用来源不匹配。');
    return [id, record];
  })));
  const catalog = new Map();
  for (const snapshot of snapshots) for (const evidence of [...array(snapshot.overview.evidence), ...snapshot.details.flatMap(item => array(item.evidence))]) {
    const record = records.get(evidence.record_id), segment = record?.segments.find(item => item.id === evidence.segment_id);
    if (!snapshot.overview.source_record_ids.includes(evidence.record_id) || !segment || typeof evidence.quote !== 'string' || !evidence.quote || !segment.text.includes(evidence.quote)) throw new Error('合成引用无法与所选版本的原文核对，未生成报告。');
    const previous = catalog.get(evidence.id);
    if (previous && (previous.quote !== evidence.quote || previous.record_id !== evidence.record_id || previous.segment_id !== evidence.segment_id)) throw new Error('引用身份发生冲突。');
    catalog.set(evidence.id, evidence);
  }
  const refs = ids => array(ids).length ? ids.map(id => {
    const evidence = catalog.get(id);
    if (!evidence) throw new Error('引用缺失，未生成报告。');
    return md(evidence.label || id);
  }).join('、') : '未提供引用；需补齐证据。';
  function block(value) {
    if (!value) return '未提供。\n';
    return `**${type(value.epistemic_type)}**：${text(value.text)}\n\n依据：${refs(value.evidence_ids)}\n\n适用条件：\n${bullet(value.conditions, '条件待确认。')}\n\n其他解释：\n${bullet(value.alternative_explanations)}\n\n证据缺口：\n${bullet(value.gaps, '未列出，不代表已经充分验证。')}\n`;
  }
  function judgment(value) {
    if (!value) return '未提供。\n';
    return `**${type(value.epistemic_type)} · ${review(value.review_status)}**\n\n${text(value.text)}\n\n${value.epistemic_type === 'fact' ? `事实依据性质：${value.fact_basis === 'recorded_statement' ? '材料记录的说法，不等于陈述已获外部核实' : value.fact_basis === 'corroborated' ? '已核实，具体依据见引用与推理' : '尚未明确'}\n\n` : ''}适用条件：\n${bullet(value.conditions, '条件待确认。')}\n\n引用：${refs(value.evidence_ids)}\n\n推理依据：${text(value.rationale)}\n\n其他可能解释：\n${bullet(value.alternative_explanations)}\n\n证据缺口：\n${bullet(value.evidence_gaps, '未列出，不代表已经充分验证。')}\n`;
  }
  const lines = [
    `# ${md(overview.project.name)} · 分析报告`,
    '> 合成案例：预设材料与模拟结果，用于交互演示。不是实际客户结论或真实模型运行记录。',
    `导出时间：${now().toISOString()}  \n项目：${md(source.projectId)}  \n快照版本：v${version}  \n本版材料范围：${overview.source_record_ids.length} 份  \n格式：UTF-8 Markdown`,
    '本报告按指定快照导出，仅包含截至该版本的信息。事实、观点、推断和待验证假设分别标明；确认判断不等于批准行动。',
    '## 一、材料与覆盖范围',
    overview.source_record_ids.map(id => {
      const record = records.get(id);
      return `- **${md(record.title)}**（${md(id)}）\n  - 来源：${md(record.source_name || '未提供')}；类型：${md(SOURCE_LABELS[record.source_type] || '其他')}；日期：${md(record.source_date || '日期未提供')}\n  - 使用依据：${record.material_basis === 'synthetic' ? '合成材料' : '已获授权'}；${md(record.authorization_note || '合成示例不对应真实客户。')}`;
    }).join('\n'),
    '## 二、分析简报', text(overview.summary),
    `结果：${{ updated: '有更新', no_new_insight: '本次无新火花', insufficient_evidence: '证据不足' }[overview.outcome] || '待核查'}。下文保留支持条件、替代解释与证据缺口。`,
    '## 三、六个分析视角',
  ];
  for (const [key, label] of DIMENSIONS) {
    const dimension = overview.dimensions.find(item => item.key === key);
    lines.push(`### ${label}`, `覆盖状态：${{ available: '已提供分析，仍需结合证据与缺口理解', insufficient_evidence: '证据不足', not_applicable: '本次不适用' }[dimension?.status] || '尚未提供'}`);
    for (const finding of array(dimension?.findings)) {
      lines.push(`#### ${md(finding.title)}`, block(finding.body));
      for (const section of array(finding.sections)) lines.push(`**${md(section.label)}**`, block(section.body));
    }
    lines.push('本视角缺口：', bullet(dimension?.gaps, '未列出，不代表已完成系统建设或充分验证。'));
  }
  lines.push('## 四、关注点、当前判断与认知碰撞卡');
  for (const detail of current.details) {
    lines.push(`### ${md(detail.title)}`, '#### 当前有效判断', judgment(detail.judgment));
    const metrics = insightMetrics(detail);
    lines.push(`会议覆盖：${md(metrics.meetings.value)}。${md(metrics.meetings.note)}`, `${md(metrics.priority.label)}：${md(metrics.priority.value)}。${md(metrics.priority.note)}`, `趋同程度：${md(metrics.convergence.value)}。${md(metrics.convergence.note)}`);
    if (metrics.priority.rule) lines.push(`演示规则 ${md(metrics.priority.rule)}：${metrics.priority.parts.map(part => `${md(part.label)} ${part.points} 分（${md(part.basis)}）`).join('；')}。`);
    const meetings = meetingEvidence(detail);
    lines.push('#### 按会议核查证据标注', '标注描述分析关系；适用条件未注明不代表无条件成立。');
    lines.push(...meetings.issues.map(issue => md(issue)));
    for (const group of meetings.groups) {
      lines.push(`##### ${md(group.meetingId || '场次待补齐')}`);
      for (const entry of group.entries) lines.push(`- ${refs([entry.evidence.id])}：${entry.links.map(link => `${md(RELATION_LABELS[link.relation] || '关系待确认')}；适用条件：${md(link.condition || '未注明')}`).join(' / ')}${entry.repeated ? '；重复印证，非新火花' : ''}。${entry.notes.map(md).join(' ')}\n  原话：${md(entry.evidence.quote)}`);
    }
    if (detail.candidate_judgment) lines.push('#### 待确认候选（未替换当前判断）', judgment(detail.candidate_judgment));
    lines.push(`分歧状态：${detail.dispute_status === 'open' ? '尚未解决' : '本版未标记开放分歧'}。`);
    const card = detail.collision_card;
    if (card) {
      lines.push(`#### A · 原有认知${card.prior_origin === 'analysis_premise' ? '（分析前提，非原话）' : ''}`, block(card.prior), '#### B · 现场冲击', block(card.shock), '#### C · 新框架', block(card.new_frame), '#### D · 高阶判断（推断）', block(card.implication), '#### V · 验证动作', `关联验证项：${array(card.validation_ids).map(md).join('、') || '待补充'}；具体方案见“最小验证建议”。`);
    } else lines.push('本版没有提供完整认知碰撞卡，作为关键事实／待验证机会保留，不补造认知突破。');
  }
  lines.push('## 五、截至本版的判断历史');
  for (const snapshot of snapshots) {
    lines.push(`### v${snapshot.version.version} · ${md(snapshot.version.created_at)} · ${snapshot.version.cause === 'correction' ? '用户纠错／确认' : '材料分析'}`, text(snapshot.overview.summary));
    if (snapshot.version.correction_reason) lines.push(`纠错理由：${md(snapshot.version.correction_reason)}；记录者：${md(snapshot.version.actor_label || '未提供')}`);
    for (const detail of snapshot.details) {
      lines.push(`#### ${md(detail.title)}`, judgment(detail.judgment));
      if (detail.candidate_judgment) lines.push('该版待确认候选（未采纳）：', judgment(detail.candidate_judgment));
    }
    for (const change of array(snapshot.version.changes)) lines.push(`- 变化记录：${md(change.reason)}；依据：${refs(change.evidence_ids)}；${change.is_breakthrough ? '分析记录标记为认知变化' : '未标为认知突破'}。`);
  }
  lines.push('## 六、未解决分歧与证据缺口');
  const disputed = current.details.filter(item => item.dispute_status === 'open');
  lines.push(disputed.length ? disputed.map(item => `- **${md(item.title)}**：${md(item.candidate_judgment?.text || '候选详情尚未提供')}；保留当前判断，尚未采纳候选。`).join('\n') : '本版未标记开放分歧，不代表所有判断已获核实。');
  for (const detail of current.details) lines.push(`**${md(detail.title)}**`, bullet(detail.judgment.evidence_gaps, '未列出具体缺口，不表示已经充分验证。'));
  lines.push('## 七、最小验证建议', '以下仅为验证建议，不产生客户联系、已批准行动或外部执行任务。');
  const validations = [...new Map(current.details.flatMap(item => array(item.validations)).map(item => [item.id, item])).values()];
  for (const item of validations) lines.push(`### ${md(item.question)}（${md(item.id)}）`, `- 为什么影响决策：${text(item.decision_impact)}\n- 所需材料：${array(item.required_materials).map(md).join('；') || '待补充'}\n- 核对角色：${array(item.interview_roles).map(md).join('；') || '待确认'}\n- 最小实验：${text(item.experiment)}\n- 支持判据：${text(item.success_criteria)}\n- 推翻判据：${text(item.failure_criteria)}\n- 负责人：${md(item.owner || '待指定')}\n- 时间：${md(item.due_at || '待商定')}\n- 准备方式：${{ customer_preparation: '客户提前准备', joint_walkthrough: '现场共同走查', internal_research: '内部研究' }[item.workstream] || '待确认'}\n- 后续决定：${text(item.next_decision)}\n- 依据：${refs(item.evidence_ids)}\n- 状态：验证建议（尚未批准执行）`);
  if (!validations.length) lines.push('本版尚未提供可执行的最小验证方案，需补齐实验与支持／推翻判据。');
  lines.push('## 八、原文引用与离线定位', '以下保留可独立阅读的文件／来源名、记录与段落编号；无需网页链接即可核对位置。');
  for (const evidence of catalog.values()) {
    const record = records.get(evidence.record_id), segment = record.segments.find(item => item.id === evidence.segment_id);
    const speaker = record.participants?.find(item => item.id === evidence.speaker_id);
    lines.push(`### ${md(evidence.label || evidence.id)} · ${md(record.title)}`, `来源：${md(record.source_name || '未提供')}；日期：${md(record.source_date || '未提供')}  \n记录：${md(record.id)}；段落：${segment.paragraph_index}；片段：${md(segment.id)}  \n发言身份：${md(speaker?.label || '身份未提供')}；提问方式：${{ spontaneous: '主动提起', prompted: '被问回应' }[evidence.elicitation] || '未知'}`, evidence.quote.split(/\r?\n/).map(line => `> ${md(line)}`).join('\n'));
  }
  return { text: `${lines.join('\n\n')}\n`, filename: `spark-collision-synthetic-v${version}.md`, version };
}

export const demoExportSource = { ...demoHistorySource, loadExport: version => buildSyntheticReport(version) };
