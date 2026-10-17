import test from 'node:test';
import assert from 'node:assert/strict';
import { resultChanges, resultCounts } from '../src/agent-conversation-model.js';

test('conversation result counts only changed insights in an updated snapshot', () => {
  const overview = {
    outcome: 'updated', insights: [{ id: 'a' }, { id: 'b' }],
    changes: [
      { insight_id: 'a', type: 'qualified' },
      { insight_id: 'b', type: 'new' },
      { insight_id: 'c', type: 'revised' },
      { insight_id: 'a', type: 'unchanged' },
    ],
  };
  assert.deepEqual(resultCounts(overview), { new: 1, supplemented: 1, revised: 0 });
  assert.equal(resultChanges(overview).length, 2);
});

test('no-new-insight cannot display historic changes as new sparks', () => {
  const overview = { outcome: 'no_new_insight', insights: [{ id: 'a' }], changes: [{ insight_id: 'a', type: 'new' }] };
  assert.deepEqual(resultCounts(overview), { new: 0, supplemented: 0, revised: 0 });
  assert.deepEqual(resultChanges(overview), []);
});
