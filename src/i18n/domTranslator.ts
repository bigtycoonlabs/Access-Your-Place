/**
 * Spanish for the portals, without rewriting every component.
 *
 * The portals hold several thousand English strings written straight into JSX. Rather than
 * route each one through t(), this swaps the interface text for its Spanish entry in the
 * dictionary (src/i18n/es.json, built by scripts/i18n/extract.cjs from the portal source)
 * and keeps doing so as React re-renders. It edits text in place (nodeValue and a few
 * attributes) and never replaces nodes, so React's own bookkeeping is untouched, and it
 * remembers the English so switching back restores it exactly.
 *
 * Nothing leaves the browser: no client data is sent to a translation service.
 *
 * Text that is not in the dictionary stays English. That includes what people typed
 * (names, messages, addresses), which is what we want. Mark anything that must never be
 * translated, such as a signed agreement's text, with translate="no".
 */

export interface Dictionary {
  /** English text (whitespace collapsed, trimmed) -> Spanish. */
  strings: Record<string, string>;
  /** English templates with {0}, {1} placeholders -> Spanish with the same placeholders. */
  templates: Record<string, string>;
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG']);

interface CompiledTemplate { re: RegExp; es: string; order: number[] }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compileTemplates(templates: Record<string, string>): CompiledTemplate[] {
  return Object.entries(templates)
    // Longest first, so the most specific template wins.
    .sort((a, b) => b[0].length - a[0].length)
    .map(([en, es]) => {
      const pattern = en.split(/(\{\d+\})/).map((part) => (/^\{\d+\}$/.test(part) ? '(.+?)' : escapeRe(part))).join('');
      // Which placeholder each capture group is, since Spanish may reorder them.
      const order = (en.match(/\{(\d+)\}/g) || []).map((m) => Number(m.slice(1, -1)));
      return { re: new RegExp(`^${pattern}$`, 's'), es, order };
    });
}

export class DomTranslator {
  private strings: Record<string, string>;
  private templates: CompiledTemplate[];
  private observer: MutationObserver | null = null;
  // English originals, and the Spanish we last wrote, for everything we touched.
  private textOriginal = new WeakMap<Text, string>();
  private textWritten = new WeakMap<Text, string>();
  private attrOriginal = new WeakMap<Element, Record<string, string>>();
  private attrWritten = new WeakMap<Element, Record<string, string>>();
  private touchedText = new Set<Text>();
  private touchedEls = new Set<Element>();
  private pending = new Set<Node>();
  private frame = 0;

  constructor(dict: Dictionary) {
    this.strings = dict.strings;
    this.templates = compileTemplates(dict.templates);
  }

  /** Spanish for one piece of English, or null when we have none. */
  translate(english: string): string | null {
    const key = english.replace(/\s+/g, ' ').trim();
    if (!key || !/[A-Za-z]/.test(key)) return null;
    const direct = this.strings[key];
    if (direct !== undefined) return direct;
    for (const t of this.templates) {
      const m = t.re.exec(key);
      if (!m) continue;
      const values: Record<number, string> = {};
      t.order.forEach((n, idx) => { values[n] = m[idx + 1]; });
      return t.es.replace(/\{(\d+)\}/g, (_, n) => values[Number(n)] ?? '');
    }
    return null;
  }

  private skip(el: Element | null): boolean {
    for (let e = el; e; e = e.parentElement) {
      if (SKIP_TAGS.has(e.tagName)) return true;
      if (e.getAttribute('translate') === 'no' || e.hasAttribute('data-no-translate')) return true;
      if ((e as HTMLElement).isContentEditable) return true;
    }
    return false;
  }

  private doText(node: Text) {
    const current = node.nodeValue || '';
    // React rewrote it since we last touched it: that is the new English.
    if (this.textWritten.get(node) !== current) this.textOriginal.set(node, current);
    const english = this.textOriginal.get(node) ?? current;
    const es = this.translate(english);
    if (es === null) {
      if (this.textWritten.has(node) && current !== english) node.nodeValue = english;
      this.textWritten.delete(node);
      return;
    }
    if (this.skip(node.parentElement)) return;
    const lead = english.match(/^\s*/)?.[0] ?? '';
    const trail = english.match(/\s*$/)?.[0] ?? '';
    const next = lead + es + trail;
    this.textWritten.set(node, next);
    this.touchedText.add(node);
    if (current !== next) node.nodeValue = next;
  }

  private doAttrs(el: Element) {
    if (this.skip(el)) return;
    for (const a of ATTRS) {
      const current = el.getAttribute(a);
      if (current === null) continue;
      const written = this.attrWritten.get(el) || {};
      const original = this.attrOriginal.get(el) || {};
      if (written[a] !== current) original[a] = current;
      const es = this.translate(original[a] ?? current);
      if (es === null) continue;
      written[a] = es;
      this.attrOriginal.set(el, original);
      this.attrWritten.set(el, written);
      this.touchedEls.add(el);
      if (current !== es) el.setAttribute(a, es);
    }
  }

  private walk(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) { this.doText(root as Text); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (SKIP_TAGS.has((root as Element).tagName)) return;
      this.doAttrs(root as Element);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n: Node | null = walker.nextNode();
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) this.doText(n as Text);
      else this.doAttrs(n as Element);
      n = walker.nextNode();
    }
  }

  private flush = () => {
    this.frame = 0;
    const nodes = [...this.pending];
    this.pending.clear();
    this.observer?.disconnect();
    for (const n of nodes) if (n.isConnected) this.walk(n);
    this.observe();
  };

  private observe() {
    this.observer?.observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: [...ATTRS],
    });
  }

  start() {
    if (this.observer) return;
    this.observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'childList') r.addedNodes.forEach((n) => this.pending.add(n));
        else this.pending.add(r.target);
      }
      if (!this.frame) this.frame = requestAnimationFrame(this.flush);
    });
    this.walk(document.body);
    this.observe();
  }

  /** Stop, and put every piece of English back. */
  stop() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending.clear();
    for (const t of this.touchedText) {
      const english = this.textOriginal.get(t);
      if (t.isConnected && english !== undefined && t.nodeValue === this.textWritten.get(t)) t.nodeValue = english;
    }
    for (const el of this.touchedEls) {
      const original = this.attrOriginal.get(el) || {};
      const written = this.attrWritten.get(el) || {};
      for (const [a, v] of Object.entries(original)) if (el.getAttribute(a) === written[a]) el.setAttribute(a, v);
    }
    this.touchedText.clear();
    this.touchedEls.clear();
  }
}
