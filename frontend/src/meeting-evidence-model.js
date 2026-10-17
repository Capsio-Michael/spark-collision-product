import { sparkView } from './spark-model.js';

const array = value => Array.isArray(value) ? value : [];
const id = value => typeof value === 'string' && !!value.trim();
const relations = new Set(['supports', 'challenges', 'supplements', 'counterexample', 'qualifies']);
const unique = values => [...new Set(values)];

// Group only the selected detail's evidence. File names, speaker identity and
// spark participants never fill in absent meeting membership.
export function meetingEvidence(detail, filter = 'all') {
  const catalog = array(detail?.evidence).filter(item => item && id(item.id));
  const known = new Set(catalog.map(item => item.id)), issues = [];
  const annotations = array(detail?.annotations);
  if (detail?.annotations != null && !Array.isArray(detail.annotations)) issues.push('场次标注格式异常，已保留本版原话，归属与关系需核查。');
  const dangling = annotations.filter(item => !item || !known.has(item.evidence_id));
  if (dangling.length) issues.push(`${dangling.length} 项标注未关联到本版证据，不生成原话链接。`);
  const path = sparkView(detail, catalog, detail?.snapshot_version);
  const recordMeetings = new Map();
  for (const evidence of catalog) {
    if (!id(evidence.record_id)) continue;
    if (!recordMeetings.has(evidence.record_id)) recordMeetings.set(evidence.record_id, new Set());
    const claimed = [evidence.meeting_id, ...annotations.filter(item => item?.evidence_id === evidence.id).map(item => item.meeting_id)].filter(id);
    claimed.forEach(value => recordMeetings.get(evidence.record_id).add(value));
  }
  const groups = new Map();
  for (const evidence of catalog) {
    const linked = annotations.filter(item => item?.evidence_id === evidence.id);
    const annotationMeetings = unique(linked.map(item => item.meeting_id).filter(id));
    const evidenceMeeting = id(evidence.meeting_id) ? evidence.meeting_id : null;
    const conflict = annotationMeetings.length > 1 || evidenceMeeting && annotationMeetings.some(value => value !== evidenceMeeting)
      || recordMeetings.get(evidence.record_id)?.size > 1;
    const meetingId = conflict ? null : evidenceMeeting || (annotationMeetings.length === 1 ? annotationMeetings[0] : null);
    const notes = [];
    if (conflict) notes.push('证据与标注的场次归属冲突，暂不归入任何已知会议。');
    else if (!meetingId) notes.push('未提供明确会议归属，不按文件数推断场次。');
    if (linked.some(item => !id(item.meeting_id))) notes.push('部分标注缺少有效场次，需补齐。');
    if (linked.some(item => item.condition != null && typeof item.condition !== 'string')) notes.push('部分适用条件格式异常，未展示为有效条件。');

    const validLinks = linked.filter(item => !conflict && id(item.meeting_id) && item.meeting_id === meetingId);
    const memberships = validLinks.map(item => ({
      relation: relations.has(item.relation) ? item.relation : 'unknown',
      condition: typeof item.condition === 'string' && item.condition.trim() ? item.condition : null,
    }));
    for (const link of array(detail?.relations).filter(item => item?.evidence_id === evidence.id && relations.has(item.relation))) {
      if (!memberships.some(item => item.relation === link.relation)) memberships.push({ relation: link.relation, condition: null });
    }
    if (!memberships.length) memberships.push({ relation: 'unknown', condition: null });
    const seen = new Set();
    const links = memberships.filter(item => {
      const key = JSON.stringify([item.relation, item.condition]);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    const repeated = !!meetingId && path.events.some(event => event.kind === 'corroboration'
      && event.contributions.some(item => item.conversation_id === meetingId && item.evidence_ids.includes(evidence.id)));
    const entry = { evidence, meetingId, links, notes, repeated, canOpen: id(evidence.record_id) && id(evidence.segment_id) && id(evidence.quote) };
    if (filter !== 'all' && !links.some(item => item.relation === filter)) continue;
    if (!groups.has(meetingId)) groups.set(meetingId, { meetingId, entries: [] });
    groups.get(meetingId).entries.push(entry);
  }
  const result = [...groups.values()].sort((a, b) => a.meetingId === null ? 1 : b.meetingId === null ? -1 : 0);
  for (const group of result) group.recordCount = new Set(group.entries.map(item => item.evidence.record_id).filter(id)).size;
  return { groups: result, issues };
}

export function meetingForEvidence(detail, evidenceId) {
  return meetingEvidence(detail).groups.flatMap(group => group.entries).find(item => item.evidence.id === evidenceId)?.meetingId || null;
}
