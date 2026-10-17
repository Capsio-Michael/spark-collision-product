import { escapeHtml as e } from './core.js';
import { getDesignSnapshot, getDesignDetail, locateDesignClaim, DESIGN_NOTICE } from './design-review-model.js';

export function renderDesignOverview(version = 1) {
  const snapshot = getDesignSnapshot(version);
  return `<section class="demo-stages" aria-label="设计评审演示步骤"><div><strong>${e(DESIGN_NOTICE)}</strong><p>查看预写内容，不上传材料、不调用分析接口。</p></div><div class="demo-stage-buttons">${[[1, '① M1 · 当前设计理解'], [2, '② 加入 M2 · 补充场景条件']].map(([v, label]) => `<button class="button ${version === v ? 'primary' : 'secondary'}" data-design-version="${v}" aria-pressed="${version === v}">${label}</button>`).join('')}</div></section>
  <section class="panel design-intro"><span class="eyebrow">从含混需求到有条件的理解 · v${version}</span><h2>${version === 1 ? '客户说“大气”，具体指什么？' : '官网首页克制，展会专题可以更鲜明'}</h2><p>${version === 1 ? '从一场多轮讨论中核对：客户反对什么、认可什么，又补充了哪些条件。' : '保留 M1 的理解与原话；M2 增加页面任务的适用范围，不把“所有页面都克制”写成客户曾经的结论。'}</p><p class="small-note">${snapshot.records.length} 场合成讨论 · 原话可核查 · 认可设计理解不等于批准发布</p></section>
  <section class="design-cards" aria-label="设计评审洞察">${snapshot.insights.map(insight => `<article class="panel design-card"><span class="badge badge-${insight.kind === 'clue' ? 'amber' : 'purple'}">${insight.kind === 'clue' ? '待验证线索' : '预写分析理解'}</span><button class="card-title" data-design-insight="${e(insight.id)}"><h2>${e(insight.title)}</h2><span aria-hidden="true">→</span></button><p>${e(insight.current?.understanding || insight.gap)}</p>${insight.v1_after_M1?.scope ? `<p class="small-note">适用范围：${e(insight.current?.scope || insight.v1_after_M1.scope)}</p>` : ''}${insight.importance_basis ? `<details><summary>为什么值得关注</summary><p>${e(insight.importance_basis)}</p></details>` : ''}${version === 2 && insight.v2_after_M2 ? `<p class="design-change">${insight.v2_after_M2.change_type === 'supported_without_new_breakthrough' ? '本次补证，未形成独立新突破' : '本次变化：补充场景条件'}</p>` : ''}<button class="text-button" data-design-insight="${e(insight.id)}">查看形成过程与原话 →</button></article>`).join('')}</section>`;
}

export function renderDesignMaterials(version) {
  const snapshot = getDesignSnapshot(version);
  return `<section class="panel design-intro"><h2>合成原始材料 · v${version}</h2><p>${e(DESIGN_NOTICE)}。P/Q 是人工段落编号，不是录音时间戳。</p>${snapshot.records.map(record => `<details class="design-material"><summary>${e(record.meeting_id)} · ${e(record.title)} · ${record.paragraphs.length} 轮</summary><p>${e(record.content.split('\n\n')[1])}</p>${record.paragraphs.map(p => `<section class="source-paragraph"><span class="paragraph-number">${e(p.id)}</span><p>${e(p.text)}</p></section>`).join('')}</details>`).join('')}</section>`;
}

export function renderDesignHistory(version) {
  return `<section class="panel design-intro"><h2>设计理解如何变化</h2><p>${e(DESIGN_NOTICE)}。以下是预先编写的两个版本。</p><div class="design-cards">${[1, 2].map(v => `<article><h3>v${v} · ${v === 1 ? 'M1 品牌官网评审' : '加入 M2 展会专题回看'}</h3><p>${e(getDesignSnapshot(v).insights[0].current.understanding)}</p><button class="button ${v === version ? 'primary' : 'secondary'}" data-design-version="${v}">${v === version ? '当前版本' : '查看此版本'}</button></article>`).join('')}</div><p class="small-note">M2 限定的是对 M1 的过度概括；旧版没有声称所有页面都必须克制。案例条件洞察得到补证，不额外制造突破。</p></section>`;
}

export function openDesignInsight(id, version, { openDialog, dialogHeader }) {
  const detail = getDesignDetail(id, version), insight = detail.insight;
  const annotation = claim => {
    const { target, paragraph } = locateDesignClaim(detail, claim.claim_id);
    return `<article class="design-claim" id="design-claim-${e(claim.claim_id)}"><div><span class="badge badge-neutral">${e(claim.content_type)}</span> <strong>${e(claim.meeting_id)} ${e(claim.paragraph_id)}</strong> · ${e(paragraph.speaker)}</div><blockquote>${e(claim.quote)}</blockquote><button class="text-button" data-design-quote="${e(claim.claim_id)}">定位整段原文 →</button>${target ? `<div class="design-relation"><strong>${e(claim.relation.type)}</strong> → ${e(target.meeting_id)} ${e(target.paragraph_id)}<blockquote>${e(target.quote)}</blockquote><button class="text-button" data-design-target="${e(target.claim_id)}">查看被回应主张的原文 →</button></div>` : '<p class="small-note">独立提出的主张</p>'}</article>`;
  };
  const dialog = openDialog(`${dialogHeader(`预置合成标注 · v${version}`, insight.title)}<div class="drawer-body"><p class="preview-note">${e(DESIGN_NOTICE)}</p><h3>当前理解</h3><p>${e(insight.current?.understanding || insight.status)}</p><p class="small-note">${e(insight.current?.scope || insight.v1_after_M1?.scope || insight.gap || '限于本次讨论。')} · 未见发布批准。</p>${version === 2 && insight.v2_after_M2?.history_note ? `<p>${e(insight.v2_after_M2.history_note)}</p>` : ''}<div class="design-detail-grid"><section aria-label="洞察形成过程"><h3>多轮交互与具体主张</h3>${['M1', 'M2'].map(meeting => { const claims = detail.annotations.filter(c => c.meeting_id === meeting); return claims.length ? `<h4>${meeting} · ${meeting === 'M1' ? '形成理解' : '补充与限定'}</h4>${claims.map(annotation).join('')}` : ''; }).join('')}</section><aside class="design-source" aria-label="引用原文" tabindex="-1"><h3>原文核查</h3><p>点击任一引用，查看完整段落和上下文。</p></aside></div></div>`, 'modal design-dialog');
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-design-quote], [data-design-target]');
    if (!button) return;
    const { record, paragraph, claim } = locateDesignClaim(detail, button.dataset.designQuote || button.dataset.designTarget);
    const index = record.paragraphs.indexOf(paragraph);
    const source = dialog.querySelector('.design-source');
    source.innerHTML = `<h3>${e(record.meeting_id)} · ${e(paragraph.id)}</h3><p class="small-note">${e(record.filename)} · 合成原文 · ${e(claim.content_type)}</p>${record.paragraphs.slice(Math.max(0, index - 1), index + 2).map(p => `<section class="source-paragraph ${p.id === paragraph.id ? 'highlighted' : ''}"><span class="paragraph-number">${e(p.id)} · ${e(p.speaker)}</span><p>${e(p.text)}</p></section>`).join('')}<p class="small-note">高亮为引用所在整段；上下文逐字保留。没有音频，不判断语气或情绪。</p>`;
    source.focus(); source.scrollIntoView({ block: 'nearest' });
  });
}
