(() => {
  const engine = window.BWScanner;
  const $ = id => document.getElementById(id);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STORE_KEY = 'bw-scan-draft-v1';
  const BRIEF_URL = 'brief/brief.json';
  const CONTACT = 'hello@josephiwe.com';
  const MAILTO_LIMIT = 1800;

  const scanner = $('scanner');
  const reportSection = $('report');
  const form = $('scanForm');
  const loading = $('scanLoading');
  const fail = $('scanFail');

  /* Analytics hook. Nothing leaves the page unless a site-wide analytics tool
   * listens for this event or provides window.dataLayer. Answers are never
   * included, only the step and the opportunity ids. */
  const track = (name, data = {}) => {
    const detail = Object.assign({ event: `scanner_${name}` }, data);
    window.dispatchEvent(new CustomEvent('bw:scanner', { detail }));
    if (Array.isArray(window.dataLayer)) window.dataLayer.push(detail);
  };

  /* A report view is never indexed. Crawlers cannot reach one (answers live after
   * "#" or in sessionStorage), but this keeps it that way if a renderer ever does. */
  const setNoindex = (on) => {
    let meta = document.querySelector('meta[name="robots"]');
    if (on && !meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = 'noindex';
      document.head.appendChild(meta);
    } else if (!on && meta) {
      meta.remove();
    }
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const list = (tag, items, className) => {
    const node = el(tag, className);
    items.forEach(item => node.appendChild(el('li', null, item)));
    return node;
  };
  const storage = {
    read() { try { return JSON.parse(window.sessionStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; } },
    write(value) { try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch (e) { /* storage unavailable */ } },
    clear() { try { window.sessionStorage.removeItem(STORE_KEY); } catch (e) { /* storage unavailable */ } }
  };

  const showFail = (title, copy, canRetry) => {
    scanner.hidden = false;
    reportSection.hidden = true;
    form.hidden = true;
    loading.hidden = true;
    fail.hidden = false;
    $('scanFailTitle').textContent = title;
    $('scanFailCopy').textContent = copy;
    $('scanRetry').hidden = !canRetry;
    $('scanFailTitle').focus();
  };

  if (!engine) {
    showFail('The scanner could not load.', 'Please refresh the page. If it keeps happening, email us and we will help directly.', false);
    return;
  }

  const QUESTIONS = engine.QUESTIONS;
  const blank = () => ({ industry: '', industryOther: '', stage: '', objective: '', bottleneck: '', tasks: [], tools: [], context: '' });

  let answers = blank();
  let step = 0;
  let furthest = 0;
  let skipped = new Set();
  let report = null;
  let busy = false;
  let started = false;
  let showingReport = false;

  const draft = storage.read();
  if (draft && draft.answers) {
    answers = Object.assign(blank(), engine.normalizeAnswers(draft.answers).answers);
    step = Math.min(Math.max(0, draft.step | 0), QUESTIONS.length - 1);
    furthest = Math.min(Math.max(step, draft.furthest | 0), QUESTIONS.length - 1);
    skipped = new Set(Array.isArray(draft.skipped) ? draft.skipped : []);
  }
  const save = () => storage.write({ answers, step, furthest, skipped: [...skipped], showReport: showingReport });

  /* ---------- Questionnaire ---------- */
  const steps = $('scanSteps');
  const renderRail = () => {
    steps.textContent = '';
    QUESTIONS.forEach((q, i) => {
      const li = el('li');
      let state = 'todo';
      if (i === step) state = 'current';
      else if (i <= furthest) state = skipped.has(q.id) ? 'skipped' : 'done';
      li.className = `is-${state}`;
      const inner = i <= furthest && i !== step ? el('button') : el('span');
      if (inner.tagName === 'BUTTON') {
        inner.type = 'button';
        inner.addEventListener('click', () => go(i));
      }
      if (i === step) li.setAttribute('aria-current', 'step');
      inner.className = 'scan-step-item';
      inner.appendChild(el('span', 'scan-step-n', String(i + 1).padStart(2, '0')));
      inner.appendChild(el('span', 'scan-step-t', q.short));
      if (state === 'skipped') inner.appendChild(el('span', 'sr-only', ' (skipped)'));
      if (state === 'done') inner.appendChild(el('span', 'sr-only', ' (answered)'));
      li.appendChild(inner);
      steps.appendChild(li);
    });
    $('scanMeter').style.transform = `scaleX(${step / QUESTIONS.length})`;
  };

  const optionInput = (q, option, type) => {
    const label = el('label', 'opt');
    const input = el('input');
    input.type = type;
    input.name = q.id;
    input.value = option.value;
    const current = answers[q.id];
    input.checked = Array.isArray(current) ? current.includes(option.value) : current === option.value;
    const box = el('span', 'opt-box');
    box.appendChild(el('span', 'opt-mark'));
    box.appendChild(el('span', 'opt-text', option.label));
    label.appendChild(input);
    label.appendChild(box);
    return label;
  };

  const renderStep = (focus) => {
    const q = QUESTIONS[step];
    const options = $('scanOptions');
    options.textContent = '';
    options.className = `scan-options scan-options-${q.type}`;
    $('scanCount').textContent = `Question ${step + 1} of ${QUESTIONS.length}${q.required ? '' : ' · Optional'}`;
    $('scanQuestion').textContent = q.title;
    $('scanHelp').textContent = q.help;
    $('scanError').textContent = '';
    $('scanFieldset').removeAttribute('aria-invalid');

    if (q.type === 'single' || q.type === 'multi') {
      q.options.forEach(option => options.appendChild(optionInput(q, option, q.type === 'single' ? 'radio' : 'checkbox')));
    }
    if (q.type === 'multi') {
      const enforceMax = () => {
        const boxes = [...options.querySelectorAll('input')];
        const count = boxes.filter(b => b.checked).length;
        boxes.forEach(b => { b.disabled = !b.checked && count >= q.max; });
      };
      options.addEventListener('change', enforceMax);
      enforceMax();
    }
    if (q.allowOther) {
      const wrap = el('div', 'opt-other');
      const id = 'scanOther';
      const label = el('label', 'sr-only', 'Describe your business');
      label.htmlFor = id;
      const input = el('input', 'scan-input');
      Object.assign(input, { id, type: 'text', maxLength: engine.LIMITS.otherText, placeholder: 'Describe your business (optional)', value: answers.industryOther, autocomplete: 'off' });
      wrap.appendChild(label);
      wrap.appendChild(input);
      wrap.hidden = answers.industry !== 'other';
      options.appendChild(wrap);
      options.addEventListener('change', event => {
        if (event.target.name !== q.id) return;
        wrap.hidden = event.target.value !== 'other';
        if (!wrap.hidden) input.focus();
      });
    }
    if (q.type === 'text') {
      const id = 'scanText';
      const label = el('label', 'sr-only', q.title);
      label.htmlFor = id;
      const area = el('textarea', 'scan-textarea');
      Object.assign(area, { id, rows: 5, maxLength: q.max, placeholder: q.placeholder, value: answers.context });
      const counter = el('p', 'scan-counter');
      counter.setAttribute('aria-live', 'polite');
      const updateCounter = () => { counter.textContent = `${area.value.length} / ${q.max}`; };
      area.addEventListener('input', updateCounter);
      updateCounter();
      options.appendChild(label);
      options.appendChild(area);
      options.appendChild(counter);
    }

    $('scanBack').hidden = step === 0;
    $('scanSkip').hidden = q.required;
    $('scanNextText').textContent = step === QUESTIONS.length - 1 ? 'See my report' : 'Continue';

    form.hidden = false;
    loading.hidden = true;
    fail.hidden = true;
    if (!motionQuery.matches) {
      form.classList.remove('is-entering');
      void form.offsetWidth;
      form.classList.add('is-entering');
    }
    renderRail();
    if (focus) $('scanQuestion').focus();
  };

  const readStep = () => {
    const q = QUESTIONS[step];
    if (q.type === 'single') {
      const checked = form.querySelector(`input[name="${q.id}"]:checked`);
      answers[q.id] = checked ? checked.value : '';
      if (q.allowOther) answers.industryOther = answers[q.id] === 'other' ? $('scanOther').value : '';
    } else if (q.type === 'multi') {
      answers[q.id] = [...form.querySelectorAll(`input[name="${q.id}"]:checked`)].map(i => i.value);
    } else {
      answers[q.id] = $('scanText').value;
    }
    answers = Object.assign(blank(), engine.normalizeAnswers(answers).answers);
  };

  const go = index => {
    readStep();
    step = Math.max(0, Math.min(QUESTIONS.length - 1, index));
    save();
    renderStep(true);
  };

  const advance = () => {
    if (!started) { started = true; track('start'); }
    if (step < QUESTIONS.length - 1) {
      step += 1;
      furthest = Math.max(furthest, step);
      save();
      renderStep(true);
    } else {
      generate();
    }
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    readStep();
    const q = QUESTIONS[step];
    const { errors } = engine.normalizeAnswers(answers);
    if (errors[q.id]) {
      $('scanError').textContent = errors[q.id];
      $('scanFieldset').setAttribute('aria-invalid', 'true');
      const first = form.querySelector('input:not([disabled])');
      if (first) first.focus();
      return;
    }
    const empty = Array.isArray(answers[q.id]) ? !answers[q.id].length : !answers[q.id];
    if (empty) skipped.add(q.id); else skipped.delete(q.id);
    track('step_complete', { step: step + 1, question: q.id, skipped: empty });
    advance();
  });

  $('scanSkip').addEventListener('click', () => {
    const q = QUESTIONS[step];
    answers[q.id] = Array.isArray(answers[q.id]) ? [] : '';
    skipped.add(q.id);
    track('step_complete', { step: step + 1, question: q.id, skipped: true });
    advance();
  });
  $('scanBack').addEventListener('click', () => go(step - 1));

  /* ---------- Report ---------- */
  const generate = () => {
    if (busy) return;
    busy = true;
    save();
    form.hidden = true;
    fail.hidden = true;
    loading.hidden = false;
    $('scanMeter').style.transform = 'scaleX(1)';
    window.setTimeout(() => {
      busy = false;
      try {
        report = engine.generateReport(answers);
      } catch (error) {
        const missing = error.fields ? Object.keys(error.fields)[0] : null;
        if (missing) {
          step = QUESTIONS.findIndex(q => q.id === missing);
          renderStep(true);
          $('scanError').textContent = error.fields[missing];
          return;
        }
        track('error', { stage: 'generate' });
        showFail('We couldn’t build your report.', 'Your answers are still here. Please try again.', true);
        return;
      }
      showReport(false);
    }, motionQuery.matches ? 150 : 900);
  };

  const shareUrl = () => `${location.origin}${location.pathname}#r=${engine.encodeAnswers(report.answers)}`;

  const renderOpportunity = (o, expanded) => {
    const card = el('article', 'op');
    card.dataset.rank = String(o.rank);
    card.setAttribute('aria-labelledby', `op-${o.id}`);

    const head = el('header', 'op-head');
    head.appendChild(el('span', 'op-rank', String(o.rank).padStart(2, '0')));
    const headText = el('div');
    const tags = el('p', 'op-tags');
    tags.appendChild(el('span', 'tag', `Priority ${o.rank}`));
    tags.appendChild(el('span', 'tag', o.kind));
    tags.appendChild(el('span', 'tag tag-match', o.match));
    headText.appendChild(tags);
    const title = el('h2', 'op-title', o.title);
    title.id = `op-${o.id}`;
    headText.appendChild(title);
    if (o.rankNote) headText.appendChild(el('p', 'op-ranknote', o.rankNote));
    head.appendChild(headText);
    card.appendChild(head);

    const why = el('div', 'op-why');
    why.appendChild(el('h3', 'op-h', 'Why this was selected for you'));
    why.appendChild(list('ul', o.reasons, 'op-list'));
    if (o.alternative) {
      const alt = el('p', 'op-alt');
      alt.appendChild(el('strong', null, `Also considered: ${o.alternative.title}. `));
      alt.appendChild(document.createTextNode(o.alternative.text));
      why.appendChild(alt);
    }
    card.appendChild(why);

    const block = (heading, content, className) => {
      const b = el('div', `op-block${className ? ` ${className}` : ''}`);
      b.appendChild(el('h3', 'op-h', heading));
      (Array.isArray(content) ? content : [content]).forEach(c => b.appendChild(typeof c === 'string' ? el('p', null, c) : c));
      return b;
    };

    const core = el('div', 'op-grid');
    core.appendChild(block('The problem it addresses', o.problem));
    core.appendChild(block('Proposed solution', o.solution));
    if (o.simplerFirst) core.appendChild(block('Before using AI', o.simplerFirst, 'op-simpler'));
    card.appendChild(core);

    const more = el('div', 'op-more');
    more.id = `op-more-${o.id}`;
    more.appendChild(block('How it would work', list('ol', o.how, 'op-list op-list-num')));
    more.appendChild(block('Possible benefits to validate', [list('ul', o.benefits, 'op-list'), el('p', 'op-fine', 'These are outcomes to test with the first experiment, not measured results. No savings or returns were estimated, because the scan does not collect financial inputs.')]));

    const meter = el('div', 'meter');
    meter.dataset.level = o.complexity.level;
    meter.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i += 1) meter.appendChild(el('i'));
    const level = el('p', 'meter-row');
    level.appendChild(meter);
    level.appendChild(el('strong', null, o.complexity.label));
    more.appendChild(block('Implementation complexity', [level, list('ul', o.complexity.notes, 'op-list')], 'op-complexity'));
    more.appendChild(block('Main dependencies', list('ul', o.dependencies, 'op-list')));
    more.appendChild(block('Risks and limitations', list('ul', o.risks, 'op-list')));
    more.appendChild(block('Suggested first experiment', o.experiment, 'op-experiment'));
    more.appendChild(block('Success metrics to track', [list('ul', o.metrics, 'op-list'), el('p', 'op-fine', 'Record a baseline before you start, so any change can be measured.')]));
    more.appendChild(block('To estimate costs, savings or ROI, we would need', list('ul', o.estimateInputs, 'op-list')));
    more.appendChild(block('Indicative implementation sequence', list('ol', o.sequence, 'seq'), 'op-seq'));

    const scoring = el('details', 'op-score');
    scoring.appendChild(el('summary', null, `How this was scored: ${o.score} points, ${o.match.toLowerCase()}`));
    const table = el('table');
    const caption = el('caption', 'sr-only', `Scoring for ${o.title}`);
    table.appendChild(caption);
    const tbody = el('tbody');
    const row = (label, points, kind) => {
      const tr = el('tr', kind ? `is-${kind}` : null);
      tr.appendChild(el('th', null, label));
      tr.appendChild(el('td', null, `${points > 0 ? '+' : ''}${points}`));
      tbody.appendChild(tr);
    };
    o.evidence.forEach(e => row(e.label, e.points, e.specific ? 'specific' : 'general'));
    o.adjustments.forEach(x => row(`Ranking only: ${x.label.charAt(0).toLowerCase()}${x.label.slice(1)}`, x.points, 'adjust'));
    table.appendChild(tbody);
    scoring.appendChild(table);
    scoring.appendChild(el('p', 'op-fine', `${o.match}: ${o.matchRule} Ranking adjustments change the order only, not the points or the label.`));
    more.appendChild(scoring);
    more.hidden = !expanded;
    card.appendChild(more);

    const toggle = el('button', 'op-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', more.id);
    const setToggle = open => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Hide the full plan' : 'Show the full plan';
    };
    setToggle(expanded);
    toggle.addEventListener('click', () => {
      const open = more.hidden;
      more.hidden = !open;
      setToggle(open);
      if (open) track('opportunity_expand', { opportunity: o.id, rank: o.rank });
    });
    card.appendChild(toggle);
    return card;
  };

  const summaryText = () => {
    const p = report.profile;
    const lines = [
      'Hello BuildWise Group,',
      '',
      'I used the AI Business Opportunity Scanner and would like to talk about implementing one of these opportunities.',
      '',
      `Business: ${p.industry}`,
      `Size: ${p.stage}`,
      `Objective: ${p.objective}`,
      `Bottleneck: ${p.bottleneck}`
    ];
    if (p.tasks.length) lines.push(`Repetitive tasks: ${p.tasks.join('; ')}`);
    if (p.tools.length) lines.push(`Tools: ${p.tools.join('; ')}`);
    if (p.context) lines.push(`Notes: ${p.context}`);
    lines.push('', 'Suggested opportunities:');
    report.opportunities.forEach(o => lines.push(`${o.rank}. ${o.title}`));
    lines.push('', `Report link: ${shareUrl()}`, '', 'Name:', 'Company:', 'Best way to reach me:');
    return lines.join('\n');
  };

  const mailto = (to, subject, body) => {
    let text = body;
    if (text.length > MAILTO_LIMIT) text = `${text.slice(0, MAILTO_LIMIT)}…`;
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  };

  const toast = message => {
    const t = $('scanToast');
    t.textContent = message;
    t.classList.add('is-on');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => t.classList.remove('is-on'), 2600);
  };

  const copy = async text => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const area = el('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      area.remove();
      return ok;
    }
  };

  const loadBrief = () => {
    const section = $('reportBrief');
    section.hidden = true;
    if (!window.fetch) return;
    fetch(BRIEF_URL, { cache: 'no-cache' })
      .then(res => (res.ok ? res.json() : null))
      .then(brief => {
        const items = brief ? engine.matchBrief(brief, report) : [];
        if (!items.length) return;
        const ul = $('briefList');
        ul.textContent = '';
        items.forEach(item => {
          const li = el('li', 'brief-item');
          if (item.date) li.appendChild(el('p', 'label', item.date));
          const h = el('h3');
          if (item.url) {
            const a = el('a', null, item.title);
            a.href = item.url;
            h.appendChild(a);
          } else h.textContent = item.title;
          li.appendChild(h);
          if (item.summary) li.appendChild(el('p', null, item.summary));
          ul.appendChild(li);
        });
        section.hidden = false;
      })
      .catch(() => { /* The brief is optional; the report stands on its own. */ });
  };

  const showReport = fromLink => {
    const r = report;
    $('reportTitle').textContent = r.headline;
    $('reportSummary').textContent = r.summary;
    const meta = $('reportMeta');
    meta.textContent = '';
    const date = new Date(r.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    [`Generated ${date}`, 'Rule-based, in your browser', r.general ? 'General starting points' : 'Matched to your answers', 'Not verified findings'].forEach(text => meta.appendChild(el('li', null, text)));
    if (fromLink) meta.appendChild(el('li', null, 'Opened from a link, without optional notes'));
    $('reportMethod').textContent = `${r.method} ${r.scoring}`;
    const sharpen = $('reportSharpen');
    $('sharpenList').textContent = '';
    r.sharpen.forEach(tip => $('sharpenList').appendChild(el('li', null, tip)));
    $('reportShortfall').textContent = r.shortfall;
    $('reportShortfall').hidden = !r.shortfall;
    sharpen.hidden = !r.sharpen.length;
    $('reportLimits').textContent = r.limits;

    const dl = $('reportAnswers');
    dl.textContent = '';
    const p = r.profile;
    [['Business', p.industry], ['Size', p.stage], ['Objective', p.objective], ['Bottleneck', p.bottleneck],
      ['Repetitive tasks', p.tasks.join(', ') || 'Skipped'], ['Tools', p.tools.join(', ') || 'Skipped'], ['Resources', p.capacity || 'Skipped'], ['Notes', p.context || 'None']]
      .forEach(([k, v]) => {
        const row = el('div');
        row.appendChild(el('dt', null, k));
        row.appendChild(el('dd', null, v));
        dl.appendChild(row);
      });

    const ops = $('reportOps');
    ops.textContent = '';
    r.opportunities.forEach((o, i) => ops.appendChild(renderOpportunity(o, i === 0)));

    const plan = $('reportPlan');
    plan.textContent = '';
    r.roadmap.forEach((s, i) => {
      const li = el('li', 'plan-step');
      li.appendChild(el('span', 'plan-n', String(i + 1).padStart(2, '0')));
      li.appendChild(el('h3', null, s.phase));
      li.appendChild(el('p', null, s.text));
      plan.appendChild(li);
    });

    const top = r.opportunities[0];
    $('exploreList').textContent = '';
    [...top.questions, 'What would a successful result look like in three months, and how would you measure it?']
      .forEach(q => $('exploreList').appendChild(el('li', null, q)));
    $('explorePanel').hidden = true;
    $('exploreToggle').setAttribute('aria-expanded', 'false');
    $('exploreToggle').textContent = `Show the questions for “${top.title}”`;

    $('helpLink').href = mailto(CONTACT, `Scanner report: ${top.title}`, summaryText());
    const selfBody = [r.headline, '', ...r.opportunities.map(o => `${o.rank}. ${o.title}\n   First experiment: ${o.experiment}`), '', `Full report: ${shareUrl()}`].join('\n');
    $('saveEmail').href = mailto('', 'My AI Business Opportunity report', selfBody);

    // Answers never stay in the address bar, so page analytics cannot record them.
    // The draft (with showReport) keeps the report across a reload of this tab.
    if (location.hash) {
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* file:// or sandboxed */ }
    }
    showingReport = true;
    setNoindex(true);
    save();
    scanner.hidden = true;
    reportSection.hidden = false;
    window.scrollTo(0, 0);
    $('reportTitle').focus({ preventScroll: true });
    loadBrief();
    track('report_view', { opportunities: r.opportunities.map(o => o.id), general: r.general, fromLink });
  };

  $('exploreToggle').addEventListener('click', () => {
    const panel = $('explorePanel');
    panel.hidden = !panel.hidden;
    $('exploreToggle').setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) track('explore_open', { opportunity: report.opportunities[0].id });
  });
  $('helpLink').addEventListener('click', () => track('help_request', { opportunity: report.opportunities[0].id }));
  $('copySummary').addEventListener('click', async () => {
    const ok = await copy(summaryText());
    toast(ok ? `Summary copied. Paste it into an email to ${CONTACT}.` : 'Copy failed. Please use the Request help button.');
    track('help_copy');
  });
  $('saveDownload').addEventListener('click', () => {
    const blob = new Blob([engine.toPlainText(report)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = `buildwise-opportunity-report-${report.generatedAt.slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    track('report_download');
  });
  $('savePrint').addEventListener('click', () => { track('report_print'); window.print(); });
  $('saveLink').addEventListener('click', async () => {
    const ok = await copy(shareUrl());
    toast(ok ? 'Link copied.' : 'Copy failed. You can copy the address from your browser bar.');
    track('report_copy_link');
  });
  $('saveEmail').addEventListener('click', () => track('report_email'));

  const backToQuestions = (reset) => {
    if (reset) {
      answers = blank();
      skipped = new Set();
      furthest = 0;
      storage.clear();
    }
    step = 0;
    report = null;
    showingReport = false;
    setNoindex(false);
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
    reportSection.hidden = true;
    scanner.hidden = false;
    window.scrollTo(0, 0);
    renderStep(true);
  };
  $('reportEdit').addEventListener('click', () => { furthest = QUESTIONS.length - 1; track('edit_answers'); backToQuestions(false); });
  $('sharpenEdit').addEventListener('click', () => { furthest = QUESTIONS.length - 1; track('edit_answers', { from: 'sharpen' }); backToQuestions(false); });
  $('reportRestart').addEventListener('click', () => { track('restart'); backToQuestions(true); });
  $('scanRestart').addEventListener('click', () => backToQuestions(true));
  $('scanRetry').addEventListener('click', generate);

  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('.op-more').forEach(m => { m.dataset.wasHidden = m.hidden ? '1' : ''; m.hidden = false; });
    document.querySelectorAll('.op-score').forEach(d => { d.open = true; });
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('.op-more').forEach(m => { if (m.dataset.wasHidden === '1') m.hidden = true; });
  });

  /* A different report link pasted into the address bar: start again from it. */
  window.addEventListener('hashchange', () => { if (/^#r=/.test(location.hash)) location.reload(); });

  /* ---------- Start ---------- */
  const hash = location.hash.match(/^#r=(.+)$/);
  if (hash) {
    try {
      answers = Object.assign(blank(), engine.decodeAnswers(decodeURIComponent(hash[1])));
      furthest = QUESTIONS.length - 1;
      report = engine.generateReport(answers);
      showReport(true);
    } catch (error) {
      track('error', { stage: 'link' });
      showFail('This report link could not be opened.', `${error.message} You can start a new scan; it takes about two minutes.`, false);
    }
  } else if (draft && draft.showReport) {
    try {
      report = engine.generateReport(answers);
      showReport(false);
    } catch (error) {
      renderStep(false);
    }
  } else {
    renderStep(false);
  }
})();
