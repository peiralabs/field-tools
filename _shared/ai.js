/* ---- AI helper shared by the Claude-powered field tools (FT-05..FT-08) ----
   These call window.claude.complete, which only exists inside a claude.ai
   artifact, so each viewer's own Claude subscription pays for the inference and
   the tool costs us nothing to run. On the self-hosted copy the API is absent:
   the tool renders a notice pointing at the claude.ai build instead of failing. */
const AI = (function () {

  const available = () => !!(window.claude && typeof window.claude.complete === 'function');

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

  /* Renders the "runs on claude.ai" notice on the self-hosted copy and returns
     false so callers can disable their submit control. */
  function guard(el, opts) {
    if (available()) return true;
    if (el) {
      el.innerHTML =
        `<div class="aioff"><b>This one thinks, so it lives on claude.ai.</b> ` +
        `${opts.what} needs a model behind it, and this page is a static file with no server and no API key. ` +
        `The working copy is published as a free, remixable artifact — ` +
        `<a href="${opts.url}" target="_blank" rel="noopener">open ${opts.name} on claude.ai →</a>` +
        `<span class="why">It runs on your own Claude account: nothing is sent to us, we pay nothing to run it, ` +
        `and you can fork it and change the prompt to suit your own lab.</span></div>`;
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
    if (!available())
      throw new Error('This tool needs to run inside claude.ai — open the published artifact there.');
    const r = await window.claude.complete(prompt);
    if (!r || !String(r).trim()) throw new Error('The model returned nothing. Try again, or shorten the input.');
    return String(r);
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

  return { available, md, add, thinking, guard, buildPrompt, complete, session };
})();
