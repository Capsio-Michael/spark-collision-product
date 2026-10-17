import { icon } from './icons.js';
import { SOURCE_LABELS, characterCount, escapeHtml as e } from './core.js';

export function materialRows(workflow) {
  const { drafts, submissions, server_records, active_job } = workflow.state;
  const rows = drafts.map(draft => ({ draft, server: server_records.find(record => record.id === submissions[draft.client_record_id]) || null }));
  const linked = new Set(Object.values(submissions));
  rows.push(...server_records.filter(record => !linked.has(record.id)).map(server => ({ draft: null, server })));
  return rows.map(row => {
    const data = row.server || row.draft;
    const id = row.draft?.client_record_id || row.server.id;
    const analyzing = row.server && active_job?.source_record_ids?.includes(row.server.id) && !row.server.covered_in_current_version;
    const uncertain = row.draft && workflow.lockedIds.has(row.draft.client_record_id);
    return {
      ...row, id, data,
      status: row.server?.covered_in_current_version ? 'analyzed' : analyzing ? 'analyzing' : row.server ? 'saved' : uncertain ? 'uncertain' : 'draft',
      editable: !!row.draft && workflow.isEditable(id),
    };
  });
}
const labels = { draft: '本地草稿', uncertain: '提交结果待确认', saved: '已保存，待分析', analyzing: '正在分析', analyzed: '已分析' };
export function renderOwnMaterials(workflow, selection) {
  const rows = materialRows(workflow);
  const local = rows.filter(row => row.status === 'draft').length;
  const waiting = rows.filter(row => row.status === 'saved').length;
  const analyzed = rows.filter(row => row.status === 'analyzed').length;
  const pending = workflow.state.pending;
  return `<section class="material-stats"><div><strong>${rows.length}</strong><span>全部材料</span></div><div><strong>${local}</strong><span>本地草稿</span></div><div><strong>${waiting}</strong><span>已保存，待分析</span></div><div><strong>${analyzed}</strong><span>已分析</span></div></section>
    <div class="engine-banner ${workflow.connected ? 'engine-connected' : ''}"><span class="engine-banner-symbol">${icon(workflow.connected ? 'check' : 'info')}</span><div><strong>${workflow.connected ? `引擎已连接${workflow.health?.engine_mode === 'mock' ? ' · 模拟服务' : ''}` : '尚未连接引擎'}</strong><p>${workflow.connected ? e(workflow.state.base_url) : '草稿可以继续编辑；连接后再提交和分析。'}</p></div><button class="button secondary" data-action="connect">${workflow.connected ? '检查连接' : '连接引擎'}</button></div>
    ${workflow.error ? `<div class="alert" role="alert">${e(workflow.error)}</div>` : ''}
    ${renderJob(workflow)}
    ${pending.import || pending.project ? `<div class="pending-notice">${icon('clock')}<div><strong>上次提交结果尚未确认</strong><p>相关材料已锁定。重试会复用原请求标识，避免重复创建。</p></div><button class="button secondary" data-action="retry-import" ${!workflow.connected || workflow.busy ? 'disabled' : ''}>重试上次提交</button></div>` : ''}
    ${pending.analysis ? `<div class="pending-notice">${icon('clock')}<div><strong>分析请求结果待确认</strong><p>这里只重发原请求，不会创建第二次分析。</p></div><button class="button secondary" data-action="retry-analysis" ${!workflow.connected || workflow.busy ? 'disabled' : ''}>重试原分析请求</button></div>` : ''}
    <section class="panel materials-panel"><div class="section-heading"><div><h2>项目材料 <span class="heading-count">${rows.length}</span></h2><p>草稿保存在本地，已提交原文按接口规则保持不变。</p></div><button class="text-button" data-action="import">${icon('plus')}导入材料</button></div>
    <div class="materials-toolbar"><label class="select-all"><input type="checkbox" id="select-all-materials" ${rows.filter(row => row.status === 'draft' || row.status === 'saved').length && rows.filter(row => row.status === 'draft' || row.status === 'saved').every(row => selection.has(row.id)) ? 'checked' : ''}>选择可操作材料</label><span id="selection-summary">已选 ${rows.filter(row => selection.has(row.id)).length} 份</span><div class="material-toolbar-actions"><button class="button secondary" data-action="submit-selected" ${!workflow.connected || workflow.busy || pending.import || pending.project || !rows.some(row => row.status === 'draft' && selection.has(row.id)) ? 'disabled' : ''}>提交草稿</button><button class="button primary" data-action="analyze-selected" ${!workflow.connected || workflow.busy || workflow.state.active_job || pending.analysis || !rows.some(row => row.status === 'saved' && selection.has(row.id)) ? 'disabled' : ''}>${icon('spark')}开始分析</button></div></div>
    ${rows.length ? `<div class="material-list">${rows.map(row => `<article class="material-row detailed-material-row"><label class="material-check"><input type="checkbox" data-material-select="${e(row.id)}" ${selection.has(row.id) ? 'checked' : ''} ${!['draft', 'saved'].includes(row.status) ? 'disabled' : ''} aria-label="选择材料：${e(row.data.title)}"></label><span class="material-symbol">${icon('file')}</span><div class="material-info"><button class="material-title" ${row.draft ? `data-draft-id="${e(row.id)}"` : `data-server-record="${e(row.server.id)}"`}>${e(row.data.title)}</button><p>${e(SOURCE_LABELS[row.data.source_type] || '材料')}<span>·</span>${e(row.data.source_date || '日期未提供')}<span>·</span>${row.draft ? `${characterCount(row.draft.content).toLocaleString()} 字符` : '服务端记录'}</p><div class="material-extra">${row.draft ? (row.draft.participants?.length ? `${row.draft.participants.length} 位已标识参与者` : '参与者未填写') : '参与者信息见原文'}<span>·</span>${row.data.material_basis === 'synthetic' ? '合成材料' : '已获授权'}</div></div><span class="record-status status-${row.status}">${icon(row.status === 'analyzed' ? 'check' : 'clock')}${labels[row.status]}</span><div class="material-row-actions">${row.editable ? `<button class="text-button" data-edit-draft="${e(row.id)}">编辑</button><button class="text-button muted-button" data-remove-draft="${e(row.id)}">移除</button>` : `<button class="text-button" ${row.draft ? `data-draft-id="${e(row.id)}"` : `data-server-record="${e(row.server.id)}"`}>查看原文</button>`}</div></article>`).join('')}</div>` : `<div class="materials-empty">${icon('file')}<h3>还没有材料</h3><p>先导入一份访谈、讨论或调研记录。</p><button class="button primary" data-action="import">导入第一份材料</button></div>`}
    ${workflow.state.removed_drafts.length ? `<div class="undo-material">${icon('history')}已移除 ${workflow.state.removed_drafts.length} 份本地草稿<button class="text-button" data-action="undo-remove">恢复最近移除</button></div>` : ''}</section>`;
}
function renderJob(workflow) {
  const job = workflow.state.active_job;
  if (job) {
    const stages = { queued: '任务排队中', extracting: '提取材料与证据', comparing: '比较已有判断', validating: '校验结果与引用', saving: '保存分析版本', done: '同步分析结果', failed: '任务已失败' };
    return `<div class="job-banner" role="status">${icon('spark')}<div><strong>${stages[job.stage] || '正在查询任务状态'}</strong><p>任务 ${e(job.id)} · ${workflow.connected ? '按真实阶段更新' : '连接恢复后继续查询，不重复发起'}</p></div><button class="button secondary" data-action="refresh-job" ${!workflow.connected ? 'disabled' : ''}>重新查询</button></div>`;
  }
  if (workflow.state.last_job?.status === 'failed') return `<div class="alert" role="alert">上次分析失败：${e(workflow.state.last_job.error?.message || '请核查引擎日志')}。材料仍已保存，可以重新选择待分析材料后再试。</div>`;
  if (workflow.state.last_job?.status === 'succeeded') return `<div class="job-success">${icon('check')}分析已完成 · 版本 v${workflow.state.last_job.result_version}<button class="text-button" data-action="show-results">查看本次结果 ${icon('arrow')}</button></div>`;
  return '';
}
