import { sortVersions } from './history-model.js';

export class ExportSession {
  constructor({ projectId, loadVersions, loadOverview, loadRecord, loadExport, preferredVersion = null, onChange = () => {} }) {
    Object.assign(this, { projectId, loadVersions, loadOverview, loadRecord, loadExport, preferredVersion, onChange });
    this.state = { status: 'loading', versions: [], version: null, snapshot: null, records: [], error: null, downloadStatus: 'idle', downloadError: null };
    this.generation = 0; this.closed = false; this.abort = null;
  }
  update(patch) { if (!this.closed) { this.state = { ...this.state, ...patch }; this.onChange(this.state); } }
  async start() {
    if (this.closed) return;
    const generation = ++this.generation;
    this.abort?.abort();
    this.update({ status: 'loading', error: null, snapshot: null, records: [], downloadStatus: 'idle', downloadError: null });
    try {
      const versions = sortVersions((await this.loadVersions()).items);
      if (this.closed || generation !== this.generation) return;
      this.update({ versions });
      if (!versions.length) { this.update({ status: 'empty', version: null }); return; }
      const version = this.preferredVersion ?? versions[0].version;
      if (!versions.some(item => item.version === version)) throw new Error('当前查看的版本不在可导出列表中，请关闭面板并刷新项目后重试。');
      await this.select(version);
    } catch (error) { if (generation === this.generation) this.update({ status: 'error', error: error.message || '无法读取导出版本。' }); }
  }
  async select(version) {
    if (this.closed) return;
    const selected = this.state.versions.find(item => item.version === version);
    if (!selected) return;
    const generation = ++this.generation;
    this.abort?.abort();
    this.update({ status: 'loading_snapshot', version, snapshot: null, records: [], error: null, downloadStatus: 'idle', downloadError: null });
    try {
      const snapshot = await this.loadOverview(version);
      if (this.closed || generation !== this.generation) return;
      if (snapshot?.project?.id !== this.projectId || snapshot.snapshot_version !== version || !Array.isArray(snapshot.source_record_ids) || new Set(snapshot.source_record_ids).size !== snapshot.source_record_ids.length || JSON.stringify([...snapshot.source_record_ids].sort()) !== JSON.stringify([...selected.source_record_ids].sort())) throw new Error('项目、版本或材料范围不一致，已停止导出。请重新读取。');
      const records = await Promise.all(snapshot.source_record_ids.map(async id => {
        const record = await this.loadRecord(id);
        if (record?.id !== id || typeof record.title !== 'string') throw new Error('材料信息不匹配，无法确认本次导出范围。');
        // Only retain metadata here. Export previews do not copy raw material text.
        return { id, title: record.title, source_name: record.source_name, source_date: record.source_date };
      }));
      if (this.closed || generation !== this.generation) return;
      this.update({ status: 'ready', snapshot: structuredClone(snapshot), records });
    } catch (error) { if (generation === this.generation) this.update({ status: 'error', error: error.message || '无法核对导出范围。' }); }
  }
  async download() {
    if (this.closed || this.state.status !== 'ready' || this.state.downloadStatus === 'loading') return null;
    const generation = this.generation, version = this.state.version;
    this.abort = new AbortController();
    this.update({ downloadStatus: 'loading', downloadError: null });
    try {
      const result = await this.loadExport(version, this.abort.signal);
      if (this.closed || generation !== this.generation) return null;
      if (result?.version !== version || typeof result.text !== 'string' || !result.text.trim() || !/\.md$/i.test(result.filename || '')) throw new Error('下载文件与所选版本不匹配或内容无效。');
      this.update({ downloadStatus: 'ready' });
      return result;
    } catch (error) {
      if (generation === this.generation && !this.closed) this.update({ downloadStatus: 'error', downloadError: error.message || '下载失败，请重试所选版本。' });
      return null;
    }
  }
  downloadFailed(error) { this.update({ downloadStatus: 'error', downloadError: error.message || '浏览器无法开始下载，请重试。' }); }
  close() { this.closed = true; this.generation++; this.abort?.abort(); }
}
