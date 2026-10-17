import { escapeHtml as e } from './core.js';
import { decodeMaterialFiles } from './material-workflow.js';
import { resultChanges, resultCounts } from './agent-conversation-model.js';

const KEY = 'spark-collision:agent-conversation:v1';
const hello = '你好，我是 Sparky。你可以先告诉我在想什么，也可以粘贴一段讨论记录或附上 TXT、Markdown 文件。我会区分原话与分析结果；没有足够依据时，也会如实告诉你。';
const greetings = /^(你好|嗨|hi|hello|暂时没有|还没有|先看看|谢谢|在吗)[！!。. ]*$/i;

export function createAgentConversation({ storage, workflow, onRender, onPoll, onInsight, onOverview, onConnect }) {
  let saved = {};
  try { saved = JSON.parse(storage.getItem(KEY) || '{}'); } catch { /* Keep the current page usable. */ }
  const state = {
    messages: Array.isArray(saved.messages) ? saved.messages.filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.text === 'string' && item.text.length <= 20000 && (item.resultVersion === undefined || Number.isSafeInteger(item.resultVersion))).slice(-20) : [],
    draft: typeof saved.draft === 'string' ? saved.draft : '',
    mode: saved.mode === 'analyze' ? 'analyze' : 'talk',
    basis: saved.basis === 'authorized' ? 'authorized' : 'synthetic',
    consent: false, file: null, busy: false, error: '',
    pendingRecordId: typeof saved.pendingRecordId === 'string' ? saved.pendingRecordId : null,
    pendingJobId: typeof saved.pendingJobId === 'string' ? saved.pendingJobId : null,
    lastShownVersion: Number.isInteger(saved.lastShownVersion) ? saved.lastShownVersion : 0,
  };
  const persist = () => {
    try { storage.setItem(KEY, JSON.stringify({ messages: state.messages.slice(-20), draft: state.draft, mode: state.mode, basis: state.basis, pendingRecordId: state.pendingRecordId, pendingJobId: state.pendingJobId, lastShownVersion: state.lastShownVersion })); }
    catch { state.error = '浏览器未能保存对话，刷新后可能丢失消息；分析材料会另外保存在项目草稿。'; }
  };
  const add = (role, text, extra = {}) => { state.messages.push({ role, text, ...extra }); state.messages = state.messages.slice(-20); persist(); onRender(); };

  function sync() {
    if (state.pendingRecordId && !state.pendingJobId && workflow.state.active_job?.id) {
      state.pendingJobId = workflow.state.active_job.id; persist();
    }
    const job = workflow.state.last_job;
    const overview = workflow.state.overview;
    if (state.pendingJobId && job?.id === state.pendingJobId && job.status === 'succeeded' && overview?.snapshot_version === job.result_version && overview.snapshot_version > state.lastShownVersion) {
      state.lastShownVersion = overview.snapshot_version;
      state.pendingJobId = null; state.pendingRecordId = null;
      const counts = resultCounts(overview);
      const prefix = overview.engine_mode === 'mock' ? '模拟引擎已完成分析。' : '分析已完成。';
      const body = overview.outcome === 'insufficient_evidence' ? '材料还不足以形成有依据的智慧点，本次没有硬凑结论。' : overview.outcome === 'no_new_insight' ? '这次没有发现新的智慧火花，之前的认识保持可追溯。' : `这次识别出 ${counts.new} 个新关注点、${counts.supplemented} 个补充、${counts.revised} 个修正。`;
      add('assistant', `${prefix}${body}`, { resultVersion: overview.snapshot_version });
    } else if (state.pendingJobId && job?.id === state.pendingJobId && job.status === 'failed') {
      state.pendingJobId = null; persist(); add('assistant', '本次分析没有完成，材料仍在项目中。请检查任务状态后重试。');
    }
  }

  function render() {
    sync();
    const hasConversation = state.messages.length > 0;
    const overview = workflow.state.overview;
    const status = workflow.state.active_job ? '正在整理材料与证据…' : state.busy ? '正在保存并提交材料…' : state.pendingRecordId ? '材料已保留，等待恢复连接或提交…' : '';
    const content = state.messages.map(message => `<div class="agent-message ${message.role === 'user' ? 'from-user' : 'from-agent'}"><div class="agent-message-label">${message.role === 'user' ? '你' : 'SPARKY'}</div><div class="agent-message-body">${e(message.text)}</div>${Number.isInteger(message.resultVersion) && message.resultVersion === overview?.snapshot_version ? resultCards(overview) : Number.isInteger(message.resultVersion) ? `<button class="agent-history-link" data-agent-action="overview">查看 v${message.resultVersion} 的历史结果 →</button>` : ''}</div>`).join('');
    return `<div class="agent-page"><header class="agent-header"><a href="#chat" class="agent-brand"><span class="agent-brand-mark">✳</span><span>智慧火花碰撞</span></a><nav aria-label="主要导航"><a href="#chat" aria-current="page">与 Sparky 对话</a><a href="#overview">项目总览</a><a href="#materials">材料</a><a href="#history">历史</a></nav><button class="agent-engine" data-agent-action="connect"><span class="agent-engine-dot ${workflow.connected ? 'is-on' : ''}"></span>${workflow.connected ? `${workflow.health?.engine_mode === 'mock' ? '模拟引擎' : '引擎'}已连接` : '连接本机引擎'}</button></header>
      <main id="main-content" class="agent-main"><div class="agent-stage ${hasConversation ? 'with-conversation' : ''}">
        <section class="agent-intro"><div class="agent-copy"><span class="agent-kicker">CONVERSATION INTELLIGENCE · 智慧火花碰撞</span><h1>对话会结束<br><strong>认知会继续</strong></h1><p>把讨论中的补充、质疑和反例，变成有原话依据的项目记忆</p><span class="agent-data-note">当前支持 TXT、Markdown 与粘贴文本 · ${workflow.health?.engine_mode === 'mock' ? '模拟引擎演示' : '分析以已连接服务为准'}</span></div><div class="agent-hero" aria-label="Sparky 小青蛙"><div class="agent-hero-orbit"></div><img src="/src/assets/sparky-reference.png" alt="Sparky 小青蛙站在光圈中"/><span class="agent-hero-tag">你好，我是 Sparky ✦</span></div></section>
        <section class="agent-conversation" aria-label="与 Sparky 对话"><div class="agent-conversation-heading"><span>与你一起追踪变化</span><span>${workflow.state.overview?.snapshot_version ? `项目记忆 v${workflow.state.overview.snapshot_version}` : '等待第一段交流'}</span></div><div class="agent-feed" id="agent-feed" role="log" aria-live="polite"><div class="agent-message from-agent"><div class="agent-message-label">SPARKY</div><div class="agent-message-body">${hello}</div></div>${content}${status ? `<div class="agent-status" role="status"><span class="agent-pulse"></span>${e(status)}</div>` : ''}</div></section>
      </div></main><div class="agent-composer-wrap"><form id="agent-form" class="agent-composer"><div class="agent-mode-row"><button type="button" data-agent-mode="talk" class="agent-mode ${state.mode === 'talk' ? 'active' : ''}">聊聊想法</button><button type="button" data-agent-mode="analyze" class="agent-mode ${state.mode === 'analyze' ? 'active' : ''}">分析讨论记录</button><span>${state.file ? e(state.file.name) : '原话、观点与推断分开呈现'}</span></div><label class="sr-only" for="agent-input">输入消息或讨论记录</label><textarea id="agent-input" rows="2" maxlength="20000" placeholder="${state.mode === 'analyze' ? '粘贴一段会议或访谈记录，或附上 TXT、Markdown 文件' : '告诉 Sparky 你在想什么…'}">${e(state.draft)}</textarea><div class="agent-composer-bottom"><div class="agent-composer-tools"><label class="agent-attach">＋ 添加文本文件<input id="agent-file" type="file" accept=".txt,.md,text/plain,text/markdown" hidden></label><button type="button" data-agent-action="mic" class="agent-mic" aria-label="录音功能说明">♩</button>${state.file ? '<button type="button" data-agent-action="remove-file" class="agent-file-remove">移除附件</button>' : ''}</div><button type="submit" class="agent-send" ${state.busy || workflow.state.active_job ? 'disabled' : ''}>发送 <span>↗</span></button></div>
      ${state.mode === 'analyze' ? `<div class="agent-basis"><label>材料来源 <select id="agent-basis"><option value="synthetic" ${state.basis === 'synthetic' ? 'selected' : ''}>合成演示材料</option><option value="authorized" ${state.basis === 'authorized' ? 'selected' : ''}>已获使用授权的材料</option></select></label>${state.basis === 'authorized' ? '<label class="agent-consent"><input id="agent-consent" type="checkbox" ' + (state.consent ? 'checked' : '') + '>我确认有权将这份材料用于本机分析</label>' : '<span>合成案例用于演示，请勿填写客户私密信息</span>'}</div>` : ''}
      ${state.error || state.pendingRecordId && !workflow.state.active_job && !state.busy && !state.pendingJobId ? `<div class="agent-error" role="alert">${e(state.error || '上次提交尚未完成，材料已保存在项目草稿中。')} ${state.pendingRecordId ? '<button type="button" data-agent-action="retry">重试提交</button>' : ''}</div>` : ''}</form><div class="agent-footnote">Sparky 不会自动执行外部任务 · 录音转写尚未接入</div></div></div>`;
  }

  function resultCards(overview) {
    if (!overview || overview.outcome !== 'updated') return `<button class="agent-history-link" data-agent-action="overview">查看项目历史和材料 →</button>`;
    const changes = resultChanges(overview);
    if (!changes.length) return `<button class="agent-history-link" data-agent-action="overview">查看完整项目结果 →</button>`;
    return `<div class="agent-result-summary">本次认知变化 · v${overview.snapshot_version}</div><div class="agent-result-cards">${changes.slice(0, 3).map(change => {
      const insight = overview.insights.find(item => item.id === change.insight_id);
      const label = { new: '新关注点', supported: '再次支持', qualified: '条件补充', revised: '认识修正', challenged: '受到质疑' }[change.type];
      return `<button type="button" class="agent-result-card" data-agent-insight="${e(insight.id)}"><span>${label}</span><strong>${e(insight.title)}</strong><small>${e(change.reason || insight.judgment.text)}</small><em>查看原话与条件 ↗</em></button>`;
    }).join('')}</div><button class="agent-history-link" data-agent-action="overview">查看全部结果与历史 →</button>`;
  }

  async function submit() {
    if (state.busy || workflow.state.active_job) return;
    state.error = '';
    const text = state.draft.trim();
    if (!text && !state.file) { state.error = '请先输入消息或添加 TXT、Markdown 文件。'; onRender(); return; }
    if (state.mode === 'talk') {
      if (state.file) { state.error = '请切换到“分析讨论记录”再发送附件。'; onRender(); return; }
      add('user', text); state.draft = '';
      const answer = greetings.test(text) ? '我在这里。你准备好时，可以聊聊想法，或切换到“分析讨论记录”提交一段文字。' : '我收到你的想法了。当前的本机服务还不支持开放式连续追问；如果这是一段会议或访谈原话，请选择“分析讨论记录”，我会据此检查证据与认知变化。';
      add('assistant', answer); persist(); onRender(); return;
    }
    if (state.basis === 'authorized' && !state.consent) { state.error = '请先确认这份材料已获使用授权。'; onRender(); return; }
    state.busy = true; onRender();
    let record;
    try {
      record = state.file ? (await decodeMaterialFiles([state.file]))[0] : {
        client_record_id: crypto.randomUUID(), title: text.split('\n')[0].slice(0, 60) || '讨论记录', source_type: 'chat', source_date: null, source_name: 'Sparky 对话输入', material_basis: '', authorization_note: null, participants: [], content: text,
      };
      if (state.file && text) record.content += `\n\n补充说明：${text}`;
      record.material_basis = state.basis;
      record.authorization_note = state.basis === 'authorized' ? '用户在对话入口确认有权用于本机分析' : null;
      workflow.save([record]);
      state.pendingRecordId = record.client_record_id;
      add('user', state.file ? `分析附件：${state.file.name}${text ? `\n补充说明：${text}` : ''}` : text);
      state.file = null; state.draft = ''; persist();
      await runPending();
    } catch (error) { state.error = `${error.message} ${state.pendingRecordId ? '材料已保存在本地，可重试。' : '输入仍保留，可修改后重试。'}`; }
    finally { state.busy = false; persist(); onRender(); }
  }

  async function runPending() {
    const id = state.pendingRecordId;
    if (!id) return;
    if (!workflow.connected) await workflow.connect();
    if (!workflow.state.submissions[id]) await workflow.submit([id]);
    const serverId = workflow.state.submissions[id];
    if (!serverId) throw new Error('材料提交状态未确认，请在材料列表核查。');
    if (!workflow.state.active_job) await workflow.startAnalysis([serverId]);
    state.pendingJobId = workflow.state.active_job?.id || null;
    state.error = ''; persist(); onPoll(0); onRender();
  }

  return {
    state, render, sync,
    async handleSubmit(event) { event.preventDefault(); await submit(); },
    async handleRetry() { state.busy = true; state.error = ''; onRender(); try { await runPending(); } catch (error) { state.error = error.message; } finally { state.busy = false; onRender(); } },
    handleAction(action) { if (action === 'connect') onConnect(); else if (action === 'overview') onOverview(); else if (action === 'retry') this.handleRetry(); else if (action === 'mic') { state.error = '录音转写尚未接入，请先将语音转为 TXT 或 Markdown 文字。'; onRender(); } else if (action === 'remove-file') { state.file = null; onRender(); } },
    handleMode(mode) { state.mode = mode; state.error = ''; persist(); onRender(); },
    handleInput(value) { state.draft = value; persist(); },
    handleBasis(value) { state.basis = value; state.consent = false; persist(); onRender(); },
    handleConsent(value) { state.consent = value; },
    handleFile(file) { if (!file) return; state.file = file; state.mode = 'analyze'; state.error = ''; persist(); onRender(); },
    handleInsight(id) { onInsight(id); },
  };
}
