import { escapeHtml as e } from './core.js';
import { decodeMaterialFiles } from './material-workflow.js';
import { resultChanges, resultCounts } from './agent-conversation-model.js';

const KEY = 'spark-collision:agent-conversation:v1';
const hello = '你好，我是 Sparky。聊聊你的想法，或粘贴讨论记录、添加 TXT／Markdown。我会标明依据；没有足够信息，就不硬凑火花。';
const HERO_COPY = { first: '对话会结束', second: '认知会继续', subtitle: '每一次补充、质疑和反例，都可能改变一个判断。智慧火花碰撞把分散的交流整理成可追溯的项目记忆，让团队看见关注点、分歧和真正学到的东西。' };
const greetings = /^(你好|嗨|hi|hello|暂时没有|还没有|先看看|谢谢|在吗)[！!。. ]*$/i;

export function createAgentConversation({ storage, workflow, onRender, onPoll, onInsight, onEvidence, onKnowledge, onOverview, onConnect }) {
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
    pendingAgentKey: typeof saved.pendingAgentKey === 'string' ? saved.pendingAgentKey : null,
    lastShownVersion: Number.isInteger(saved.lastShownVersion) ? saved.lastShownVersion : 0,
  };
  const persist = () => {
    try { storage.setItem(KEY, JSON.stringify({ messages: state.messages.slice(-20), draft: state.draft, mode: state.mode, basis: state.basis, pendingRecordId: state.pendingRecordId, pendingJobId: state.pendingJobId, pendingAgentKey: state.pendingAgentKey, lastShownVersion: state.lastShownVersion })); }
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
      const body = overview.outcome === 'insufficient_evidence' ? '材料还不足以形成有依据的智慧点，本次没有硬凑结论。' : overview.outcome === 'no_new_insight' ? '这次没有发现新的智慧火花，之前的认识保持可追溯。' : `本次有 ${resultChanges(overview).length} 条洞察。点击卡片查看完整分析。`;
      const agentCards = overview.outcome === 'updated' ? resultChanges(overview).map(change => ({ id: change.insight_id, text: overview.insights.find(item => item.id === change.insight_id)?.judgment?.text || '' })).filter(card => card.text) : [];
      add('assistant', `${prefix}${body}`, { resultVersion: overview.snapshot_version, agentCards });
    } else if (state.pendingJobId && job?.id === state.pendingJobId && job.status === 'failed') {
      state.pendingJobId = null; persist(); add('assistant', '本次分析没有完成，材料仍在项目中。请检查任务状态后重试。');
    }
  }

  function render() {
    sync();
    const hasConversation = state.messages.length > 0;
    const overview = workflow.state.overview;
    const status = workflow.state.active_job ? '正在整理材料与证据…' : state.busy ? workflow.health?.chat_provider === 'kimi' ? '正在等待 Kimi 响应…' : '正在保存并提交材料…' : state.pendingRecordId ? '材料已保留，等待恢复连接或提交…' : '';
    const content = state.messages.map(message => `<div class="agent-message ${message.role === 'user' ? 'from-user' : 'from-agent'}"><div class="agent-message-label">${message.role === 'user' ? '你' : message.kind === 'kimi-chat' || message.agentResult ? 'SPARKY · KIMI' : 'SPARKY'}</div><div class="agent-message-body">${e(message.text)}</div>${message.agentResult ? agentResultCards(message.agentResult) : Array.isArray(message.agentCards) && message.agentCards.length ? savedResultCards(message.agentCards, message.resultVersion) : Number.isInteger(message.resultVersion) && message.resultVersion === overview?.snapshot_version ? resultCards(overview) : Number.isInteger(message.resultVersion) ? `<button class="agent-history-link" data-agent-action="overview">查看 v${message.resultVersion} 的历史结果 →</button>` : ''}</div>`).join('');
    return `<div class="agent-page"><header class="agent-header"><a href="#chat" class="agent-brand"><span class="agent-brand-mark">✳</span><span>智慧火花碰撞</span></a><nav aria-label="主要导航"><a href="#chat" aria-current="page">产品理念</a><a href="#how-it-works">工作方式</a><a href="#experience">体验示例</a></nav><a class="agent-header-cta" href="#experience">查看演示 <span aria-hidden="true">↗</span></a></header>
      <main id="main-content" class="agent-main"><div class="agent-stage ${hasConversation ? 'with-conversation' : ''}">
        <section class="agent-intro" aria-label="产品理念"><div class="agent-copy"><span class="agent-kicker">CONVERSATION INTELLIGENCE · 概念演示</span><h1>${e(HERO_COPY.first)}<br><strong>${e(HERO_COPY.second)}</strong></h1><p>${e(HERO_COPY.subtitle)}</p><div class="agent-hero-actions"><a class="agent-primary-cta" href="#experience">体验合成案例 <span aria-hidden="true">↗</span></a><a class="agent-secondary-cta" href="#how-it-works">了解工作方式 <span aria-hidden="true">↓</span></a></div><span class="agent-data-note"><span aria-hidden="true">●</span> 首屏使用合成材料 · 交互分析连接本机服务</span></div><div class="agent-hero" role="img" aria-label="原话、补充与反例围绕持续存在的智慧点，逐步修正判断"><div class="agent-map-grid"></div><div class="agent-map-glow"></div><div class="agent-map-line line-one"></div><div class="agent-map-line line-two"></div><div class="agent-map-line line-three"></div><div class="agent-map-node node-one"><span>01 / 原话</span><strong>“报价需要人工确认”</strong></div><div class="agent-map-node node-two"><span>02 / 补充</span><strong>“跨区报价需要销售确认”</strong></div><div class="agent-map-node node-three"><span>03 / 反例</span><strong>“目录价可直接发送”</strong></div><div class="agent-map-center"><small>持续存在的智慧点</small><strong>报价的<br>确认边界</strong><small>判断随证据修正</small></div><div class="agent-map-index">S / 01 <small>INSIGHT MAP</small></div></div></section>
        <section id="how-it-works" class="agent-how"><span>01 / 捕捉原话</span><span>02 / 标注补充与质疑</span><span>03 / 跨会议更新认知</span><a href="#overview">查看项目记忆 ↗</a></section>
        <section id="experience" class="agent-conversation" aria-label="与 Sparky 对话"><div class="agent-conversation-heading"><span>体验示例 · 与 Sparky 对话</span><span>${workflow.state.overview?.snapshot_version ? `项目记忆 v${workflow.state.overview.snapshot_version}` : '等待第一段交流'} · <button type="button" class="agent-connect-link" data-agent-action="connect">${workflow.connected ? '引擎已连接' : '连接本机引擎'}</button></span></div><div class="agent-feed" id="agent-feed" role="log" aria-live="polite"><div class="agent-message from-agent"><div class="agent-message-label">SPARKY</div><div class="agent-message-body">${hello}</div></div>${content}${status ? `<div class="agent-status" role="status"><span class="agent-pulse"></span>${e(status)}</div>` : ''}</div></section>
      </div></main><div class="agent-composer-wrap"><form id="agent-form" class="agent-composer"><div class="agent-mode-row"><button type="button" data-agent-mode="talk" class="agent-mode ${state.mode === 'talk' ? 'active' : ''}">聊聊想法</button><button type="button" data-agent-mode="analyze" class="agent-mode ${state.mode === 'analyze' ? 'active' : ''}">分析讨论记录</button><span>${state.file ? e(state.file.name) : '原话、观点与推断分开呈现'}</span></div><label class="sr-only" for="agent-input">输入消息或讨论记录</label><textarea id="agent-input" rows="2" maxlength="20000" placeholder="${state.mode === 'analyze' ? '粘贴一段会议或访谈记录，或附上 TXT、Markdown 文件' : '告诉 Sparky 你在想什么…'}">${e(state.draft)}</textarea><div class="agent-composer-bottom"><div class="agent-composer-tools"><label class="agent-attach">＋ 添加文本文件<input id="agent-file" type="file" accept=".txt,.md,text/plain,text/markdown" hidden></label><button type="button" data-agent-action="mic" class="agent-mic" aria-label="录音功能说明">♩</button>${state.file ? '<button type="button" data-agent-action="remove-file" class="agent-file-remove">移除附件</button>' : ''}</div><button type="submit" class="agent-send" ${state.busy || workflow.state.active_job ? 'disabled' : ''}>发送 <span>↗</span></button></div>
      ${state.mode === 'analyze' ? `<div class="agent-basis"><label>材料来源 <select id="agent-basis"><option value="synthetic" ${state.basis === 'synthetic' ? 'selected' : ''}>合成演示材料</option><option value="authorized" ${state.basis === 'authorized' ? 'selected' : ''}>已获使用授权的材料</option></select></label>${state.basis === 'authorized' ? '<label class="agent-consent"><input id="agent-consent" type="checkbox" ' + (state.consent ? 'checked' : '') + '>' + (workflow.health?.chat_provider === 'kimi' ? '我确认有权将这份材料发送给 Kimi 分析' : '我确认有权将这份材料用于本机分析') + '</label>' : '<span>合成案例用于演示，请勿填写客户私密信息</span>'}</div>` : ''}
      ${state.error || state.pendingRecordId && !workflow.state.active_job && !state.busy && !state.pendingJobId ? `<div class="agent-error" role="alert">${e(state.error || '上次提交尚未完成，材料已保存在项目草稿中。')} ${state.pendingRecordId ? '<button type="button" data-agent-action="retry">重试提交</button>' : ''}</div>` : ''}</form><div class="agent-footnote">${workflow.health?.chat_provider === 'kimi' ? '对话文字与确认分析的材料会发送给 Kimi' : '本机模拟服务未调用外部模型'} · 不自动执行外部任务 · 无录音转写</div></div></div>`;
  }

  function resultCards(overview) {
    if (!overview || overview.outcome !== 'updated') return `<button class="agent-history-link" data-agent-action="overview">查看项目历史和材料 →</button>`;
    const changes = resultChanges(overview);
    if (!changes.length) return `<button class="agent-history-link" data-agent-action="overview">查看完整项目结果 →</button>`;
    return `<div class="agent-result-summary">本次有 ${changes.length} 条洞察 · 合成案例模拟结果</div><div class="agent-result-cards">${changes.map((change, index) => {
      const insight = overview.insights.find(item => item.id === change.insight_id);
      if (!insight) return '';
      return `<button type="button" class="agent-result-card" data-agent-knowledge-id="mock@${overview.snapshot_version}@${e(insight.id)}"><span>${index + 1}</span><strong>${e(insight.judgment.text)}</strong><em>查看详情 ↗</em></button>`;
    }).join('')}</div><button class="agent-history-link" data-agent-action="overview">查看全部结果与历史 →</button>`;
  }

  function savedResultCards(cards, version) {
    if (!Number.isSafeInteger(version) || !Array.isArray(cards)) return '';
    return `<div class="agent-result-summary">本次有 ${cards.length} 条洞察 · 合成案例模拟结果</div><div class="agent-result-cards">${cards.map((card, index) => `<button type="button" class="agent-result-card" data-agent-knowledge-id="mock@${version}@${e(card.id)}"><span>${index + 1}</span><strong>${e(card.text)}</strong><em>查看详情 ↗</em></button>`).join('')}</div>`;
  }

  function agentResultCards(item) {
    const result = item?.result;
    if (item.provider !== 'kimi' || !result || !Array.isArray(result.changes) || !['updated', 'no_new_insight', 'insufficient_evidence'].includes(result.outcome)) return '';
    const counts = {
      new: result.changes.filter(change => change?.type === 'new').length,
      supplemented: result.changes.filter(change => ['supported', 'qualified'].includes(change?.type)).length,
      revised: result.changes.filter(change => ['revised', 'challenged'].includes(change?.type)).length,
    };
    if (!result.changes.length) return `<div class="agent-result-summary">本次没有新的有据洞察 · Kimi 分析</div>`;
    return `<div class="agent-result-summary">本次有 ${result.changes.length} 条洞察 · Kimi 引文分析</div><div class="agent-result-cards">${result.changes.map((change, changeIndex) => {
      if (typeof change?.title !== 'string' || typeof change?.reason !== 'string' || typeof change?.judgment !== 'string' || !Array.isArray(change?.evidence)) return '';
      return `<button type="button" class="agent-result-card" data-agent-knowledge-id="kimi@${e(item.id)}@${changeIndex}"><span>${changeIndex + 1}</span><strong>${e(change.judgment)}</strong><em>查看详情 ↗</em></button>`;
    }).join('')}</div>`;
  }

  async function submit() {
    if (state.busy || workflow.state.active_job) return;
    state.error = '';
    const text = state.draft.trim();
    if (!text && !state.file) { state.error = '请先输入消息或添加 TXT、Markdown 文件。'; onRender(); return; }
    if (state.mode === 'talk') {
      if (state.file) { state.error = '请切换到“分析讨论记录”再发送附件。'; onRender(); return; }
      add('user', text, { kind: 'talk' }); state.draft = ''; persist();
      if (workflow.connected && workflow.health?.chat_provider === 'kimi') {
        const history = state.messages.filter(message => ['talk', 'kimi-chat'].includes(message.kind) && !message.partial && message.text).slice(-12).map(message => ({ role: message.role, content: message.text.slice(0, 2000) }));
        state.busy = true; add('assistant', '', { kind: 'kimi-chat', partial: true });
        const reply = state.messages.at(-1);
        try {
          await workflow.api.chatStream(history, part => { reply.text += part; persist(); onRender(); });
          reply.partial = false; persist();
        } catch (error) {
          reply.text += `${reply.text ? '\n\n' : ''}Kimi 对话未完成：${error.message}`;
          state.error = '本轮回复未完成，未当作已确认结论。'; persist();
        } finally { state.busy = false; onRender(); }
        return;
      }
      const answer = greetings.test(text) ? '我在这里。你准备好时，可以聊聊想法，或切换到“分析讨论记录”提交一段文字。' : '我收到你的想法了。当前本机没有启用开放式对话服务；如果这是一段会议或访谈原话，请选择“分析讨论记录”。';
      add('assistant', answer); onRender(); return;
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
      record.authorization_note = state.basis === 'authorized' ? workflow.health?.chat_provider === 'kimi' ? '用户在对话入口确认有权发送给 Kimi 分析' : '用户在对话入口确认有权用于本机分析' : null;
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
    if (workflow.health?.agent_analysis_mode === 'kimi') {
      const record = workflow.state.drafts.find(item => item.client_record_id === id);
      if (record?.material_basis === 'authorized' && !state.consent) throw new Error('请确认有权将这份材料发送给 Kimi 分析后再重试。');
      if (!state.pendingAgentKey) { state.pendingAgentKey = crypto.randomUUID(); persist(); }
      const result = await workflow.api.agentAnalysis(workflow.state.project.id, serverId, !!state.consent, state.pendingAgentKey);
      state.pendingRecordId = null; state.pendingAgentKey = null; state.error = '';
      const body = result.result?.outcome === 'updated' ? `本次有 ${result.result.changes.length} 条洞察。点击卡片查看完整分析。` : result.result?.outcome === 'no_new_insight' ? 'Kimi 本轮未发现有据可查的新火花，保留原来的认识。' : 'Kimi 本轮认为证据不足，没有生成火花。';
      add('assistant', `${body}\n${result.result.summary}`, { agentResult: result });
      persist(); onRender(); return;
    }
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
    handleKnowledge(id) { onKnowledge(id); },
    handleEvidence(path) {
      const parts = path.split('.').map(Number);
      if (parts.length !== 3 || parts.some(value => !Number.isSafeInteger(value) || value < 0)) return;
      const citation = state.messages[parts[0]]?.agentResult?.result?.changes?.[parts[1]]?.evidence?.[parts[2]];
      if (citation && typeof citation.record_id === 'string' && typeof citation.segment_id === 'string' && typeof citation.quote === 'string') onEvidence(citation);
    },
  };
}
