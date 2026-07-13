/** Tooltip propio para celdas truncadas de DevExtreme DataGrid (clase `.inm-data-grid`). */

const TIP_CLASS = 'inm-cell-overflow-tip';
const SHOW_DELAY_MS = 60;
const HIDE_DELAY_MS = 40;

let tipEl: HTMLDivElement | null = null;
let showTimer: number | null = null;
let hideTimer: number | null = null;
let activeCell: HTMLElement | null = null;

function ensureTip(): HTMLDivElement {
  if (tipEl && document.body.contains(tipEl)) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = TIP_CLASS;
  tipEl.setAttribute('role', 'tooltip');
  tipEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tipEl);
  return tipEl;
}

function clearTimers(): void {
  if (showTimer != null) {
    window.clearTimeout(showTimer);
    showTimer = null;
  }
  if (hideTimer != null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function hideTip(): void {
  clearTimers();
  activeCell = null;
  if (!tipEl) return;
  tipEl.classList.remove('is-visible');
  tipEl.setAttribute('aria-hidden', 'true');
  tipEl.textContent = '';
}

function placeTip(anchor: HTMLElement, text: string): void {
  const tip = ensureTip();
  tip.textContent = text;
  tip.classList.add('is-visible');
  tip.setAttribute('aria-hidden', 'false');

  const pad = 10;
  const rect = anchor.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  let top = rect.top - tipRect.height - 8;

  if (top < pad) {
    top = rect.bottom + 8;
  }
  left = Math.max(pad, Math.min(left, window.innerWidth - tipRect.width - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - tipRect.height - pad));

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function isTruncated(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

function resolveTruncatedText(td: HTMLElement): string | null {
  if (td.closest('.dx-command-expand, .dx-editor-cell, .dx-datagrid-filter-row, .dx-header-row')) {
    return null;
  }
  if (td.querySelector('button, a, input, textarea, select, .btnAcciones, .mat-mdc-button-base')) {
    // Si hay controles, solo tooltip si un hijo de texto está truncado
  }

  const selectors = [
    '.dx-datagrid-text-content',
    '.inm-row-card__title',
    '.inm-cell-line',
    '.inm-cell-line--muted',
  ];

  const candidates: HTMLElement[] = [];
  for (const sel of selectors) {
    td.querySelectorAll(sel).forEach((n) => candidates.push(n as HTMLElement));
  }
  candidates.push(td);

  for (const el of candidates) {
    if (!isTruncated(el)) continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 0) return text;
  }
  return null;
}

function findDataCell(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const grid = target.closest('.inm-data-grid');
  if (!grid) return null;
  const td = target.closest('.dx-datagrid-rowsview tr.dx-data-row > td');
  return td instanceof HTMLElement ? td : null;
}

function onPointerOver(ev: Event): void {
  const td = findDataCell(ev.target);
  if (!td) return;
  if (td === activeCell) return;

  const text = resolveTruncatedText(td);
  if (!text) {
    hideTip();
    return;
  }

  clearTimers();
  activeCell = td;
  showTimer = window.setTimeout(() => {
    if (activeCell !== td) return;
    placeTip(td, text);
  }, SHOW_DELAY_MS);
}

function onPointerOut(ev: Event): void {
  const td = findDataCell(ev.target);
  if (!td || td !== activeCell) return;

  const next = (ev as MouseEvent).relatedTarget;
  if (next instanceof Node && td.contains(next)) return;
  if (tipEl && next instanceof Node && tipEl.contains(next)) return;

  clearTimers();
  hideTimer = window.setTimeout(() => hideTip(), HIDE_DELAY_MS);
}

function onScrollOrResize(): void {
  hideTip();
}

export function installInmGridOverflowTooltip(): void {
  if (typeof document === 'undefined') return;
  if ((window as any).__inmGridOverflowTipInstalled) return;
  (window as any).__inmGridOverflowTipInstalled = true;

  document.addEventListener('mouseover', onPointerOver, true);
  document.addEventListener('mouseout', onPointerOut, true);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
}
