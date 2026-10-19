/**
 * Markdown del agente → HTML sanitizado (escape primero; sin libs externas).
 * Soporta negritas, cursivas, listas y saltos de línea como en textAgentAPI.
 */
export function renderAgentMarkdown(md: string): string {
  const raw = String(md ?? '');
  if (!raw.trim()) return '';

  const escaped = escapeHtml(raw);
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${inline(para.join('<br>'))}</p>`);
    para = [];
  };
  const closeUl = () => {
    if (!inUl) return;
    out.push('</ul>');
    inUl = false;
  };

  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.+)$/);
    if (m) {
      flushPara();
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      closeUl();
      continue;
    }
    closeUl();
    para.push(line);
  }
  flushPara();
  closeUl();
  return out.join('');
}

function inline(text: string): string {
  // Primero negritas (** / __), luego cursivas simples (* / _)
  let s = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_\n]+?)_/g, '<em>$1</em>');
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
