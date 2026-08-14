/* ---- Bring-your-own-model layer (FT-05..FT-08) ------------------------------
   The AI tools were born inside claude.ai artifacts, where window.claude.complete
   exists and the viewer's own subscription pays. Everywhere else — including
   peira.dev — that API is absent, so this layer lets the reader point the same
   tool at a model they already pay for, or one they host themselves.

   Two facts decided the shape of this file, both measured on 2026-08-14 rather
   than assumed:

   1. Every hosted provider below answers a CORS preflight from a public HTTPS
      origin (OpenAI, Gemini and DeepSeek reflect the Origin; Anthropic, Groq and
      OpenRouter return *). So the browser can call them directly and the key
      never travels through anyone's server, including ours.

   2. A self-hosted Ollama CANNOT be reached from https://peira.dev, by two
      independent mechanisms: it answers a public Origin with 403, and it sends no
      Access-Control-Allow-Private-Network, which Chrome's Private Network Access
      rules now require for a public page to touch a private address. It does
      allow http://localhost:* and http://127.0.0.1:* with no configuration at
      all. So the local path is "download this file and serve it from localhost"
      (cors-server.py in this repo does exactly that) — we explain that rather
      than pretending it is a bug.

   The API key is deliberately NOT part of the Lab Profile. The profile is
   designed to be exported as JSON and rendered into a shareable lab record; a
   credential must never end up in either. It lives in sessionStorage (gone when
   the tab closes) unless the reader explicitly ticks "remember on this device". */
const LLM = (function () {
  'use strict';

  const V_ANTHROPIC = '2023-06-01';   // long-stable API version header

  const PROVIDERS = {
    openai: {
      label: 'OpenAI', style: 'openai', auth: 'bearer',
      base: 'https://api.openai.com/v1', model: 'gpt-4o-mini',
      keys: 'https://platform.openai.com/api-keys'
    },
    anthropic: {
      label: 'Anthropic', style: 'anthropic', auth: 'x-api-key',
      base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6',
      keys: 'https://console.anthropic.com/settings/keys'
    },
    gemini: {
      label: 'Google Gemini', style: 'gemini', auth: 'x-goog-api-key',
      base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash',
      keys: 'https://aistudio.google.com/apikey'
    },
    deepseek: {
      label: 'DeepSeek', style: 'openai', auth: 'bearer',
      base: 'https://api.deepseek.com', model: 'deepseek-chat',
      keys: 'https://platform.deepseek.com/api_keys'
    },
    groq: {
      label: 'Groq', style: 'openai', auth: 'bearer',
      base: 'https://api.groq.com/openai/v1', model: '',
      keys: 'https://console.groq.com/keys'
    },
    openrouter: {
      label: 'OpenRouter', style: 'openai', auth: 'bearer',
      base: 'https://openrouter.ai/api/v1', model: '',
      keys: 'https://openrouter.ai/keys'
    },
    ollama: {
      label: 'Ollama (self-hosted)', style: 'openai', auth: 'none', local: true,
      base: 'http://localhost:11434/v1', model: ''
    },
    custom: {
      label: 'Other OpenAI-compatible', style: 'openai', auth: 'bearer', custom: true,
      base: '', model: ''
    }
  };

  /* ---- storage -------------------------------------------------------------
     Config (which provider, which model, which base URL) is not secret and can
     persist. The key is separate and session-scoped by default. */
  const CFG_KEY = 'peiralabs.llm.cfg';
  const SEC_KEY = 'peiralabs.llm.key';

  function store(kind) {
    try {
      const s = kind === 'local' ? window.localStorage : window.sessionStorage;
      const probe = '__t' + Math.random();
      s.setItem(probe, '1'); s.removeItem(probe);
      return s;
    } catch (e) { return null; }   // private mode, disabled storage, file:// in some browsers
  }

  let memKey = '';                  // always the source of truth for this tab

  function loadCfg() {
    const s = store('local');
    if (!s) return {};
    try { return JSON.parse(s.getItem(CFG_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveCfg(cfg) {
    const s = store('local');
    if (s) { try { s.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }
  }

  function loadKey() {
    if (memKey) return memKey;
    for (const kind of ['session', 'local']) {
      const s = store(kind);
      if (s) { const v = s.getItem(SEC_KEY); if (v) { memKey = v; return v; } }
    }
    return '';
  }
  function saveKey(v, remember) {
    memKey = v || '';
    const ss = store('session'), ls = store('local');
    if (ss) { try { v ? ss.setItem(SEC_KEY, v) : ss.removeItem(SEC_KEY); } catch (e) {} }
    if (ls) {
      try { (v && remember) ? ls.setItem(SEC_KEY, v) : ls.removeItem(SEC_KEY); } catch (e) {}
    }
  }
  function remembered() {
    const ls = store('local');
    return !!(ls && ls.getItem(SEC_KEY));
  }
  function forget() { saveKey('', false); }

  let cfg = loadCfg();

  function current() {
    const id = cfg.provider && PROVIDERS[cfg.provider] ? cfg.provider : '';
    if (!id) return null;
    const p = PROVIDERS[id];
    return {
      id, p,
      base: (cfg.base || p.base || '').replace(/\/+$/, ''),
      model: cfg.model || p.model || ''
    };
  }

  /* Configured means: a provider is chosen, it has a model and a base, and a key
     exists unless the provider needs none. */
  function configured() {
    const c = current();
    if (!c || !c.base || !c.model) return false;
    if (c.p.auth === 'none') return true;
    return !!loadKey();
  }

  /* ---- request shapes ------------------------------------------------------ */
  function headers(c, key) {
    const h = { 'content-type': 'application/json' };
    if (c.p.auth === 'bearer') h['Authorization'] = 'Bearer ' + key;
    if (c.p.auth === 'x-api-key') {
      h['x-api-key'] = key;
      h['anthropic-version'] = V_ANTHROPIC;
      // Anthropic requires this opt-in before it will serve a browser origin.
      h['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    if (c.p.auth === 'x-goog-api-key') h['x-goog-api-key'] = key;
    return h;
  }

  function endpoint(c) {
    if (c.p.style === 'anthropic') return c.base + '/messages';
    if (c.p.style === 'gemini') return c.base + '/models/' + encodeURIComponent(c.model) + ':generateContent';
    return c.base + '/chat/completions';
  }

  function body(c, prompt) {
    if (c.p.style === 'anthropic') {
      // max_tokens is required by this API, unlike the others.
      return { model: c.model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] };
    }
    if (c.p.style === 'gemini') {
      return { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    }
    // Deliberately no max_tokens: OpenAI renamed it to max_completion_tokens for
    // newer models, and every provider here has a sane default. Omitting it is
    // the only spelling that works everywhere.
    return { model: c.model, messages: [{ role: 'user', content: prompt }] };
  }

  function extract(c, json) {
    try {
      if (c.p.style === 'anthropic') {
        const block = (json.content || []).find(b => b && b.type === 'text');
        return block ? block.text : '';
      }
      if (c.p.style === 'gemini') {
        const cand = (json.candidates || [])[0];
        if (!cand) return '';
        return ((cand.content && cand.content.parts) || []).map(p => p.text || '').join('');
      }
      const ch = (json.choices || [])[0];
      return ch && ch.message ? (ch.message.content || '') : '';
    } catch (e) { return ''; }
  }

  /* ---- error translation ---------------------------------------------------
     A blocked cross-origin or private-network request surfaces in JS as a bare
     TypeError with no detail, which is useless to someone trying to get a local
     model working. Turn the common cases into the actual reason. */
  function diagnose(err, c) {
    const httpsPage = location.protocol === 'https:';
    const base = c ? c.base : '';
    const isHttp = /^http:\/\//i.test(base);
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(base);

    if (err && err.name === 'TypeError') {
      if (httpsPage && isLocal) {
        return 'The browser blocked this page from reaching ' + base + '. A page served over HTTPS ' +
          'cannot call a local address: Chrome\'s Private Network Access rules require the local ' +
          'server to send an Access-Control-Allow-Private-Network header, and Ollama does not. ' +
          'Download this tool and serve it from localhost instead — cors-server.py in the repo does ' +
          'this — and the same settings will work.';
      }
      if (httpsPage && isHttp) {
        return 'The browser blocked this request. This page is HTTPS and ' + base + ' is plain HTTP, ' +
          'which counts as mixed content. Use an HTTPS endpoint, or run this tool locally.';
      }
      if (isLocal) {
        return 'Could not reach ' + base + '. Check the server is running, and that it allows this ' +
          'page\'s origin (' + location.origin + '). Ollama allows localhost origins by default but ' +
          'refuses others unless OLLAMA_ORIGINS is set.';
      }
      return 'Could not reach ' + (base || 'the endpoint') + '. That is usually a wrong base URL, ' +
        'no network, or a server that does not allow browser requests.';
    }
    return err && err.message ? err.message : String(err);
  }

  async function complete(prompt) {
    const c = current();
    if (!c) throw new Error('No model is set up yet.');
    const key = c.p.auth === 'none' ? '' : loadKey();
    if (c.p.auth !== 'none' && !key) throw new Error('No API key is set for ' + c.p.label + '.');

    let res;
    try {
      res = await fetch(endpoint(c), {
        method: 'POST',
        headers: headers(c, key),
        body: JSON.stringify(body(c, prompt))
      });
    } catch (e) {
      throw new Error(diagnose(e, c));
    }

    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = (j.error && (j.error.message || j.error.type)) || j.message || '';
      } catch (e) { /* body was not JSON */ }
      if (res.status === 401 || res.status === 403)
        throw new Error('The provider rejected the key (HTTP ' + res.status + ')' +
          (detail ? ': ' + detail : '') + '. Check it is valid and has access to ' + c.model + '.');
      if (res.status === 404)
        throw new Error('Not found (HTTP 404)' + (detail ? ': ' + detail : '') +
          '. That usually means the model name "' + c.model + '" is wrong for this provider, ' +
          'or the base URL is off. Try "Load models".');
      if (res.status === 429)
        throw new Error('Rate limited or out of quota (HTTP 429)' + (detail ? ': ' + detail : '') + '.');
      throw new Error('The provider returned HTTP ' + res.status + (detail ? ': ' + detail : '') + '.');
    }

    const json = await res.json();
    const text = extract(c, json);
    if (!text || !String(text).trim())
      throw new Error('The model returned nothing. Try again, or shorten the input.');
    return String(text);
  }

  /* Ask the provider what models the key can actually see, so a stale default in
     this file never becomes the reader's problem. */
  async function listModels() {
    const c = current();
    if (!c) throw new Error('Choose a provider first.');
    const key = c.p.auth === 'none' ? '' : loadKey();
    const url = c.p.style === 'gemini' ? c.base + '/models' : c.base + '/models';
    let res;
    try {
      res = await fetch(url, { headers: headers(c, key) });
    } catch (e) { throw new Error(diagnose(e, c)); }
    if (!res.ok) throw new Error('Could not list models (HTTP ' + res.status + ').');
    const j = await res.json();
    let ids = [];
    if (c.p.style === 'gemini') {
      ids = (j.models || []).map(m => String(m.name || '').replace(/^models\//, ''));
    } else {
      ids = (j.data || j.models || []).map(m => m.id || m.name || '');
    }
    return ids.filter(Boolean).sort();
  }

  return {
    PROVIDERS, current, configured, complete, listModels, diagnose,
    get cfg() { return cfg; },
    setCfg(next) { cfg = Object.assign({}, cfg, next); saveCfg(cfg); },
    getKey: loadKey, setKey: saveKey, remembered, forget,
    hasStorage: () => !!store('session')
  };
})();
