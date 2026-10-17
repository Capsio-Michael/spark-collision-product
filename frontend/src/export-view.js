import { icon } from './icons.js';
import { escapeHtml as e } from './core.js';
import { ExportSession } from './export-model.js';

export function downloadMarkdownFile(artifact) {
  const url = URL.createObjectURL(new Blob([artifact.text], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = artifact.filename;
  anchor.hidden = true; document.body.append(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}

export function openExportDialog({ source, preferredVersion, projectName, example = false, onConnect, onSample, onClose = () => {} }) {
  if (!document.querySelector('#ex-export-styles')) {
    const link = document.createElement('link'); link.id = 'ex-export-styles'; link.rel = 'stylesheet';
    link.href = new URL('./export.css', import.meta.url).href; document.head.append(link);
  }
  const originalFocus = document.activeElement;
  const dialog = document.createElement('dialog'); dialog.className = 'ex-dialog'; dialog.setAttribute('aria-labelledby', 'ex-title');
  dialog.innerHTML = `<header class="ex-header"><div><span class="ex-eyebrow">EXPORT RESULTS</span><h2 id="ex-title">导出分析报告</h2></div><button class="ex-close" aria-label="关闭导出面板" data-ex-close>${icon('close')}</button></header><div class="ex-body"></div><footer class="ex-footer"></footer>`;
  const body = dialog.querySelector('.ex-body'), footer = dialog.querySelector('.ex-footer');
  let finished = false;
  const session = source ? new ExportSession({ ...source, preferredVersion, onChange: render }) : null;
  function close() { if (finished) return; finished = true; session?.close(); dialog.close(); }
  dialog.addEventListener('close', () => {
    finished = true; session?.close(); dialog.remove();
    if (!document.querySelector('.ex-dialog[open]')) document.body.classList.remove('ex-open');
    onClose();
    const focus = originalFocus?.isConnected ? originalFocus : document.querySelector('[data-action="export"]');
    if (!document.querySelector('dialog[open]')) focus?.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.hasAttribute('data-ex-close')) close();
    if (button.hasAttribute('data-ex-connect')) { close(); onConnect?.(); }
    if (button.hasAttribute('data-ex-sample')) { close(); onSample?.(); }
    if (button.hasAttribute('data-ex-retry')) {
      if (session.state.version && session.state.versions.length) session.select(session.state.version);
      else session.start();
    }
    if (button.hasAttribute('data-ex-download')) {
      const artifact = await session.download();
      if (artifact && !finished) { try { downloadMarkdownFile(artifact); } catch (error) { session.downloadFailed(error); } }
    }
  });
  dialog.addEventListener('change', event => { if (event.target.id === 'ex-version') session.select(Number(event.target.value)); });
  function render() {
    if (finished) return;
    const focused = dialog.contains(document.activeElement) ? document.activeElement.id : null;
    if (!session) {
      body.innerHTML = `<div class="ex-empty">${icon('file')}<h3>先生成项目分析，再导出报告</h3><p>${e(projectName || '我的调研项目')}目前没有可读取的分析版本。连接引擎并完成分析后，可以导出对应快照；本地草稿仍保留。</p><div class="ex-empty-actions"><button class="button primary" data-ex-connect>连接引擎</button><button class="button secondary" data-ex-sample>体验合成报告</button></div></div>`;
      footer.innerHTML = '<button class="button secondary" data-ex-close>关闭</button>'; return;
    }
    const state = session.state;
    if (state.status === 'loading') {
      body.innerHTML = `<div class="ex-empty" role="status">${icon('clock')}<h3>正在读取可导出版本</h3><p>核对快照和材料范围后，再开始下载。</p></div>`;
      footer.innerHTML = '<button class="button secondary" data-ex-close>关闭</button>'; return;
    }
    if (state.status === 'empty') {
      body.innerHTML = `<div class="ex-empty">${icon('file')}<h3>还没有可导出的分析版本</h3><p>请先在材料列表完成一次分析。导出不会自动发起分析或提交草稿。</p></div>`;
      footer.innerHTML = '<button class="button secondary" data-ex-close>关闭</button>'; return;
    }
    const downloading = state.downloadStatus === 'loading', ready = state.status === 'ready';
    const version = state.versions.find(item => item.version === state.version);
    body.innerHTML = `<div class="ex-project"><span class="ex-project-icon">${icon('file')}</span><div><strong>${e(projectName || state.snapshot?.project?.name || '项目分析')}</strong><span>${example ? '合成示例 · 预设模拟结果，用于交互演示' : state.snapshot?.engine_mode === 'mock' ? '模拟引擎报告' : '由分析引擎生成报告'}</span></div><span class="ex-format">.md</span></div>
      ${state.versions.length ? `<div class="ex-version-row"><label for="ex-version">导出版本<select id="ex-version" aria-label="导出版本" ${downloading ? 'disabled' : ''}>${state.versions.map(item => `<option value="${item.version}" ${state.version === item.version ? 'selected' : ''}>v${item.version}${item.version === state.versions[0].version ? ' · 最新' : ' · 历史版本'}${item.cause === 'correction' ? ' · 纠错／确认' : ''}</option>`).join('')}</select></label><div class="ex-format-info"><span>文件格式</span><strong>Markdown · UTF-8</strong></div></div>` : ''}
      ${state.status === 'loading_snapshot' ? `<div class="ex-loading" role="status">${icon('clock')}正在核对 v${state.version} 的材料范围…</div>` : state.status === 'error' ? `<div class="ex-error" role="alert"><strong>暂时无法核对导出范围</strong><p>${e(state.error)}</p><button class="button secondary" data-ex-retry>重新读取</button></div>` : ''}
      ${ready ? `<section class="ex-snapshot"><div class="ex-section-title"><h3>本次导出范围</h3><span>固定快照 v${state.version}</span></div><p>${e(state.snapshot.summary || '本版没有形成可靠判断，报告会保留已有材料与证据缺口。')}</p><div class="ex-snapshot-meta"><span>${state.records.length} 份材料</span><span>${e(version?.created_at ? formatDate(version.created_at) : '版本时间未提供')}</span>${state.snapshot.outcome === 'no_new_insight' ? '<span>本次无新火花</span>' : ''}</div><details class="ex-materials"><summary>查看材料与日期 ${icon('down')}</summary><ul>${state.records.map(record => `<li><strong>${e(record.title)}</strong><span>${e(record.source_name || '来源名未提供')} · ${e(record.source_date || '日期未提供')}</span></li>`).join('')}</ul></details></section>
      <section class="ex-contents"><h3>报告包含</h3><div>${['分析简报与六个视角', '当前判断与认知变化（如有）', '适用条件与证据缺口', '截至本版的判断历史', '未解决分歧与验证建议', '原文引文与文件／段落位置'].map(label => `<span>${icon('check')}${label}</span>`).join('')}</div><p>材料未覆盖的内容会标明缺口。历史导出仅包含截至该版本的信息。</p></section>
      <div class="ex-note">${icon('info')}<span>${example ? '合成报告只用于体验，不是实际客户分析。' : '下载所选版本，不重新分析材料。'}验证建议与已确认判断均不代表批准执行。</span></div>` : ''}
      ${state.downloadStatus === 'error' ? `<div class="ex-error" role="alert"><strong>下载未完成</strong><p>${e(state.downloadError)}</p><p>已保留 v${state.version} 的选择，可以重试。</p></div>` : ''}
      ${state.downloadStatus === 'ready' ? '<p class="ex-success" role="status">已交给浏览器下载，请在浏览器下载记录中查看文件。</p>' : ''}`;
    footer.innerHTML = `<span class="ex-footer-note">${downloading ? `正在下载 v${state.version}…` : ready ? `将下载 v${state.version} · .md 文件` : '核对范围后可下载'}</span><div><button class="button secondary" data-ex-close>关闭</button><button class="button primary" id="ex-download" data-ex-download ${!ready || downloading ? 'disabled' : ''}>${icon('download')}${downloading ? '正在下载…' : state.downloadStatus === 'error' ? '重试下载 Markdown' : state.downloadStatus === 'ready' ? '再次下载 Markdown' : '下载 Markdown'}</button></div>`;
    if (focused) dialog.querySelector(`#${focused}`)?.focus({ preventScroll: true });
  }
  document.body.append(dialog); document.body.classList.add('ex-open'); render(); dialog.showModal(); session?.start();
  return { close, session };
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '版本时间未提供' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
