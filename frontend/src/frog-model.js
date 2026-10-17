export const FROG_PREFERENCE_KEY = 'spark-collision:frog-appearance:v1';
export function frogPreferences(storage) {
  try {
    const saved = JSON.parse(storage.getItem(FROG_PREFERENCE_KEY) || '{}');
    return { style: ['round', 'pixel'].includes(saved?.style) ? saved.style : 'round',
      palette: ['lime', 'mint', 'sky', 'lilac'].includes(saved?.palette) ? saved.palette : 'lime' };
  } catch { return { style: 'round', palette: 'lime' }; }
}

// A displayed snapshot, a busy request and an observed analysis job are different signals.
export function frogPresentation({ workspace, connected, activeJob, lastJob, overview, error, hasMaterials, engineMode, projectId }) {
  const mode = engineMode === 'mock' ? '模拟服务 · ' : '';
  const present = (state, label, animate = false) => ({ state, label, animate });
  if (workspace !== 'own') return present('reading', '预置内容 · 非实时分析');
  if (!connected) return present('reading', activeJob || overview ? '离线 · 状态待核查' : '等待资料与连接');
  if (error) return present('reading', activeJob ? '查询中断 · 等待恢复' : '暂未完成 · 请查看提示');
  if (activeJob) {
    if (['queued', 'running'].includes(activeJob.status)) return present('thinking', `${mode}引擎处理中`, true);
    if (activeJob.status === 'failed') return present('reading', `${mode}分析失败 · 可重试`);
    return present('reading', `${mode}任务状态待核查`);
  }
  if (lastJob?.status === 'failed') return present('reading', `${mode}分析失败 · 可重试`);
  if (lastJob?.status === 'succeeded' && Number.isSafeInteger(lastJob.result_version) && lastJob.result_version > 0
    && lastJob.result_version === overview?.snapshot_version && lastJob.project_id === projectId
    && overview?.project?.id === projectId) {
    const breakthrough = overview.outcome === 'updated' && Array.isArray(overview.changes) && overview.changes.some(c => c.is_breakthrough === true);
    return present(breakthrough ? 'spark' : 'complete', `${mode}${breakthrough ? '有认知变化 · 待核查' : overview.outcome === 'no_new_insight' ? '已完成 · 无新火花' : '结果已读取'}`, breakthrough);
  }
  return present('reading', overview?.snapshot_version ? `${mode}已有结果可查看` : hasMaterials ? '资料已保存 · 待分析' : '等待资料');
}
