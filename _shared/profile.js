/* ---- Lab Profile: shared state across Peira Labs field tools ----
   One profile per browser origin. On peira.dev every tool reads and writes
   the same record, so a lab described once flows into all of them. Inside the
   claude.ai artifact sandbox localStorage is unavailable, so it degrades to
   in-memory for the session and the JSON export becomes the way to carry it. */
const LabProfile = (function () {
  const KEY = 'peira.lab.v1';
  const BLANK = { v:1, updated:null, services:[], scale:null, sizing:null,
                  nodes:[], guests:[], datasets:[], power:null, deps:null, handover:null };
  let mem = null, durable = false;
  try { localStorage.setItem('__pt', '1'); localStorage.removeItem('__pt'); durable = true; } catch (e) { durable = false; }

  const subs = [];
  const clone = o => JSON.parse(JSON.stringify(o));

  function get() {
    if (mem) return mem;
    if (durable) {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) { const o = JSON.parse(raw); if (o && o.v === 1) mem = Object.assign(clone(BLANK), o); }
      } catch (e) { /* corrupt or blocked — fall through to blank */ }
    }
    if (!mem) mem = clone(BLANK);
    return mem;
  }

  function persist() {
    if (!durable) return;
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* quota or blocked */ }
  }

  function set(patch) {
    const p = get();
    Object.assign(p, patch);
    p.v = 1;
    p.updated = new Date().toISOString().slice(0, 10);
    persist();
    subs.forEach(f => { try { f(p); } catch (e) {} });
    return p;
  }

  function clear() {
    mem = clone(BLANK);
    if (durable) { try { localStorage.removeItem(KEY); } catch (e) {} }
    subs.forEach(f => { try { f(mem); } catch (e) {} });
    return mem;
  }

  function isEmpty(p) {
    p = p || get();
    return !p.services.length && !p.nodes.length && !p.guests.length &&
           !p.datasets.length && !p.power && !p.deps && !p.handover && !p.sizing;
  }

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---- summary + AI context ---- */
  function summary(p) {
    p = p || get();
    const bits = [];
    if (p.nodes.length)    bits.push(p.nodes.length + ' node' + (p.nodes.length > 1 ? 's' : ''));
    if (p.guests.length)   bits.push(p.guests.length + ' guest' + (p.guests.length > 1 ? 's' : ''));
    if (p.services.length) bits.push(p.services.length + ' service' + (p.services.length > 1 ? 's' : ''));
    if (p.datasets.length) bits.push(p.datasets.length + ' data set' + (p.datasets.length > 1 ? 's' : ''));
    if (p.power)           bits.push('power plan');
    if (p.deps)            bits.push('dependency map');
    if (p.handover)        bits.push('handover');
    return bits.join(' · ');
  }

  // Compact plain-text description for AI tools to prepend as lab context.
  function ctx() {
    const p = get();
    if (isEmpty(p)) return '';
    const L = [];
    if (p.nodes.length)
      L.push('Nodes: ' + p.nodes.map(n => `${n.name} (${n.cores}c/${n.ram}GB)`).join(', '));
    if (p.guests.length)
      L.push('Guests: ' + p.guests.map(g => `${g.name} on ${g.node} (${g.cores}c/${g.ram}GB)`).join(', '));
    if (p.services.length) L.push('Services: ' + p.services.join(', '));
    if (p.datasets.length)
      L.push('Data sets: ' + p.datasets.map(d => `${d.name} ~${d.size}GB`).join(', '));
    if (p.power && p.power.ups) L.push(`UPS: ${p.power.ups}W load, ${p.power.runtime} min runtime`);
    return "The user's lab, from their saved profile (use it to make the answer specific; " +
           "do not assume anything not listed):\n" + L.join('\n');
  }

  /* ---- Markdown lab document ---- */
  const PRI_NAME = { 1:'critical', 2:'normal', 3:'best-effort' };
  function doc() {
    const p = get();
    const out = ['# Homelab field record', ''];
    out.push('Generated ' + (p.updated || new Date().toISOString().slice(0, 10)) +
             ' with the Peira Labs field tools (https://peira.dev/tools/).', '');
    if (isEmpty(p)) {
      out.push('_No lab details recorded yet. Fill in any field tool and press **Save to profile**._');
      return out.join('\n');
    }
    if (p.sizing) {
      out.push('## Sizing target', '',
        `- Cores: ${p.sizing.cores}`,
        `- RAM: ${p.sizing.ram} GB`,
        `- Live data: ${p.sizing.data} TB`,
        `- Backup space: ${p.sizing.backup} TB`);
      if (p.sizing.rec) out.push(`- Recommendation: ${p.sizing.rec}`);
      out.push('');
    }
    if (p.services.length) out.push('## Services', '', p.services.map(s => '- ' + s).join('\n'), '');
    if (p.nodes.length) {
      out.push('## Nodes', '', '| Node | Cores | RAM (GB) |', '|---|---|---|');
      p.nodes.forEach(n => out.push(`| ${n.name} | ${n.cores} | ${n.ram} |`));
      out.push('');
    }
    if (p.guests.length) {
      out.push('## Guests', '', '| Guest | Host node | Cores | RAM (GB) | Priority |', '|---|---|---|---|---|');
      p.guests.forEach(g => out.push(`| ${g.name} | ${g.node} | ${g.cores} | ${g.ram} | ${PRI_NAME[g.pri] || g.pri} |`));
      out.push('');
    }
    if (p.datasets.length) {
      out.push('## Data and backups', '', '| Data set | Size (GB) | Snapshots | 2nd device | Offsite | Cold |', '|---|---|---|---|---|---|');
      p.datasets.forEach(d => out.push(
        `| ${d.name} | ${d.size} | ${d.snap ? 'yes' : 'no'} | ${d.dev2 ? 'yes' : 'no'} | ${d.off ? 'yes' : 'no'} | ${d.cold ? 'yes' : 'no'} |`));
      out.push('');
    }
    if (p.power) {
      out.push('## Power loss', '');
      if (p.power.ups) out.push(`- UPS load: ${p.power.ups} W`, `- Estimated runtime: ${p.power.runtime} min`);
      if (p.power.shutdown && p.power.shutdown.length) {
        out.push('', '**Shutdown order** (first to last):', '');
        p.power.shutdown.forEach((m, i) => out.push(`${i + 1}. ${m}`));
      }
      if (p.power.boot && p.power.boot.length) {
        out.push('', '**Boot order** (first to last):', '');
        p.power.boot.forEach((m, i) => out.push(`${i + 1}. ${m}`));
      }
      out.push('');
    }
    if (p.deps && p.deps.items && p.deps.items.length) {
      out.push('## Dependencies', '', '| Service | Depends on |', '|---|---|');
      p.deps.items.forEach(it => out.push(`| ${it.name} | ${(it.needs || []).join(', ') || '—'} |`));
      if (p.deps.spof && p.deps.spof.length)
        out.push('', '**Single points of failure:** ' + p.deps.spof.join(', '));
      out.push('');
    }
    if (p.handover) {
      out.push('## If someone else has to run this', '');
      Object.keys(p.handover).forEach(k => {
        // entries are { q, a }; a bare string is an older profile, keyed by question text
        const v = p.handover[k];
        const q = (v && typeof v === 'object') ? v.q : k;
        const a = (v && typeof v === 'object') ? v.a : v;
        if (a) out.push(`### ${q}`, '', a, '');
      });
    }
    out.push('---', '', 'Built with free field tools at https://peira.dev/tools/');
    return out.join('\n');
  }

  /* ---- text modal (works where downloads are blocked) ----
     Returns the backdrop element so callers can extend it safely rather than
     re-querying the document (which would find an older modal if one is open). */
  function showText(title, desc, text, filename) {
    const back = document.createElement('div');
    back.className = 'pmodal';
    back.innerHTML =
      `<div class="pmbox"><h3>${esc(title)}</h3><p>${esc(desc)}</p>` +
      `<textarea readonly spellcheck="false"></textarea>` +
      `<div class="pmacts"><button class="pbtn" data-a="copy">Copy</button>` +
      `<button class="pbtn" data-a="dl">Download</button>` +
      `<button class="pbtn" data-a="close">Close</button></div></div>`;
    const ta = back.querySelector('textarea');
    ta.value = text;
    const close = () => back.remove();
    back.addEventListener('click', e => { if (e.target === back) close(); });
    back.querySelector('[data-a="close"]').onclick = close;
    back.querySelector('[data-a="copy"]').onclick = async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {}
      if (!ok) { try { ta.select(); ok = document.execCommand('copy'); } catch (e) {} }
      toast(ok ? 'Copied to clipboard' : 'Select the text and copy manually');
    };
    back.querySelector('[data-a="dl"]').onclick = () => {
      try {
        const url = URL.createObjectURL(new Blob([text], { type:'text/plain;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
      } catch (e) { toast('Download blocked here — use Copy'); }
    };
    document.body.appendChild(back);
    ta.focus();
    return back;
  }

  let toastEl = null;
  function toast(msg) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'ptoast';
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    const mine = toastEl;
    setTimeout(() => { if (mine === toastEl) { mine.remove(); toastEl = null; } }, 2600);
  }

  function importText(raw) {
    const o = JSON.parse(raw);
    if (!o || o.v !== 1) throw new Error('That is not a Peira lab profile (expected v1).');
    mem = Object.assign(clone(BLANK), o);
    persist();
    subs.forEach(f => { try { f(mem); } catch (e) {} });
    return mem;
  }

  /* ---- the bar ----
     opts: { el, save?: () => patch, load?: (profile) => void, syncs?: string } */
  function bar(opts) {
    opts = opts || {};
    const host = document.getElementById(opts.el || 'pbar');
    if (!host) return;

    function render() {
      const p = get();
      const empty = isEmpty(p);
      const s = summary(p);
      host.className = 'pbar' + (empty ? '' : ' on');
      const note = empty
        ? (durable ? 'No lab profile yet — tools on this site share one'
                   : 'Session-only profile (this sandbox blocks storage)')
        : 'Lab profile: ' + s + (durable ? '' : ' · session only');
      host.innerHTML =
        `<span class="pdot"></span><span class="ptxt">${esc(note)}</span>` +
        `<span class="pacts">` +
        (opts.save ? `<button class="pbtn" data-a="save" title="Write this tool's data into your shared lab profile">Save to profile</button>` : '') +
        (opts.load ? `<button class="pbtn" data-a="load"${empty ? ' disabled' : ''} title="Fill this tool in from your saved profile">Load</button>` : '') +
        `<button class="pbtn" data-a="doc"${empty ? ' disabled' : ''} title="Export your whole lab as a Markdown document">Lab doc</button>` +
        `<button class="pbtn" data-a="json" title="Export or import the profile as JSON">JSON</button>` +
        (empty ? '' : `<button class="pbtn" data-a="clear" title="Delete the saved profile">Clear</button>`) +
        `</span>`;

      host.querySelectorAll('.pbtn').forEach(b => b.onclick = () => act(b.dataset.a));
    }

    function act(a) {
      if (a === 'save') {
        try {
          const patch = opts.save();
          if (patch) { set(patch); toast('Saved to lab profile' + (durable ? '' : ' (session only)')); }
        } catch (e) { toast('Could not save: ' + e.message); }
      } else if (a === 'load') {
        // Load replaces what is on screen — that is more destructive than Clear,
        // which only drops the stored copy, so it gets the confirmation too.
        if (!confirm('Load from your lab profile? Anything you have typed into this tool will be replaced.')) return;
        try { opts.load(get()); toast('Loaded from lab profile'); }
        catch (e) { toast('Could not load: ' + e.message); }
      } else if (a === 'doc') {
        showText('Your lab, documented',
          'A Markdown record of everything your field tools know about this lab. Paste it into your notes, wiki, or repo.',
          doc(), 'homelab-field-record.md');
      } else if (a === 'json') {
        showJson();
      } else if (a === 'clear') {
        if (confirm('Delete the saved lab profile? This cannot be undone.')) { clear(); toast('Profile cleared'); }
      }
    }

    function showJson() {
      const back = showText('Lab profile (JSON)',
        'Copy this to move your profile to another browser, or into the claude.ai copies of these tools. To restore one, paste it in and press Import.',
        JSON.stringify(get(), null, 2), 'peira-lab-profile.json');
      const box = back.querySelector('.pmacts');
      const ta = back.querySelector('textarea');
      ta.removeAttribute('readonly');
      const b = document.createElement('button');
      b.className = 'pbtn'; b.textContent = 'Import';
      b.onclick = () => {
        try { importText(ta.value); toast('Profile imported'); back.remove(); }
        catch (e) { toast('Invalid profile: ' + e.message); }
      };
      box.insertBefore(b, box.firstChild);
    }

    subs.push(render);
    render();
  }

  return { get, set, clear, isEmpty, esc, summary, ctx, doc, bar, toast, showText,
           import: importText, durable, on: f => subs.push(f) };
})();
