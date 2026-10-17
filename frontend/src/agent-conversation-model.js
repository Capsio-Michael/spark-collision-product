export function resultChanges(overview) {
  if (!overview || overview.outcome !== 'updated') return [];
  const ids = new Set((overview.insights || []).map(item => item.id));
  return (overview.changes || []).filter(item => ids.has(item.insight_id) && ['new', 'supported', 'qualified', 'revised', 'challenged'].includes(item.type));
}

export function resultCounts(overview) {
  const changes = resultChanges(overview);
  return {
    new: changes.filter(item => item.type === 'new').length,
    supplemented: changes.filter(item => ['supported', 'qualified'].includes(item.type)).length,
    revised: changes.filter(item => ['revised', 'challenged'].includes(item.type)).length,
  };
}
