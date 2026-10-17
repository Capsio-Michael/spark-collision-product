const records = [
  { id: 'M1', title: 'M1 客服访谈', speaker: '客服负责人', elicitation: '提问方式未知', relation: '支持', quote: '标准问题可以自动回复，但报价需要人工确认。', source: 'M1.md · 第 2 段' },
  { id: 'M2', title: 'M2 销售访谈', speaker: '销售负责人', elicitation: '提问方式未知', relation: '支持', quote: '跨区报价需要销售确认，不能直接发送给客户。', source: 'M2.md · 第 2 段' },
  { id: 'M3', title: 'M3 运营讨论', speaker: '运营负责人', elicitation: '提问方式未知', relation: '条件限定', quote: '无折扣的目录价可以由系统直接发送。', source: 'M3.md · 第 2 段' },
  { id: 'M4', title: 'M4 项目复盘', speaker: '项目负责人', elicitation: '提问方式未知', relation: '重复印证', quote: '我认可继续验证目录价自动发送、跨区报价人工确认这个方向。', source: 'M4.md · 第 2 段' }
];

const states = [
  { version: '01', judgment: '已讨论的报价都提到人工确认；适用范围待核实。', change: '初始认知', detail: 'M1 + M2 形成阶段性推断，不能推广为全部报价的正式授权规则。', evidence: [0, 1] },
  { version: '02', judgment: '无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。其他报价类型待核实。', change: '判断增加条件', detail: 'M3 提供条件反例；旧判断保留在版本 01。正式授权规则仍待验证。', evidence: [0, 1, 2] },
  { version: '03', judgment: '无折扣目录价可直接发送；跨区或特殊折扣报价仍需人工确认。其他报价类型待核实。', change: '没有新火花', detail: 'M4 重复认可已有边界。快照更新至 v3，判断保持 v2 内容；继续验证不代表批准上线或对外承诺。', evidence: [0, 1, 2, 3] }
];

const recordList = document.getElementById('record-list');
const evidenceList = document.getElementById('evidence-list');
const recordCount = document.getElementById('record-count');
const versionLabel = document.getElementById('version-label');
const judgmentText = document.getElementById('judgment-text');
const coverageGrid = document.getElementById('coverage-grid');
const changeBox = document.getElementById('change-box');
const versionHistory = document.getElementById('version-history');
const addButton = document.getElementById('add-record');
const resetButton = document.getElementById('reset-demo');
const dialog = document.getElementById('source-dialog');
const dialogMeta = document.getElementById('dialog-meta');
const dialogQuote = document.getElementById('dialog-quote');
const dialogClose = document.getElementById('dialog-close');
let stage = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function openSource(index) {
  const record = records[index];
  dialogMeta.textContent = `${record.id} · ${record.source} · ${record.speaker} · ${record.elicitation}`;
  dialogQuote.textContent = `“${record.quote}”`;
  dialog.showModal();
}

function renderRecords() {
  recordList.replaceChildren();
  const count = stage + 2;
  records.slice(0, count).forEach((record, index) => {
    const button = el('button', `record-card${index === count - 1 && stage > 0 ? ' is-new' : ''}`);
    button.type = 'button';
    const top = el('span', 'record-card-top');
    top.append(el('span', '', record.id), el('span', '', record.elicitation));
    button.append(top, el('strong', '', record.title), el('small', '', `${record.speaker} · 点击查看原话`));
    button.addEventListener('click', () => openSource(index));
    recordList.append(button);
  });
  recordCount.textContent = `${String(count).padStart(2, '0')} / 04`;
}

function renderEvidence() {
  evidenceList.replaceChildren();
  states[stage].evidence.forEach(index => {
    const record = records[index];
    const button = el('button', 'evidence-button');
    button.type = 'button';
    const tag = el('span', `relation-tag${record.relation === '条件限定' ? ' challenge' : ''}`, record.relation);
    const content = el('span', 'quote-content', `“${record.quote}”`);
    content.append(el('small', '', `${record.id} · ${record.source}`));
    button.append(tag, content);
    button.addEventListener('click', () => openSource(index));
    evidenceList.append(button);
  });
}

function renderCoverage() {
  coverageGrid.replaceChildren();
  const items = [
    [`${stage + 2}/${stage + 2} 场`, '会议覆盖'],
    [`${[4, 5, 5][stage]}/5`, '重要性 · 演示评分'],
    [stage === 0 ? '条件待核实' : '有条件趋同', '趋同程度']
  ];
  items.forEach(([value, label]) => {
    const card = el('div', 'coverage-card');
    card.append(el('strong', '', value), el('span', '', label));
    coverageGrid.append(card);
  });
  const explanation = el('details', 'metric-explanation');
  explanation.append(el('summary', '', '查看指标说明与演示规则'));
  explanation.append(el('p', '', '会议覆盖按独立场次去重；一场多份材料只计一次。本案例每份 M 文件明确对应一场。'));
  explanation.append(el('p', '', `演示规则 demo-0.1：场次 ${Math.min(stage + 2, 3)} 分（最多 3）＋至少两位独立发言者 1 分＋原话涉及业务取舍 1 分。未用真实业务校准，不是概率、证据充分度或多数票。`));
  explanation.append(el('p', '', stage === 0 ? '趋同条件仍待核实，不能把两个场次的说法推广为全部报价规则。' : '按条件分别理解：无折扣目录价可直接发送；跨区或特殊折扣仍需确认。不是所有人无条件同意，也不代表规则已被验证。'));
  explanation.append(el('p', '', '单次出现的审批等待仍需关注、待验证；M4 的认可不等于批准上线。'));
  coverageGrid.append(explanation);
}

function render() {
  const current = states[stage];
  versionLabel.textContent = `版本 ${current.version}`;
  judgmentText.textContent = current.judgment;
  changeBox.replaceChildren(el('strong', '', current.change), el('span', '', current.detail));
  versionHistory.replaceChildren();
  if (stage > 0) {
    const history = el('details');
    const summary = el('summary', '', stage === 2 ? '查看历史版本 01 / 02' : '查看历史版本 01');
    history.append(summary);
    states.slice(0, stage).forEach(item => history.append(el('p', '', `版本 ${item.version}：${item.judgment}`)));
    versionHistory.append(history);
  }
  renderRecords();
  renderCoverage();
  renderEvidence();
  addButton.disabled = stage === 2;
  addButton.textContent = stage === 0 ? '加入条件反例 +' : stage === 1 ? '加入重复讨论 +' : '已展示全部记录';
}

addButton.addEventListener('click', () => { if (stage < 2) { stage += 1; render(); } });
resetButton.addEventListener('click', () => { stage = 0; render(); });
dialogClose.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
render();
