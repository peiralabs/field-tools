/* ---- Model setup panel (FT-05..FT-08) --------------------------------------
   Rendered by AI.guard() when no model is reachable, and reachable afterwards
   from the small status chip so a reader can switch model without a reload.

   Everything written into the DOM here goes through esc(), and the model list
   returned by a provider is inserted with textContent rather than innerHTML —
   the reader may legitimately be pointing this at an endpoint we know nothing
   about, so its responses are treated as untrusted input. */
const LLMUI = (function () {
  'use strict';

  const esc = s => (window.LabProfile && LabProfile.esc)
    ? LabProfile.esc(s)
    : String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function options() {
    return Object.keys(LLM.PROVIDERS).map(id =>
      `<option value="${esc(id)}">${esc(LLM.PROVIDERS[id].label)}</option>`).join('');
  }

  /* A local endpoint reached from an HTTPS page cannot work — say so up front
     rather than letting the reader discover it as a failed request. */
  function localWarning(base) {
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(base || '');
    if (!isLocal) return '';
    if (location.protocol !== 'https:') return '';
    return `<p class="lw">This page is served over HTTPS, so the browser will refuse to reach ` +
      `<code>${esc(base)}</code>. Download this tool and serve it from <code>localhost</code> ` +
      `(<code>cors-server.py</code> in the repo does this) and the same settings will work.</p>`;
  }

  function render(el, opts) {
    opts = opts || {};
    const cfg = LLM.cfg;
    const cur = LLM.current();
    const pid = cur ? cur.id : '';
    const p = pid ? LLM.PROVIDERS[pid] : null;

    el.innerHTML =
      `<div class="llmset">
         <b>Point this tool at a model.</b>
         <p>${esc(opts.what || 'This tool')} needs a language model behind it. This page is a static
            file with no server, so it calls the provider you choose directly from your browser —
            your key goes to them, never to us.</p>
         <div class="lrow">
           <label>Provider
             <select class="lprov"><option value="">Choose…</option>${options()}</select>
           </label>
           <label class="lbase">Base URL
             <input class="linput lb" type="text" spellcheck="false" autocomplete="off" placeholder="https://…">
           </label>
         </div>
         <div class="lrow lkeyrow">
           <label class="lkey">API key
             <input class="linput lk" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your key">
           </label>
           <label class="lmodel">Model
             <input class="linput lm" type="text" list="llm-models" spellcheck="false" autocomplete="off" placeholder="model name">
             <datalist id="llm-models"></datalist>
           </label>
         </div>
         <div class="lopts">
           <label class="lchk"><input type="checkbox" class="lrem"> Remember the key on this device</label>
           <button class="lload" type="button">Load models</button>
         </div>
         <p class="lnote"></p>
         <div class="lwarn"></div>
         <div class="lact">
           <button class="go lsave" type="button">Use this model</button>
           ${opts.url ? `<a class="lalt" href="${esc(opts.url)}" target="_blank" rel="noopener">or run it on claude.ai with no key →</a>` : ''}
         </div>
         <p class="lpriv">The key is held for this browser tab only unless you tick remember, is never
            written into your Lab Profile, and is never sent anywhere except the provider you pick.</p>
       </div>`;

    const $ = s => el.querySelector(s);
    const prov = $('.lprov'), base = $('.lb'), key = $('.lk'), model = $('.lm'),
      rem = $('.lrem'), note = $('.lnote'), warn = $('.lwarn'), list = $('#llm-models');

    function sync() {
      const id = prov.value;
      const def = id ? LLM.PROVIDERS[id] : null;
      // Hide only the key field for keyless providers. Hiding the whole row would
      // take the model field with it, since the two share a row — which is exactly
      // what happened the first time, leaving Ollama users with nowhere to type a
      // model name.
      el.querySelector('.lkey').style.display = (def && def.auth === 'none') ? 'none' : '';
      if (def && !base.value) base.value = def.base || '';
      if (def && !model.value) model.value = def.model || '';
      note.textContent = def && def.keys ? '' : '';
      if (def && def.keys) {
        note.innerHTML = `Get a key: <a href="${esc(def.keys)}" target="_blank" rel="noopener">${esc(def.keys)}</a>`;
      } else if (def && def.local) {
        note.textContent = 'Ollama needs no key. It allows localhost origins by default; for any other ' +
          'origin set OLLAMA_ORIGINS on the server.';
      } else {
        note.textContent = '';
      }
      warn.innerHTML = localWarning(base.value);
    }

    prov.value = pid || '';
    base.value = cfg.base || (p ? p.base : '') || '';
    model.value = cfg.model || (p ? p.model : '') || '';
    key.value = LLM.getKey() || '';
    rem.checked = LLM.remembered();
    sync();

    prov.addEventListener('change', () => {
      const def = LLM.PROVIDERS[prov.value];
      base.value = def ? (def.base || '') : '';
      model.value = def ? (def.model || '') : '';
      sync();
    });
    base.addEventListener('input', sync);

    $('.lload').addEventListener('click', async function () {
      const btn = this;
      // Persist what is typed so listModels() sees it.
      LLM.setCfg({ provider: prov.value, base: base.value.trim(), model: model.value.trim() });
      if (key.value) LLM.setKey(key.value, rem.checked);
      btn.disabled = true; btn.textContent = 'Loading…';
      try {
        const ids = await LLM.listModels();
        list.textContent = '';
        ids.forEach(id => {
          const o = document.createElement('option');
          o.value = id;                       // value, not innerHTML — untrusted source
          list.appendChild(o);
        });
        note.textContent = ids.length + ' models available. Click the model box to pick one.';
        // Never auto-pick an embedding or reranking model: they are commonly the
        // first entry alphabetically (nomic-embed-text) and cannot answer a chat
        // request, so the reader's first run would fail for no visible reason.
        if (!model.value && ids.length) {
          const chat = ids.find(id => !/embed|bge-|e5-|gte-|rerank/i.test(id));
          if (chat) model.value = chat;
        }
      } catch (e) {
        note.textContent = e && e.message ? e.message : String(e);
      } finally {
        btn.disabled = false; btn.textContent = 'Load models';
      }
    });

    $('.lsave').addEventListener('click', () => {
      const id = prov.value;
      if (!id) { note.textContent = 'Choose a provider first.'; return; }
      const b = base.value.trim(), m = model.value.trim();
      if (!b) { note.textContent = 'A base URL is required.'; return; }
      if (!m) { note.textContent = 'A model name is required. Try "Load models".'; return; }
      LLM.setCfg({ provider: id, base: b, model: m });
      if (LLM.PROVIDERS[id].auth !== 'none') {
        if (!key.value.trim()) { note.textContent = 'This provider needs an API key.'; return; }
        LLM.setKey(key.value.trim(), rem.checked);
      }
      if (opts.onReady) opts.onReady();
    });

    if (!LLM.hasStorage()) {
      warn.innerHTML += `<p class="lw">Browser storage is unavailable here, so these settings last
        only until you reload.</p>`;
    }
  }

  /* Small persistent chip: shows what is in use and reopens the panel. */
  function chip(el, opts) {
    const c = LLM.current();
    if (!c) return;
    el.innerHTML = `<span class="llmchip">Model: <b>${esc(c.p.label)}</b> · <code>${esc(c.model)}</code>
      <button type="button" class="lchg">change</button></span>`;
    el.querySelector('.lchg').addEventListener('click', () => render(el, opts));
  }

  return { render, chip };
})();
