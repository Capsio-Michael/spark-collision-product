import { escapeHtml as e } from './core.js';
import { icon } from './icons.js';

export function renderDemoAttention(insight) {
  return insight.attention_flag ? `<p class="demo-attention">${icon('info')}${e(insight.attention_flag)}</p>` : '';
}

export function renderDemoStages(overview) {
  const version = overview.snapshot_version;
  return `<section class="demo-stages" aria-label="合成案例演示步骤"><div><strong>报价授权边界调研 · 合成案例</strong><p>按步骤查看预设快照；此操作不会调用真实 AI。</p></div><div class="demo-stage-buttons">${[[1, '① M1 + M2 · 初始判断'], [2, '② 加入 M3 · 条件细化'], [3, '③ 加入 M4 · 无新火花']].map(([value, label]) => `<button class="button ${value === version ? 'primary' : 'secondary'}" data-demo-version="${value}" aria-pressed="${value === version}">${label}</button>`).join('')}</div><p class="demo-stage-note">当前 v${version} · ${overview.source_record_ids.length} 场讨论${version === 3 ? ' · 覆盖增加，保留 v2 的认知变化；认可继续验证不等于批准上线。' : version === 2 ? ' · M3 补充无折扣目录价的适用条件。' : ' · 适用范围待核实，尚无认知碰撞。'}</p></section>`;
}

export function renderDemoSpotlight(overview) {
  const version = overview.snapshot_version, main = overview.insights[0];
  const first = overview.evidence.find(item => item.meeting_id === 'M1');
  const shock = overview.evidence.find(item => item.meeting_id === (version === 1 ? 'M2' : 'M3'));
  const source = (evidence, label) => `<button class="evidence-link" data-evidence="${e(evidence.id)}">${icon('link')}${e(evidence.label)} · ${label}</button>`;
  return `<section class="spotlight" aria-labelledby="change-heading"><div class="section-kicker">${icon('spark')}${version === 1 ? '阶段性判断 · 待核实条件' : version === 2 ? '一次值得关注的认知变化' : '新增印证 · 没有新火花'}</div><h2 id="change-heading">${version === 1 ? '报价需人工确认，适用范围待核实' : '从“报价人工确认”，到“按条件划分边界”'}</h2><p>${version === 3 ? 'M4 增加了讨论覆盖，没有改变 v2 的条件边界。' : '保留各场讨论的说法，再核对适用条件与正式授权规则。'}</p><div class="change-comparison"><div><span class="comparison-label">${version === 1 ? 'M1 提出的说法' : '原有分析前提 · 非原话'}</span><p>${version === 1 ? '标准问题可以自动回复，但报价需要人工确认。' : '已讨论的报价均提到人工确认，适用范围待核实。'}</p>${source(first, 'M1 客服访谈')}</div><span class="comparison-arrow">${icon('arrow')}</span><div class="new-judgment"><span class="comparison-label">${version === 1 ? 'M2 补充 · 暂定推断' : '条件细化 · 推断'}</span><p>${e(main.judgment.text)}</p>${source(shock, version === 1 ? 'M2 销售访谈' : 'M3 条件证据')}</div></div><div class="spotlight-footer"><span>${icon('target')}下一步：核对授权规则与真实订单</span><button class="text-button" data-insight="${e(main.id)}">查看判断 ${icon('arrow')}</button></div></section>`;
}
