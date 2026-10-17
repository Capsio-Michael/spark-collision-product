/** Original SVG frog appearance component. No analysis, network, or timing logic. */
export const PALETTES = Object.freeze({
  lime: { label: '青柠', body: '#b9ed68', shade: '#83b947', ink: '#183423', blush: '#ec8d91' },
  mint: { label: '薄荷', body: '#88dbbb', shade: '#4ca88b', ink: '#163c38', blush: '#f3a48d' },
  sky: { label: '湖蓝', body: '#8ac9ee', shade: '#5999c5', ink: '#193956', blush: '#f2a2a5' },
  lilac: { label: '紫藤', body: '#c4afe9', shade: '#927ec1', ink: '#352e5c', blush: '#ef9eaa' },
});
export const STYLES = Object.freeze({ round: '圆润', pixel: '像素' });
export const STATES = Object.freeze({ reading: '阅读', thinking: '思考', spark: '发现火花', complete: '完成' });

const svg = `<svg class="frog-art" viewBox="0 0 128 128" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <g class="frog-round">
    <ellipse class="shade" cx="34" cy="106" rx="20" ry="11"/><ellipse class="shade" cx="94" cy="106" rx="20" ry="11"/>
    <ellipse class="body" cx="64" cy="87" rx="42" ry="34"/><ellipse class="body" cx="64" cy="58" rx="44" ry="34"/>
    <circle class="body" cx="40" cy="29" r="18"/><circle class="body" cx="88" cy="29" r="18"/>
    <circle class="eye-white" cx="40" cy="29" r="10"/><circle class="eye-white" cx="88" cy="29" r="10"/>
    <circle class="eye-ink" cx="41" cy="32" r="4"/><circle class="eye-ink" cx="89" cy="32" r="4"/>
    <circle class="blush" cx="37" cy="65" r="6"/><circle class="blush" cx="91" cy="65" r="6"/>
    <path class="smile" d="M53 68 Q64 78 75 68" fill="none" stroke-width="3" stroke-linecap="round"/>
  </g>
  <g class="frog-pixel">
    <path class="shade" d="M20 94h14v-8h60v8h14v18H20z"/>
    <path class="body" d="M20 50h10V22h24v14h20V22h24v28h10v48H20z"/>
    <path class="eye-white" d="M34 30h16v16H34zm44 0h16v16H78z"/>
    <path class="eye-ink" d="M42 38h8v8h-8zm44 0h8v8h-8z"/>
    <path class="blush" d="M30 62h12v8H30zm56 0h12v8H86z"/>
    <path class="smile-fill" d="M52 70h8v6h8v-6h8v6h-8v6H60v-6h-8z"/>
  </g>
  <g class="prop-book"><path fill="#f7f8ed" stroke="var(--frog-ink)" stroke-width="2" d="M36 82q14-5 28 2 14-7 28-2v22q-14-5-28 2-14-7-28-2z"/><path fill="none" stroke="var(--frog-ink)" stroke-width="2" d="M64 84v22"/></g>
  <g class="prop-thought"><circle cx="79" cy="9" r="3"/><circle cx="91" cy="13" r="4"/><circle cx="104" cy="7" r="5"/></g>
  <path class="prop-spark" d="M100 3l4 9 9 4-9 4-4 9-4-9-9-4 9-4z"/>
  <g class="prop-complete"><circle cx="101" cy="15" r="13" fill="#fff" stroke="var(--frog-ink)" stroke-width="2"/><path d="M95 15l4 4 8-9" fill="none" stroke="var(--frog-ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;

let frogInstance = 0;

export function mountFrog(host, { style = 'round', palette = 'lime', state = 'reading', compact = false, onPreferenceChange = () => {} } = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('Frog host must be an HTML element');
  const pickerId = `frog-appearance-${++frogInstance}`;
  host.innerHTML = `<div class="frog" data-style="round" data-state="reading">
    <button type="button" class="frog-trigger" aria-label="选择 Sparky 小青蛙外观" aria-expanded="false" aria-controls="${pickerId}">${svg}</button>
    <span class="frog-status" aria-live="polite"></span>
    <div class="frog-appearance" id="${pickerId}" hidden>
      <p>外观选择 <small>不影响分析</small></p>
      <div class="frog-choice-label">样式</div><div class="frog-style-options"></div>
      <div class="frog-choice-label">颜色</div><div class="frog-palette-options"></div>
    </div>
  </div>`;
  const root = host.firstElementChild;
  const trigger = root.querySelector('.frog-trigger');
  const picker = root.querySelector('.frog-appearance');
  const stateLabel = root.querySelector('.frog-status');
  const styleBox = root.querySelector('.frog-style-options');
  const paletteBox = root.querySelector('.frog-palette-options');
  for (const [key, label] of Object.entries(STYLES)) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label; button.dataset.styleChoice = key;
    button.addEventListener('click', () => setAppearance({ style: key })); styleBox.append(button);
  }
  for (const [key, colors] of Object.entries(PALETTES)) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = colors.label; button.dataset.paletteChoice = key;
    button.style.setProperty('--swatch', colors.body);
    button.addEventListener('click', () => setAppearance({ palette: key })); paletteBox.append(button);
  }
  trigger.addEventListener('click', () => {
    picker.hidden = !picker.hidden;
    trigger.setAttribute('aria-expanded', String(!picker.hidden));
  });
  function closePicker() { picker.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !picker.hidden) { event.preventDefault(); event.stopPropagation(); closePicker(); trigger.focus(); }
  });
  function setAppearance(next = {}) {
    style = Object.hasOwn(STYLES, next.style) ? next.style : style;
    palette = Object.hasOwn(PALETTES, next.palette) ? next.palette : palette;
    root.dataset.style = style;
    const colors = PALETTES[palette];
    for (const [name, value] of Object.entries(colors)) if (name !== 'label') root.style.setProperty(`--frog-${name}`, value);
    root.querySelectorAll('[data-style-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.styleChoice === style)));
    root.querySelectorAll('[data-palette-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.paletteChoice === palette)));
    onPreferenceChange({ style, palette });
  }
  function setState(next) {
    if (!Object.hasOwn(STATES, next)) throw new TypeError('Unknown frog state');
    state = next; root.dataset.state = next; stateLabel.textContent = STATES[next];
    trigger.setAttribute('aria-label', `Sparky 小青蛙：${STATES[next]}，选择外观`);
  }
  function setCompact(next) { root.classList.toggle('frog--compact', Boolean(next)); }
  function setMessage(message) {
    stateLabel.textContent = message;
    trigger.setAttribute('aria-label', `Sparky 小青蛙：${message}，选择外观`);
  }
  setAppearance({ style, palette }); setState(state); setCompact(compact);
  return { root, setState, setAppearance, setCompact, setMessage, closePicker };
}
