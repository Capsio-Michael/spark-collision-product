import test from 'node:test';
import assert from 'node:assert/strict';
import { meetingEvidence, meetingForEvidence } from '../src/meeting-evidence-model.js';
import { renderMeetingEvidence } from '../src/meeting-evidence-view.js';
import { getDemoInsightDetail, getDemoDetailRecord } from '../src/fixtures/insight-details.js';
import { DetailSession, evidenceFor, validateSource } from '../src/insight-detail-model.js';
import { renderDetailEvidence } from '../src/insight-detail.js';
import { buildSyntheticReport } from '../src/fixtures/export.js';

const detail = version => getDemoInsightDetail('ins_quote_boundary', version || 3);

test('grouped annotations preserve every snapshot evidence link and explicit conditions', () => {
  for (const version of [1, 2, 3]) {
    const value = detail(version), model = meetingEvidence(value);
    assert.deepEqual(model.groups.map(item => item.meetingId), ['M1', 'M2', 'M3', 'M4'].slice(0, version + 1));
    assert.equal(model.issues.length, 0);
    assert.deepEqual(model.groups.flatMap(group => group.entries.map(item => item.evidence.id)), value.evidence.map(item => item.id));
    for (const group of model.groups) for (const item of group.entries) {
      assert.equal(item.meetingId, group.meetingId); assert.equal(item.canOpen, true);
      validateSource(getDemoDetailRecord(item.evidence.record_id), item.evidence, group.meetingId);
    }
    assert.equal(model.groups[1].entries[0].links[0].condition, '跨区报价');
  }
  const m3 = meetingEvidence(detail()).groups.find(item => item.meetingId === 'M3');
  assert.deepEqual(m3.entries.map(item => item.links[0]), [{ relation: 'qualifies', condition: '无折扣目录价' }, { relation: 'supports', condition: '跨区或特殊折扣' }]);
});

test('M4 corroboration remains distinct from a collision, null conditions stay unknown', () => {
  const model = meetingEvidence(detail());
  const m4 = model.groups.find(group => group.meetingId === 'M4');
  assert.equal(m4.entries.filter(item => item.repeated).length, 1);
  assert.equal(m4.entries[1].links[0].condition, null);
  const html = renderMeetingEvidence(detail());
  assert.ok(html.includes('重复印证 · 非新火花') && html.includes('该条标注的条件未注明'));
  assert.ok(!html.includes('已批准'));
  const broken = detail(); broken.spark.events[0].version = 99;
  assert.equal(meetingEvidence(broken).groups.flatMap(item => item.entries).some(item => item.repeated), false);
});

test('multiple files assigned to the same meeting remain a single group', () => {
  const value = detail(); const copy = structuredClone(value.evidence[0]);
  copy.id = 'extra_evidence'; copy.record_id = 'whiteboard_record'; copy.segment_id = 'whiteboard_segment';
  value.evidence.push(copy);
  const model = meetingEvidence(value), first = model.groups[0];
  assert.equal(model.groups.length, 4); assert.equal(first.meetingId, 'M1');
  assert.equal(first.recordCount, 2); assert.equal(first.entries.length, 2);
});

test('legacy records do not derive meetings from file names, speakers or spark paths', () => {
  const value = detail(); delete value.annotations;
  value.evidence.forEach(item => { delete item.meeting_id; });
  const model = meetingEvidence(value);
  assert.equal(model.groups.length, 1); assert.equal(model.groups[0].meetingId, null);
  assert.ok(model.groups[0].entries.every(item => item.canOpen && item.notes.length));
  assert.ok(renderMeetingEvidence(value).includes('场次待补齐'));
});

test('annotation-only meeting membership is supported and checked against the source response', async () => {
  const value = detail(); value.evidence.forEach(item => { delete item.meeting_id; });
  const first = value.evidence[0]; assert.equal(meetingForEvidence(value, first.id), 'M1');
  const session = new DetailSession({ insightId: value.id, version: 3, loadDetail: () => value,
    loadRecord: id => ({ ...getDemoDetailRecord(id), meeting_id: 'wrong_meeting' }) });
  await session.load(); await session.selectEvidence(first.id);
  assert.equal(session.state.sourceStatus, 'error'); assert.match(session.state.sourceError, /会议归属不一致/);
  session.loadRecord = getDemoDetailRecord; await session.selectEvidence(first.id);
  assert.equal(session.state.sourceStatus, 'ready'); session.close();
});

test('conflicting evidence or record memberships remain unassigned without inventing links', () => {
  const value = detail(); value.annotations[0].meeting_id = 'M_other';
  let model = meetingEvidence(value), unknown = model.groups.find(group => group.meetingId === null);
  assert.ok(unknown.entries.some(item => item.evidence.id === value.evidence[0].id));
  assert.ok(unknown.entries[0].notes.some(note => note.includes('冲突')));
  assert.ok(!renderMeetingEvidence(value).includes('>M_other<'));
  const sameRecord = detail(); sameRecord.evidence[1].record_id = sameRecord.evidence[0].record_id;
  model = meetingEvidence(sameRecord); unknown = model.groups.find(group => group.meetingId === null);
  assert.equal(unknown.entries.length, 2);
});

test('dangling or malformed annotations cannot introduce a later meeting or fabricated quote button', () => {
  const value = detail(1); value.annotations.push({ meeting_id: 'M4', evidence_id: 'future', relation: 'supports', condition: '未来条件' });
  const html = renderMeetingEvidence(value);
  assert.ok(html.includes('未关联到本版证据')); assert.ok(!html.includes('data-cd-evidence="future"') && !html.includes('>M4<'));
  value.annotations[0].condition = { invalid: true }; value.annotations[0].relation = 'future_relation';
  assert.ok(renderMeetingEvidence(value).includes('条件格式异常'));
  value.annotations = {};
  assert.ok(meetingEvidence(value).issues.length);
  const missing = detail(); missing.evidence[0].segment_id = null;
  const broken = renderMeetingEvidence(missing);
  assert.ok(!broken.includes(`data-cd-evidence="${missing.evidence[0].id}"`)); assert.ok(broken.includes('定位信息不完整'));
});

test('relation filters work from annotations alone and retain multiple conditional memberships', () => {
  const value = detail(); value.relations = [];
  assert.equal(evidenceFor(value, 'qualifies').length, 1);
  const evidence = value.evidence[0];
  value.annotations.push({ meeting_id: 'M1', evidence_id: evidence.id, relation: 'challenges', condition: '条件冲突待核对' });
  assert.ok(evidenceFor(value, 'supports').some(item => item.id === evidence.id));
  assert.ok(evidenceFor(value, 'challenges').some(item => item.id === evidence.id));
  assert.equal(meetingEvidence(value, 'challenges').groups.length, 1);
  assert.equal(meetingEvidence(value, 'counterexample').groups.length, 0);
});

test('source meeting and exact paragraph must both agree; old responses can retain unresolved meeting metadata', () => {
  const value = detail(), evidence = value.evidence[0], record = getDemoDetailRecord(evidence.record_id);
  assert.throws(() => validateSource({ ...record, meeting_id: 'M_other' }, evidence), /会议归属不一致/);
  const legacy = { ...record }; delete legacy.meeting_id;
  validateSource(legacy, evidence);
  const html = renderDetailEvidence({ detail: value, selectedEvidenceId: evidence.id, filter: 'all', sourceStatus: 'ready', record: legacy });
  assert.ok(html.includes('场次待核验') && html.includes('cd-highlight'));
  assert.throws(() => validateSource(record, { ...evidence, quote: '编造的原话' }), /不匹配/);
});

test('two quotes from the same cached record retain distinct paragraph highlights', async () => {
  const value = detail(), record = getDemoDetailRecord('rec_03'), evidence = value.evidence.filter(item => item.record_id === record.id);
  const session = new DetailSession({ insightId: value.id, version: 3, loadDetail: () => value, loadRecord: () => record });
  await session.load();
  for (const item of evidence) {
    await session.selectEvidence(item.id);
    assert.equal(session.state.record, record);
    const html = renderDetailEvidence(session.state);
    assert.match(html, new RegExp(`data-cd-highlight tabindex="-1"><div class="cd-paragraph-label">段落 ${record.segments.find(segment => segment.id === item.segment_id).paragraph_index}`));
  }
  session.close();
});

test('untrusted meeting identifiers, annotation conditions and quotes remain escaped text', () => {
  const value = detail(), attack = '<img src=x onerror=alert(1)>';
  value.annotations = []; value.evidence[0].meeting_id = attack; value.evidence[0].quote = attack;
  value.annotations.push({ meeting_id: attack, evidence_id: value.evidence[0].id, relation: 'supports', condition: attack });
  const html = renderMeetingEvidence(value);
  assert.ok(html.includes('&lt;img') && !html.includes('<img'));
  assert.ok(!html.includes('data-cd-meeting-index="<'));
});

test('changing relation filters clears a hidden source and cancels late source responses', async () => {
  const value = detail(), target = value.evidence.find(item => item.meeting_id === 'M3');
  let resolve; const pendingRecord = new Promise(done => { resolve = done; });
  const session = new DetailSession({ insightId: value.id, version: 3, loadDetail: () => value, loadRecord: () => pendingRecord });
  await session.load(); const reading = session.selectEvidence(target.id);
  session.setFilter('supports'); assert.equal(session.state.sourceStatus, 'idle');
  resolve(getDemoDetailRecord(target.record_id)); await reading;
  assert.equal(session.state.record, null); assert.equal(session.state.selectedEvidenceId, null);
  session.loadRecord = getDemoDetailRecord; session.setFilter('all'); await session.selectEvidence(target.id);
  session.setFilter('qualifies'); assert.equal(session.state.selectedEvidenceId, target.id);
  session.setFilter('supplements'); assert.equal(session.state.selectedEvidenceId, null);
  session.close();
});

test('exports preserve grouped annotations for the selected snapshot without future evidence', async () => {
  for (const version of [1, 2, 3]) {
    const { text } = await buildSyntheticReport(version);
    assert.ok(text.includes('按会议核查证据标注') && text.includes('跨区报价'));
    assert.equal(text.includes('##### M3'), version >= 2);
    assert.equal(text.includes('##### M4'), version >= 3);
    assert.equal(text.includes('重复印证，非新火花'), version === 3);
  }
});
