// Origin is supplied by the engine. File counts, agreement and review status never create a spark.
const array = value => Array.isArray(value) ? value : [];
const nonempty = value => typeof value === 'string' && !!value.trim();
const ids = value => Array.isArray(value) && value.length > 0 && value.every(nonempty) && new Set(value).size === value.length;
export const SPARK_FILTERS = [['all', '全部'], ['single', '单场碰撞'], ['cross', '跨场碰撞'], ['changed', '认知变化'], ['disputed', '有分歧']];
const fallback = reason => ({ kind: 'unknown', label: '碰撞来源待补充', reason, events: [], conversations: [], conversationCount: null, evidenceCount: null });

export function sparkView(insight, evidence = [], version) {
  const spark = insight?.spark;
  if (!spark) return fallback('尚未提供场次与碰撞事件，不能根据材料数量推断来源。');
  if (spark.status === 'observation' && array(spark.events).length === 0) return { kind: 'observation', label: '关键事实 / 待验证机会', reason: '', events: [], conversations: [] };
  if (spark.status === 'clue' && array(spark.events).length === 0 && nonempty(spark.reason)) return { kind: 'clue', label: '待验证线索', reason: spark.reason, events: [], conversations: [] };
  const fail = () => fallback('场次或碰撞证据不完整，来源待引擎补齐；现有判断与原文仍可核查。');
  if (spark.status !== 'collision' || !ids(array(spark.conversations).map(item => item?.id)) || !ids(array(spark.events).map(item => item?.id))) return fail();
  const conversations = spark.conversations, records = new Map();
  for (const conversation of conversations) {
    if (!nonempty(conversation.title) || !ids(conversation.record_ids)) return fail();
    for (const id of conversation.record_ids) {
      if (records.has(id)) return fail(); // A material cannot silently belong to two conversations.
      records.set(id, conversation.id);
    }
  }
  const catalog = new Map(array(evidence).map(item => [item.id, item]));
  const events = [], known = new Map();
  for (const event of spark.events) {
    if (!['collision', 'corroboration'].includes(event.kind) || !Number.isSafeInteger(event.version) || event.version < 1
      || Number.isInteger(version) && event.version > version || !nonempty(event.reason) || !nonempty(event.before) || !nonempty(event.after)
      || !ids(event.conversation_ids) || event.conversation_ids.some(id => !conversations.some(item => item.id === id))) return fail();
    const previous = event.previous_event_id === null ? null : known.get(event.previous_event_id);
    if (events.length ? previous !== events.at(-1) || event.version < previous.version || event.before !== previous.after : event.previous_event_id !== null) return fail();
    if (!Array.isArray(event.contributions) || event.contributions.length !== event.conversation_ids.length
      || !ids(event.contributions.map(item => item?.conversation_id)) || event.contributions.some(item => !event.conversation_ids.includes(item.conversation_id))) return fail();
    for (const contribution of event.contributions) {
      if (!nonempty(contribution.text) || !ids(contribution.evidence_ids)
        || contribution.evidence_ids.some(id => !nonempty(catalog.get(id)?.quote) || !nonempty(catalog.get(id)?.segment_id) || records.get(catalog.get(id)?.record_id) !== contribution.conversation_id)) return fail();
    }
    if (event.kind === 'collision') {
      if (!['single', 'cross'].includes(event.scope) || (event.scope === 'single' ? event.conversation_ids.length !== 1 : event.conversation_ids.length < 2)
        || event.before.trim() === event.after.trim()) return fail();
    } else if (event.scope !== null || !events.some(item => item.kind === 'collision') || event.before !== event.after || event.before !== previous.after) return fail();
    events.push(event); known.set(event.id, event);
  }
  if (spark.latest_event_id !== events.at(-1)?.id) return fail();
  const collision = events.findLast(item => item.kind === 'collision');
  if (!collision) return fail();
  return {
    kind: collision.scope, label: collision.scope === 'single' ? '单场碰撞' : '跨场碰撞',
    reason: collision.reason, latest: events.at(-1), collision, events, conversations,
    conversationCount: collision.conversation_ids.length,
    evidenceCount: new Set(collision.contributions.flatMap(item => item.evidence_ids)).size,
  };
}

export function matchesSpark(insight, filter, evidence, version) {
  return !['single', 'cross'].includes(filter) || sparkView(insight, evidence, version).kind === filter;
}
