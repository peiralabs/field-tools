/* ---- AI helper shared by the model-powered field tools (FT-05..FT-08) ----
   Two ways to get a model behind these tools, tried in that order:

   1. window.claude.complete — exists only inside a claude.ai artifact. Costs the
      reader nothing beyond the subscription they already have, and costs us
      nothing to run, so it stays the default wherever it is available.
   2. LLM — the bring-your-own-model layer, used everywhere else (including
      peira.dev). The reader points the tool at OpenAI, Anthropic, Gemini,
      DeepSeek, Groq, OpenRouter, a self-hosted Ollama, or any OpenAI-compatible
      endpoint. Their key goes straight from their browser to that provider.

   Before either existed the self-hosted copy simply refused to run and sent the
   reader to claude.ai, which meant four of the eleven tools did nothing on our
   own site. */
const AI = (function () {

  const artifact = () => !!(window.claude && typeof window.claude.complete === 'function');
  const available = () => artifact() || (typeof LLM !== 'undefined' && LLM.configured());

  /* Minimal markdown -> HTML. Deliberately small: it only has to render what
     the system prompts ask for (headings, bold, lists, code, fenced blocks).
     NOTE: the code-block sentinel is written as an \x00 ESCAPE, never as a raw
     control character — a literal control byte gets silently stripped when the
     file travels through a clipboard, which once broke a published tool. */
  function md(s) {
    const SENT = '\x00';
    s = String(s == null ? '' : s).split(SENT).join('');
    s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const blocks = [];
    s = s.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, code) => {
      blocks.push(code.replace(/\n+$/, ''));
      return SENT + (blocks.length - 1) + SENT;
    });

    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    // bold is already consumed above, so any surviving single * is emphasis
    s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

    const html = s.split(/\n{2,}/).map(par => {
      const out = [];
      let list = null, items = [];
      const flush = () => {
        if (list) { out.push(`<${list}>` + items.map(i => `<li>${i}</li>`).join('') + `</${list}>`); }
        list = null; items = [];
      };
      par.split('\n').forEach(line => {
        const t = line.trim();
        if (!t) return;
        const code = t.match(new RegExp('^' + SENT + '(\\d+)' + SENT + '$'));
        if (code) { flush(); out.push('<pre>' + blocks[+code[1]] + '</pre>'); return; }
        const h = t.match(/^(#{1,4})\s+(.*)$/);
        if (h) { flush(); out.push(`<h5>${h[2]}</h5>`); return; }
        const ol = t.match(/^\d+[.)]\s+(.*)$/);
        if (ol) { if (list !== 'ol') flush(); list = 'ol'; items.push(ol[1]); return; }
        const ul = t.match(/^[-*+]\s+(.*)$/);
        if (ul) { if (list !== 'ul') flush(); list = 'ul'; items.push(ul[1]); return; }
        flush();
        out.push(`<p>${t}</p>`);
      });
      flush();
      return out.join('');
    }).join('');

    // any sentinel left outside a paragraph of its own (inline code fence)
    return html.replace(new RegExp(SENT + '(\\d+)' + SENT, 'g'), (_, i) => '<pre>' + blocks[+i] + '</pre>');
  }

  function add(out, cls, html, label) {
    const d = document.createElement('div');
    d.className = 'msg ' + cls;
    d.innerHTML = (label ? `<h4>${label}</h4>` : '') + html;
    out.appendChild(d);
    d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return d;
  }

  function thinking(out, label) {
    const d = document.createElement('div');
    d.className = 'thinking';
    d.innerHTML = (label || 'Working through it') + ' <i>●</i><i>●</i><i>●</i>';
    out.appendChild(d);
    d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return d;
  }

  /* Returns true when a model is already reachable. When it is not, this renders
     the setup panel and parks the tool's run button until one is chosen — pass
     the button's id as opts.go and guard restores its original label on success. */
  function guard(el, opts) {
    opts = opts || {};
    const btn = opts.go ? document.getElementById(opts.go) : null;
    const label = btn ? btn.textContent : '';

    if (available()) {
      // Already set up via BYOK: leave a small chip so the choice is visible and changeable.
      if (el && !artifact() && typeof LLMUI !== 'undefined') LLMUI.chip(el, opts);
      return true;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Set up a model first'; }

    if (el && typeof LLMUI !== 'undefined') {
      LLMUI.render(el, {
        what: opts.what,
        url: opts.url,
        onReady: () => {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          LLMUI.chip(el, opts);
        }
      });
    }
    return false;
  }

  function buildPrompt(system, transcript, context) {
    return system +
      (context ? '\n\n' + context : '') + '\n\n' +
      transcript.map(t => (t.role === 'user' ? 'USER: ' : 'ASSISTANT: ') + t.text).join('\n\n') +
      '\n\nASSISTANT:';
  }

  async function complete(prompt) {
    if (artifact()) {
      const r = await window.claude.complete(prompt);
      if (!r || !String(r).trim()) throw new Error('The model returned nothing. Try again, or shorten the input.');
      return String(r);
    }
    if (typeof LLM !== 'undefined' && LLM.configured()) return LLM.complete(prompt);
    throw new Error('No model is set up yet. Choose a provider above, or open this tool on claude.ai.');
  }

  /* One-call conversation runner used by every AI tool. */
  function session(opts) {
    const out = document.getElementById(opts.out);
    const transcript = [];
    let busy = false;
    return {
      transcript,
      get busy() { return busy; },
      async send(userText, userLabel, userHtml) {
        if (busy) return;
        busy = true;
        if (userLabel) add(out, 'user', userHtml || md(userText), userLabel);
        transcript.push({ role: 'user', text: userText });
        const think = thinking(out, opts.thinking);
        try {
          const ctx = typeof opts.context === 'function' ? opts.context() : opts.context;
          const resp = await complete(buildPrompt(opts.system, transcript, ctx));
          transcript.push({ role: 'assistant', text: resp });
          think.remove();
          // opts.transform lets a tool pull structured data out of the reply and
          // render its own header for it: return { text, prefix } (both optional).
          let body = resp, prefix = '';
          if (opts.transform) {
            const t = opts.transform(resp) || {};
            if (t.text != null) body = t.text;
            if (t.prefix) prefix = t.prefix;
          }
          add(out, 'ai', prefix + md(body), opts.label || 'Answer');
          if (opts.onDone) opts.onDone(resp);
        } catch (e) {
          think.remove();
          add(out, 'err', md(e && e.message ? e.message : String(e)));
        } finally {
          busy = false;
        }
      }
    };
  }

  return { available, artifact, md, add, thinking, guard, buildPrompt, complete, session };
})();
