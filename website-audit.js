(() => {
  const $ = id => document.getElementById(id);
  const API = '/api/website-audit';
  const CONTACT = 'hello@josephiwe.com';
  const MAILTO_LIMIT = 1800;
  const PREFILL_KEY = 'bw-audit-prefill';
  const STORE_KEY = 'bw-audit-report-v1';

  const start = $('auditStart');
  const reportSection = $('auditReport');
  const form = $('auditForm');
  const input = $('auditUrl');
  const loading = $('auditLoading');
  const fail = $('auditFail');
  let report = null;
  let lastUrl = '';
  let busy = false;

  /* Analytics hook, like the scanner's: the event never carries the address or findings. */
  const track = (name, data = {}) => {
    const detail = Object.assign({ event: `audit_${name}` }, data);
    window.dispatchEvent(new CustomEvent('bw:audit', { detail }));
    if (Array.isArray(window.dataLayer)) window.dataLayer.push(detail);
  };

  const setNoindex = on => {
    let meta = document.querySelector('meta[name="robots"]');
    if (on && !meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = 'noindex';
      document.head.appendChild(meta);
    } else if (!on && meta) meta.remove();
  };

  // Everything from the audited site is inserted as text, never as markup.
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  };
  const session = {
    get(key) { try { return window.sessionStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { window.sessionStorage.setItem(key, value); } catch (e) { /* storage unavailable */ } },
    remove(key) { try { window.sessionStorage.removeItem(key); } catch (e) { /* storage unavailable */ } }
  };

  /* Same shape check as the server, so obvious typos get an answer without a request. */
  const looksLikeUrl = value => {
    const text = value.trim();
    if (!text || text.length > 2048 || /\s/.test(text)) return false;
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      return /^https?:$/.test(url.protocol) && url.hostname.includes('.') && !url.username && !url.password;
    } catch (e) { return false; }
  };

  const show = which => {
    form.hidden = which !== 'form';
    loading.hidden = which !== 'loading';
    fail.hidden = which !== 'fail';
  };

  const showFail = (title, copy, canRetry) => {
    start.hidden = false;
    reportSection.hidden = true;
    show('fail');
    $('auditFailTitle').textContent = title;
    $('auditFailCopy').textContent = copy;
    $('auditRetry').hidden = !canRetry;
    $('auditFailTitle').focus();
  };

  const backToForm = focus => {
    report = null;
    session.remove(STORE_KEY);
    setNoindex(false);
    reportSection.hidden = true;
    start.hidden = false;
    show('form');
    window.scrollTo(0, 0);
    if (focus) input.focus();
  };

  const run = async url => {
    if (busy) return;
    busy = true;
    lastUrl = url;
    $('auditError').textContent = '';
    input.removeAttribute('aria-invalid');
    show('loading');
    track('start');
    let res;
    let data = null;
    try {
      res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }), credentials: 'same-origin' });
      data = await res.json().catch(() => null);
    } catch (e) {
      busy = false;
      track('error', { code: 'network' });
      showFail('We couldn’t reach the audit service.', 'Check your connection and try again.', true);
      return;
    }
    busy = false;
    if (!res.ok || !data || !data.report) {
      const code = data && data.error ? data.error.code : 'internal';
      const message = data && data.error && data.error.message ? data.error.message : 'Something went wrong on our side. Please try again.';
      track('error', { code });
      if (code === 'invalid_url' || code === 'blocked_destination') {
        show('form');
        $('auditError').textContent = message;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      const retry = ['timeout', 'unreachable', 'busy', 'internal', 'budget', 'rate_limited'].includes(code);
      showFail('We couldn’t audit that address.', message, retry);
      return;
    }
    report = data.report;
    session.set(STORE_KEY, JSON.stringify(report));
    renderReport();
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = input.value.trim();
    if (!looksLikeUrl(value)) {
      $('auditError').textContent = 'Enter a full website address, like example.com.';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    run(value);
  });
  $('auditRetry').addEventListener('click', () => run(lastUrl));
  $('auditChange').addEventListener('click', () => backToForm(true));
  $('auditAgain').addEventListener('click', () => { track('restart'); input.value = ''; backToForm(true); });

  /* ---------- Report ---------- */
  const hostOf = url => { try { return new URL(url).hostname; } catch (e) { return url; } };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const renderFinding = (f, index, kind) => {
    const card = el('article', `audit-finding sev-${f.severity.toLowerCase()}`);
    const id = `${kind}-${index}`;
    card.setAttribute('aria-labelledby', id);
    const tags = el('p', 'op-tags');
    tags.appendChild(el('span', `tag tag-sev tag-${f.severity.toLowerCase()}`, f.severity));
    tags.appendChild(el('span', 'tag', f.category));
    tags.appendChild(el('span', 'tag', f.type === 'confirmed' ? 'Confirmed' : 'Recommendation'));
    card.appendChild(tags);
    const title = el('h3', 'audit-finding-title', f.title);
    title.id = id;
    card.appendChild(title);
    const evidence = el('div', 'audit-evidence');
    evidence.appendChild(el('h4', 'op-h', 'Evidence'));
    const ul = el('ul');
    f.evidence.forEach(e => ul.appendChild(el('li', null, e)));
    evidence.appendChild(ul);
    card.appendChild(evidence);
    const grid = el('div', 'audit-finding-grid');
    const block = (heading, text) => { const b = el('div'); b.appendChild(el('h4', 'op-h', heading)); b.appendChild(el('p', null, text)); return b; };
    grid.appendChild(block('Why it matters', f.why));
    grid.appendChild(block('Recommended fix', f.fix));
    card.appendChild(grid);
    if (f.limits) card.appendChild(el('p', 'op-fine', `Confidence and limits: ${f.limits}`));
    return card;
  };

  const fillList = (container, items, kind, empty) => {
    container.textContent = '';
    if (!items.length) { container.appendChild(el('p', 'audit-empty', empty)); return; }
    items.forEach((f, i) => container.appendChild(renderFinding(f, i, kind)));
  };

  const summaryText = () => {
    const r = report;
    const lines = ['Hello BuildWise Group,', '', 'I ran the Website & AI Visibility Audit and would like help fixing the issues it found.', '', `Website: ${r.finalUrl}`, `Audited: ${r.auditedAt.slice(0, 10)}`, ''];
    if (r.confirmed.length) { lines.push('Confirmed findings:'); r.confirmed.forEach(f => lines.push(`- [${f.severity}] ${f.title}`)); lines.push(''); }
    if (r.advisory.length) { lines.push('Recommendations:'); r.advisory.forEach(f => lines.push(`- [${f.severity}] ${f.title}`)); lines.push(''); }
    lines.push('Name:', 'Company:', 'Best way to reach me:');
    return lines.join('\n');
  };

  const plainText = () => {
    const r = report;
    const rule = '-'.repeat(60);
    const lines = ['BuildWise Group · Website & AI Visibility Audit', `Website: ${r.finalUrl}`, `Audited: ${r.auditedAt}`, '', r.method, r.disclaimer, ''];
    const section = (title, items) => {
      lines.push(rule, title, rule);
      if (!items.length) lines.push('None.');
      items.forEach(f => {
        lines.push('', `[${f.severity}] ${f.title} (${f.category})`, 'Evidence:', ...f.evidence.map(e => `- ${e}`), `Why it matters: ${f.why}`, `Recommended fix: ${f.fix}`);
        if (f.limits) lines.push(`Confidence and limits: ${f.limits}`);
      });
      lines.push('');
    };
    section('CONFIRMED FINDINGS', r.confirmed);
    section('RECOMMENDATIONS', r.advisory);
    lines.push(rule, 'CRAWLER ACCESS (robots.txt permission only)', rule, ...r.crawlers.map(c => `${c.token} (${c.operator}, ${c.purposeLabel}): ${c.access}. ${c.rule}`), '');
    lines.push(rule, 'CHECKED AND FINE', rule, ...r.passed.map(p => `- ${p}`), '');
    lines.push(rule, 'NOT CHECKED', rule, ...r.notChecked.map(n => `- ${n.title}: ${n.reason}`), '');
    lines.push(rule, 'REQUESTS MADE', rule, ...r.requests.map(q => `${q.status} ${q.url}`));
    return lines.join('\n');
  };

  const mailto = (to, subject, body) => {
    const text = body.length > MAILTO_LIMIT ? `${body.slice(0, MAILTO_LIMIT)}…` : body;
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  };

  const renderReport = () => {
    const r = report;
    const site = hostOf(r.finalUrl);
    $('reportTitle').textContent = `Audit of ${site}`;
    const c = r.counts;
    const severe = ['Critical', 'High'].map(s => (c.bySeverity[s] ? `${c.bySeverity[s]} ${s.toLowerCase()}` : '')).filter(Boolean);
    $('reportSummary').textContent = c.confirmed
      ? `${plural(c.confirmed, 'confirmed issue')}${severe.length ? ` (${severe.join(', ')})` : ''} and ${plural(c.advisory, 'recommendation')}. Start with the issues at the top: they are ordered by severity.`
      : `No confirmed issues on this page, and ${plural(c.advisory, 'recommendation')} to consider. That covers what this audit can check; see below for what it could not.`;
    const meta = $('reportMeta');
    meta.textContent = '';
    const date = new Date(r.auditedAt).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    [`Audited ${date}`, `HTTP ${r.status}`, plural(r.requests.length, 'request'), 'Automated technical audit', 'No score: findings only'].forEach(t => meta.appendChild(el('li', null, t)));
    if (r.finalUrl !== r.requestedUrl) meta.appendChild(el('li', null, `Final address ${r.finalUrl}`));
    $('reportMethod').textContent = r.method;
    $('reportDisclaimer').textContent = r.disclaimer;

    const intro = $('reportIntro');
    intro.textContent = '';
    const i = r.introduction || {};
    [['Title', i.title], ['Main heading', i.h1], ['Description', i.description], ['Opening text', i.text]].forEach(([k, v]) => {
      const row = el('div');
      row.appendChild(el('dt', null, k));
      row.appendChild(el('dd', null, v || 'None found'));
      intro.appendChild(row);
    });

    fillList($('confirmedList'), r.confirmed, 'confirmed', 'No confirmed issues on this page.');
    fillList($('advisoryList'), r.advisory, 'advisory', 'No recommendations.');

    const rows = $('crawlerRows');
    rows.textContent = '';
    r.crawlers.forEach(cr => {
      const tr = el('tr', `is-${cr.access}`);
      const name = el('th');
      name.scope = 'row';
      const link = el('a', null, cr.token);
      link.href = /^https:\/\//.test(cr.docs) ? cr.docs : '#';
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      name.appendChild(link);
      name.appendChild(el('span', 'audit-operator', cr.operator));
      tr.appendChild(name);
      const purpose = el('td');
      purpose.appendChild(el('span', 'audit-purpose', cr.purposeLabel));
      purpose.appendChild(el('span', 'audit-note', cr.note));
      tr.appendChild(purpose);
      const labels = { allowed: 'Allowed', blocked: cr.purpose === 'ai-training' || cr.purpose === 'control' ? 'Opted out' : 'Blocked', unknown: 'Not checked' };
      tr.appendChild(el('td', 'audit-access', labels[cr.access]));
      tr.appendChild(el('td', 'audit-rule', cr.rule || 'robots.txt could not be read'));
      rows.appendChild(tr);
    });
    $('crawlerFine').textContent = `Crawler list reviewed ${r.crawlerReviewed}. Blocking training crawlers is a business choice, not an error, and does not affect search. Firewall or CDN bot settings can block crawlers regardless of robots.txt.`;

    const passed = $('passedList');
    passed.textContent = '';
    r.passed.forEach(p => passed.appendChild(el('li', null, p)));
    const notChecked = $('notCheckedList');
    notChecked.textContent = '';
    r.notChecked.forEach(n => {
      const li = el('li');
      li.appendChild(el('strong', null, n.title));
      li.appendChild(el('span', null, n.reason));
      notChecked.appendChild(li);
    });
    $('requestsSummary').textContent = `Requests made (${r.requests.length})`;
    const reqs = $('requestsList');
    reqs.textContent = '';
    r.requests.forEach(q => reqs.appendChild(el('li', null, `${q.status} ${q.url}`)));

    $('helpLink').href = mailto(CONTACT, `Website audit: ${site}`, summaryText());
    const business = r.confirmed.concat(r.advisory).some(f => f.category === 'Content and clarity');
    $('crossTitle').textContent = business ? 'Turn more visitors into enquiries' : 'Look beyond the website';
    $('crossCopy').textContent = business
      ? 'If the website is the front door, the next question is what happens after someone gets in touch. The AI Business Opportunity Scanner suggests where automation or software could help with enquiries, bookings and admin.'
      : 'If enquiries, bookings or admin are slowing you down, the AI Business Opportunity Scanner suggests where automation or software could help.';

    setNoindex(true);
    start.hidden = true;
    reportSection.hidden = false;
    window.scrollTo(0, 0);
    $('reportTitle').focus({ preventScroll: true });
    track('report_view', { confirmed: c.confirmed, advisory: c.advisory });
  };

  const toast = message => {
    const t = $('auditToast');
    t.textContent = message;
    t.classList.add('is-on');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => t.classList.remove('is-on'), 2600);
  };

  $('helpLink').addEventListener('click', () => track('help_request'));
  $('copySummary').addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(summaryText()); ok = true; } catch (e) { ok = false; }
    toast(ok ? `Summary copied. Paste it into an email to ${CONTACT}.` : `Copy failed. Please use the Request help button or email ${CONTACT}.`);
    track('help_copy', { ok });
  });
  $('saveDownload').addEventListener('click', () => {
    const blob = new Blob([plainText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = `buildwise-website-audit-${hostOf(report.finalUrl)}-${report.auditedAt.slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    track('report_download');
  });
  $('savePrint').addEventListener('click', () => { track('report_print'); window.print(); });

  /* ---------- Start ---------- */
  const prefill = session.get(PREFILL_KEY);
  if (prefill) { session.remove(PREFILL_KEY); if (looksLikeUrl(prefill)) input.value = prefill; }
  const saved = session.get(STORE_KEY);
  let restored = false;
  if (saved && !prefill) {
    try { report = JSON.parse(saved); restored = Boolean(report && report.finalUrl && Array.isArray(report.confirmed)); } catch (e) { restored = false; }
  }
  if (restored) { show('form'); renderReport(); } else { report = null; show('form'); }
})();
