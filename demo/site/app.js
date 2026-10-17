const records = [
  { id: 'R1', title: '访谈一 · 标准问题', speaker: '客服负责人甲', elicitation: '主动提起', relation: '支持', quote: '标准问题可以自动回复，但报价需要人工确认。', source: '合成访谈 01 · 第 1 段' },
  { id: 'R2', title: '访谈二 · 跨区报价', speaker: '销售负责人乙', elicitation: '被问回应', relation: '补充', quote: '我认同自动回复常见问题；跨区报价还需要销售确认。', source: '合成访谈 02 · 第 1 段' },
  { id: 'R3', title: '访谈三 · 目录价', speaker: '运营负责人丙', elicitation: '主动提起', relation: '条件限定', quote: '对于目录价且无折扣的订单，我们已经允许系统直接发送报价。', source: '合成访谈 03 · 第 1 段' },
  { id: 'R4', title: '访谈四 · 重复信息', speaker: '运营成员丁', elicitation: '主动提起', relation: '支持', quote: '目录价又没有折扣时，系统可以直接发送报价。', source: '合成访谈 04 · 第 1 段' }
];

const states = [
  { version: '01', judgment: '现有两段讨论都提到报价需要人工确认；具体适用范围仍待核实。', change: '初始认知', detail: '两段材料形成阶段性判断。这里记录的是发言者观点，尚未验证全部报价场景。', evidence: [0, 1] },
  { version: '02', judgment: '报价处理取决于条件：跨区报价需销售确认；目录价且无折扣可由系统直接发送。其他场景待核实。', change: '判断增加条件', detail: '第三段提供不同条件下的做法。旧判断保留在版本 01，没有被新发言直接覆盖。', evidence: [0, 1, 2] },
  { version: '02', judgment: '报价处理取决于条件：跨区报价需销售确认；目录价且无折扣可由系统直接发送。其他场景待核实。', change: '没有新火花', detail: '第四段重复了已知条件。讨论覆盖增加，判断仍停留在版本 02。', evidence: [0, 1, 2, 3] }
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
    [String(stage + 2), '已知发言者去重'],
    [String(stage === 0 ? 1 : stage + 1), '主动提起'],
    [`${stage + 2}/${stage + 2}`, '讨论记录覆盖']
  ];
  items.forEach(([value, label]) => {
    const card = el('div', 'coverage-card');
    card.append(el('strong', '', value), el('span', '', label));
    coverageGrid.append(card);
  });
}

function render() {
  const current = states[stage];
  versionLabel.textContent = `版本 ${current.version}`;
  judgmentText.textContent = current.judgment;
  changeBox.replaceChildren(el('strong', '', current.change), el('span', '', current.detail));
  versionHistory.replaceChildren();
  if (stage > 0) {
    const history = el('details');
    const summary = el('summary', '', '查看历史版本 01');
    history.append(summary, el('p', '', states[0].judgment));
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
