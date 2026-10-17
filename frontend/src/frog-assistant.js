import { mountFrog } from './frog.js';
import { FROG_PREFERENCE_KEY, frogPreferences, frogPresentation } from './frog-model.js';

export function createFrogAssistant({ storage, getContext }) {
  const host = document.createElement('div'); host.className = 'assistant-host';
  const preferences = frogPreferences(storage);
  let ready = false, lastPresentation = '', lastLocation = null;
  const frog = mountFrog(host, { ...preferences, compact: true, onPreferenceChange(value) {
    if (!ready) return;
    try { storage.setItem(FROG_PREFERENCE_KEY, JSON.stringify(value)); note.textContent = ''; }
    catch { note.textContent = '外观仅本次生效，未能保存。'; }
  } });
  const note = document.createElement('small'); note.className = 'frog-preference-note'; note.setAttribute('role', 'status'); host.append(note);
  ready = true;
  function sync() {
    const dialogs = [...document.querySelectorAll('dialog[open]')];
    const dialog = dialogs.at(-1);
    const uploadSlot = dialog?.querySelector('#upload-start:not([hidden]) .upload-symbol');
    const header = dialog?.querySelector('.dialog-header, .cd-header');
    const slot = uploadSlot || header || document.querySelector('#assistant-slot');
    if (!slot) return;
    if (lastLocation !== slot || host.parentElement !== slot) {
      if (uploadSlot) uploadSlot.replaceChildren(host);
      else if (header) header.insertBefore(host, header.lastElementChild);
      else slot.append(host);
      frog.closePicker(); lastLocation = slot;
    }
    host.classList.toggle('assistant-in-header', !!header && !uploadSlot);
    frog.setCompact(!uploadSlot);
    const model = dialog?.classList.contains('material-editor')
      ? { state: 'reading', label: uploadSlot ? '等待资料 · 尚未分析' : '资料暂存 · 尚未提交分析', animate: false }
      : frogPresentation(getContext());
    const key = JSON.stringify([model, !!dialog]);
    if (key !== lastPresentation) {
      lastPresentation = key;
      frog.setState(model.state);
      frog.setMessage(model.label);
      frog.root.dataset.quiet = String(!!dialog || !model.animate);
    }
  }
  // Dialogs are created by independent detail/export modules. Watch only their lifecycle.
  new MutationObserver(records => {
    const hasDialog = node => node.nodeType === 1 && (node.tagName === 'DIALOG' || node.querySelector('dialog'));
    if (records.some(r => r.attributeName === 'open' || r.type === 'attributes' && r.target.id === 'upload-start'
      || [...r.addedNodes, ...r.removedNodes].some(hasDialog))) sync();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] });
  document.addEventListener('pointerdown', event => { if (!host.contains(event.target)) frog.closePicker(); });
  return { sync };
}
