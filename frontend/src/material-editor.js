import { icon } from './icons.js';
import { SOURCE_LABELS, escapeHtml as e, characterCount, validateDrafts } from './core.js';
import { decodeMaterialFiles } from './material-workflow.js';

export function openMaterialEditor({ workflow, editingId = null, openDialog, closeDialog, dialogHeader, onSaved }) {
  if (editingId && !workflow.isEditable(editingId)) throw new Error('已提交或提交结果待确认的材料不能编辑。');
  const key = editingId ? `edit:${editingId}` : 'new';
  const original = editingId ? workflow.state.drafts.find(item => item.client_record_id === editingId) : null;
  if (editingId && !original) throw new Error('草稿不存在。');
  let records = structuredClone(workflow.state.editor_buffers[key] || (original ? [original] : [emptyRecord()]));
  let active = 0, reading = false, submitted = false, timer;
  const editingIds = editingId ? [editingId] : [];
  const blankRecord = record => !record.title && !record.content && !record.material_basis && !record.participants.length && !record.source_date && !record.meeting_id && !record.authorization_note;
  const startsEmpty = !editingId && records.length === 1 && blankRecord(records[0]);
  const expandedMetadata = new Set();
  const dialog = openDialog(`${dialogHeader('MEETING MATERIALS', editingId ? '编辑材料草稿' : '上传资料')}
    <div class="editor-intro"><span>${icon('info')}先保存材料，再连接引擎分析。</span><span id="buffer-status">填写内容会自动暂存</span></div>
    ${!editingId ? `<section id="upload-start" class="upload-start" ${!startsEmpty ? 'hidden' : ''} aria-label="添加会议资料"><span class="upload-symbol">${icon('upload')}</span><h3>把交流记录放进来</h3><p>选择 TXT / Markdown 文件，或直接粘贴文字。<br>不需要先配置分析模式或参与者。</p><div class="upload-start-actions"><label class="button primary file-picker-label">${icon('upload')}选择文件<input id="start-files" type="file" accept=".txt,.md" multiple aria-label="选择会议资料文件"></label><button class="button secondary" type="button" id="start-paste">${icon('file')}粘贴文字</button></div><p class="small-note">支持 UTF-8 编码；每批最多 5 份，每份最多 20,000 字符。<br>也可以将文件拖到这里。当前暂不支持音频、PDF 或图片。</p><p class="small-note">先保存在当前浏览器，不会自动上传或开始分析。</p></section>` : ''}
    <div class="editor-layout" ${startsEmpty ? 'hidden' : ''}><aside class="editor-queue" aria-label="本次材料"><div class="queue-heading"><strong>本次材料</strong><span id="queue-count"></span></div><div id="editor-tabs"></div>${!editingId ? `<div class="queue-actions"><button type="button" class="button secondary" id="add-paste">${icon('plus')}新增粘贴材料</button><label class="button secondary file-picker-label" for="editor-files">${icon('upload')}添加文件<input id="editor-files" type="file" accept=".txt,.md" multiple></label><p>支持 UTF-8 TXT / Markdown<br>每批最多 5 份</p></div>` : ''}</aside><div class="editor-main"><div id="editor-fields"></div></div></div>
    <div id="editor-error" class="form-error upload-error" role="alert" hidden></div>
    <footer class="modal-footer editor-footer" ${startsEmpty ? 'hidden' : ''}><span id="editor-save-note">尚未提交 · 原文保留在本地</span><button type="button" class="button primary" id="save-draft">保存到材料列表</button><button type="button" class="button secondary" id="submit-draft" ${!workflow.connected ? 'hidden disabled' : ''}>提交到引擎 ${icon('arrow')}</button></footer>`, 'modal material-editor');
  const fieldRoot = dialog.querySelector('#editor-fields');
  const errorNode = dialog.querySelector('#editor-error');
  function emptyRecord() { return { client_record_id: crypto.randomUUID(), title: '', source_type: 'other', source_date: null, source_name: '粘贴记录', material_basis: '', authorization_note: null, participants: [], content: '' }; }
  function error(message) { errorNode.textContent = message || ''; errorNode.hidden = !message; if (message) requestAnimationFrame(() => errorNode.scrollIntoView({ block: 'nearest' })); }
  function buffer() {
    clearTimeout(timer);
    if (submitted) return true;
    try { workflow.saveBuffer(key, structuredClone(records)); dialog.querySelector('#buffer-status').textContent = '编辑暂存已保存'; return true; }
    catch (cause) { error(cause.message); dialog.querySelector('#buffer-status').textContent = '暂存失败，请保留输入'; return false; }
  }
  function scheduleBuffer() { clearTimeout(timer); timer = setTimeout(buffer, 250); }
  function renderTabs() {
    dialog.querySelector('#queue-count').textContent = `${records.length} / 5`;
    dialog.querySelector('#editor-tabs').innerHTML = records.map((record, index) => `<div class="queue-item ${index === active ? 'selected' : ''}"><button type="button" class="queue-tab" data-editor-tab="${index}" aria-pressed="${index === active}"><span>${String(index + 1).padStart(2, '0')}</span><span><strong>${e(record.title || '未命名材料')}</strong><small>${characterCount(record.content).toLocaleString()} 字符 · ${record.material_basis ? '已填写依据' : '待补充依据'}</small></span></button>${records.length > 1 ? `<button type="button" class="icon-button" data-editor-remove="${index}" aria-label="移出本批次：${e(record.title || '未命名材料')}">${icon('close')}</button>` : ''}</div>`).join('') + Object.entries(workflow.state.editor_buffers).filter(([name]) => name.startsWith('removed:')).map(([name, removed]) => `<button type="button" class="queue-restore text-button" data-editor-restore="${e(name)}">恢复：${e(removed[0]?.title || '未命名材料')}</button>`).join('');
  }
  function participantRows(record) {
    const known = [...new Map([...workflow.knownParticipants, ...records.filter(item => item !== record).flatMap(item => item.participants).filter(person => person.label.trim())].map(person => [person.id, person])).values()];
    return record.participants.map((person, index) => {
      const reusable = known.some(item => item.id === person.id);
      return `<div class="participant-row"><select class="form-input" data-participant-select="${index}" aria-label="参与者 ${index + 1} 身份"><option value="new" ${!reusable ? 'selected' : ''}>新建参与者</option>${known.map(item => `<option value="${e(item.id)}" ${item.id === person.id ? 'selected' : ''}>复用：${e(item.label)} · ${e(item.id.slice(-6))}</option>`).join('')}</select><input class="form-input" data-participant-label="${index}" value="${e(person.label)}" maxlength="80" placeholder="姓名、岗位或匿名名称" aria-label="参与者 ${index + 1} 名称" ${reusable ? 'readonly' : ''}><button type="button" class="icon-button" data-remove-person="${index}" aria-label="移除参与者 ${index + 1}">${icon('close')}</button></div>`;
    }).join('');
  }
  function renderFields() {
    const record = records[active];
    fieldRoot.innerHTML = `<div class="editor-section-header"><span class="eyebrow">MATERIAL ${String(active + 1).padStart(2, '0')}</span><span>${e(record.source_name || '粘贴记录')}</span></div>
      <label class="field-label" for="edit-content">原始文字 <span>必填，保留完整上下文</span></label><textarea class="form-input" id="edit-content" data-field="content" rows="8" placeholder="把会议记录、访谈或讨论原文粘贴到这里…">${e(record.content)}</textarea><div class="field-hint"><span>保存后可以继续编辑</span><span id="editor-char-count">${characterCount(record.content).toLocaleString()} / 20,000</span></div>
      <label class="field-label" for="edit-title">材料标题 <span>必填</span></label><input class="form-input" id="edit-title" data-field="title" value="${e(record.title)}" maxlength="120" placeholder="例如：品牌官网设计评审">
      <label class="field-label" for="edit-basis">这份材料可以用于本次分析吗？ <span>必选</span></label><select class="form-input" id="edit-basis" data-field="material_basis"><option value="">请选择材料使用依据</option><option value="synthetic" ${record.material_basis === 'synthetic' ? 'selected' : ''}>合成案例（虚构的演示文字）</option><option value="authorized" ${record.material_basis === 'authorized' ? 'selected' : ''}>已获得使用授权</option></select>
      <div id="editor-authorization" ${record.material_basis !== 'authorized' ? 'hidden' : ''}><label class="field-label" for="edit-authorization">授权说明 <span>必填</span></label><input class="form-input" id="edit-authorization" data-field="authorization_note" maxlength="1000" value="${e(record.authorization_note || '')}" placeholder="例如：经提供者同意用于本次演示"></div>
      <details class="material-metadata" ${expandedMetadata.has(record.client_record_id) ? 'open' : ''}><summary>更多信息（选填）：日期、会议归属、参与者</summary><p class="small-note">不确定的内容可以留空，之后也可在草稿中补充。</p><div class="form-grid"><div><label class="field-label" for="edit-source-type">来源类型</label><select class="form-input" id="edit-source-type" data-field="source_type">${Object.entries(SOURCE_LABELS).map(([value, label]) => `<option value="${value}" ${record.source_type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div><label class="field-label" for="edit-date">材料日期</label><input class="form-input" id="edit-date" data-field="source_date" type="date" value="${e(record.source_date || '')}"></div></div>
      <label class="field-label" for="edit-meeting">所属会议标识 <span>不确定时留空</span></label><input class="form-input" id="edit-meeting" data-field="meeting_id" value="${e(record.meeting_id || '')}" maxlength="120" placeholder="例如：M1、M2 或本次会议的明确编号"><p class="small-note">按真实会议归属填写，不按文件名推断。当前模拟服务每场只接收一份材料。</p>
      <div class="participants-heading"><label class="field-label">参与者 <span>不确定时不推测</span></label><button type="button" class="text-button" id="add-participant">${icon('plus')}添加参与者</button></div><div id="participants-list">${participantRows(record)}</div><p class="small-note">同一个人跨材料出现时请选择“复用”；同名不会自动合并身份。</p></details>`;
    fieldRoot.querySelector('.material-metadata').addEventListener('toggle', event => {
      if (event.target.open) expandedMetadata.add(record.client_record_id);
      else expandedMetadata.delete(record.client_record_id);
    });
  }
  function showEditor() {
    const start = dialog.querySelector('#upload-start'); if (start) start.hidden = true;
    dialog.querySelector('.editor-layout').hidden = false;
    dialog.querySelector('.editor-footer').hidden = false;
  }
  function render() { renderTabs(); renderFields(); }
  render();
  fieldRoot.addEventListener('input', event => {
    const field = event.target.dataset.field;
    if (field) {
      records[active][field] = ['source_date', 'authorization_note'].includes(field) ? event.target.value || null : event.target.value;
      if (field === 'content') dialog.querySelector('#editor-char-count').textContent = `${characterCount(event.target.value).toLocaleString()} / 20,000`;
      renderTabs();
    }
    if (event.target.dataset.participantLabel !== undefined) records[active].participants[Number(event.target.dataset.participantLabel)].label = event.target.value;
    error(null); scheduleBuffer();
  });
  fieldRoot.addEventListener('change', event => {
    const field = event.target.dataset.field;
    if (field) {
      records[active][field] = field === 'source_date' ? event.target.value || null : event.target.value;
      if (field === 'material_basis') {
        dialog.querySelector('#editor-authorization').hidden = event.target.value !== 'authorized';
        if (event.target.value !== 'authorized') records[active].authorization_note = null;
      }
      renderTabs(); scheduleBuffer();
    }
    if (event.target.dataset.participantSelect !== undefined) {
      const index = Number(event.target.dataset.participantSelect);
      records[active].participants[index] = event.target.value === 'new' ? { id: crypto.randomUUID(), label: '' } : structuredClone([...workflow.knownParticipants, ...records.flatMap(item => item.participants)].find(item => item.id === event.target.value));
      dialog.querySelector('#participants-list').innerHTML = participantRows(records[active]); buffer();
    }
  });
  async function filesSelected(files) {
    if (reading) return; reading = true; error(null);
    dialog.querySelector('#save-draft').disabled = true; dialog.querySelector('#submit-draft').disabled = true;
    try {
      const added = await decodeMaterialFiles(files);
      const blankOnly = records.length === 1 && blankRecord(records[0]);
      if ((blankOnly ? 0 : records.length) + added.length > 5) throw new Error('本批次最多 5 份材料，请先保存当前批次。');
      records = blankOnly ? added : [...records, ...added]; active = records.length - added.length;
      render(); showEditor(); buffer();
    } catch (cause) { error(cause.message); }
    finally { reading = false; dialog.querySelector('#save-draft').disabled = false; dialog.querySelector('#submit-draft').disabled = !workflow.connected; for (const input of dialog.querySelectorAll('input[type="file"]')) input.value = ''; }
  }
  for (const input of dialog.querySelectorAll('input[type="file"]')) input.addEventListener('change', event => filesSelected([...event.target.files]));
  dialog.addEventListener('dragover', event => { if (editingId) return; event.preventDefault(); dialog.classList.add('drag-over'); });
  dialog.addEventListener('dragleave', event => { if (!dialog.contains(event.relatedTarget)) dialog.classList.remove('drag-over'); });
  dialog.addEventListener('drop', event => { if (editingId) return; event.preventDefault(); dialog.classList.remove('drag-over'); filesSelected([...event.dataTransfer.files]); });
  dialog.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || reading) return;
    if (button.id === 'start-paste') { showEditor(); fieldRoot.querySelector('#edit-content').focus(); return; }
    if (button.dataset.editorTab !== undefined) { active = Number(button.dataset.editorTab); render(); error(null); }
    if (button.dataset.editorRestore) {
      if (records.length >= 5) { error('本批次最多 5 份材料，请先保存再恢复。'); return; }
      const saved = workflow.state.editor_buffers[button.dataset.editorRestore]?.[0];
      if (saved) {
        const next = [...records, structuredClone(saved)];
        const buffers = { ...workflow.state.editor_buffers, [key]: next }; delete buffers[button.dataset.editorRestore];
        try { workflow.commit({ editor_buffers: buffers }); records = next; active = records.length - 1; render(); } catch (cause) { error(cause.message); }
      }
    }
    if (button.dataset.editorRemove !== undefined) {
      // The queue action only moves an entry out of this submission batch, keeping a recoverable buffer.
      const index = Number(button.dataset.editorRemove);
      const removed = records[index];
      try {
        workflow.saveBuffer(`removed:${removed.client_record_id}`, [removed]);
        records.splice(index, 1); active = Math.min(active, records.length - 1); render(); buffer();
      } catch (cause) { error(cause.message); }
    }
    if (button.id === 'add-paste') {
      if (records.length >= 5) { error('本批次最多 5 份材料。'); return; }
      records.push(emptyRecord()); active = records.length - 1; render(); buffer();
    }
    if (button.id === 'add-participant') { records[active].participants.push({ id: crypto.randomUUID(), label: '' }); dialog.querySelector('#participants-list').innerHTML = participantRows(records[active]); buffer(); }
    if (button.dataset.removePerson !== undefined) { records[active].participants.splice(Number(button.dataset.removePerson), 1); dialog.querySelector('#participants-list').innerHTML = participantRows(records[active]); buffer(); }
    if (['save-draft', 'submit-draft'].includes(button.id)) {
      const normalized = records.map(record => ({ ...record, title: record.title.trim(), meeting_id: typeof record.meeting_id === 'string' ? record.meeting_id.trim() || null : record.meeting_id ?? null, authorization_note: record.material_basis === 'authorized' ? record.authorization_note?.trim() || null : null, participants: record.participants.map(person => ({ ...person, label: person.label.trim() })) }));
      for (let index = 0; index < normalized.length; index++) {
        const invalid = validateDrafts([normalized[index]]);
        if (invalid) { active = index; if (/日期|参与者|会议标识|材料类型/.test(invalid)) expandedMetadata.add(normalized[index].client_record_id); render(); error(`第 ${index + 1} 份材料：${invalid}`); return; }
      }
      try {
        workflow.save(normalized, editingIds, key); submitted = true; clearTimeout(timer); closeDialog();
        await onSaved(normalized.map(record => record.client_record_id), button.id === 'submit-draft');
      } catch (cause) { if (dialog.open) error(cause.message); }
    }
  });
  const flushOnPageHide = () => { if (!submitted) buffer(); };
  window.addEventListener('pagehide', flushOnPageHide);
  dialog.addEventListener('close', () => {
    window.removeEventListener('pagehide', flushOnPageHide);
    clearTimeout(timer); if (!submitted) buffer();
  });
}
