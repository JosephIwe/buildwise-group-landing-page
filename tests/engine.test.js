const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../scanner-engine.js');

const NOW = new Date('2026-10-17T12:00:00Z');
const base = { industry: 'trades', stage: 'small', objective: 'time', bottleneck: 'admin' };
const optionsOf = id => E.QUESTIONS.find(q => q.id === id).options.map(o => o.value);

test('questionnaire has seven questions with four required', () => {
  assert.equal(E.QUESTIONS.length, 7);
  assert.deepEqual(E.QUESTIONS.filter(q => q.required).map(q => q.id), ['industry', 'stage', 'objective', 'bottleneck']);
  E.QUESTIONS.forEach(q => assert.ok(q.title && q.short, `${q.id} has a title and short label`));
});

test('normalizeAnswers drops unknown values and enforces limits', () => {
  const { answers, errors, valid } = E.normalizeAnswers({
    industry: 'other', industryOther: 'x'.repeat(200), stage: 'galactic', objective: 'time', bottleneck: 'admin',
    tasks: ['data-entry', 'data-entry', 'nope', 'same-questions', 'proposals', 'chasing', 'reports', 'scheduling', 'documents'],
    tools: 'crm', context: `hello\u0000\u0007 ${'y'.repeat(900)}`
  });
  assert.equal(valid, false);
  assert.ok(errors.stage);
  assert.ok(errors.tasks, 'too many tasks is reported');
  assert.equal(answers.stage, '');
  assert.equal(answers.industryOther.length, E.LIMITS.otherText);
  assert.equal(answers.tasks.length, 6);
  assert.ok(!answers.tasks.includes('nope'));
  assert.deepEqual(answers.tools, []);
  assert.ok(answers.context.length <= E.LIMITS.context);
  assert.ok(!/[\u0000-\u0008]/.test(answers.context));
});

test('generateReport rejects missing required answers with field errors', () => {
  assert.throws(() => E.generateReport({ industry: 'retail' }), err => {
    assert.equal(err.code, 'INVALID_ANSWERS');
    assert.deepEqual(Object.keys(err.fields).sort(), ['bottleneck', 'objective', 'stage']);
    return true;
  });
  assert.throws(() => E.generateReport(null), /required/);
});

test('report has three distinct, complete, prioritised opportunities', () => {
  const r = E.generateReport({ ...base, tasks: ['proposals'], tools: ['spreadsheets'] }, { now: NOW });
  assert.equal(r.opportunities.length, 3);
  assert.equal(new Set(r.opportunities.map(o => o.id)).size, 3);
  r.opportunities.forEach((o, i) => {
    assert.equal(o.rank, i + 1);
    for (const key of ['title', 'problem', 'solution', 'experiment', 'match']) assert.ok(o[key], `${o.id}.${key}`);
    for (const key of ['reasons', 'how', 'benefits', 'dependencies', 'risks', 'sequence', 'questions']) assert.ok(o[key].length > 0, `${o.id}.${key}`);
    assert.ok(E.LEVELS.includes(o.complexity.level));
    assert.ok(o.complexity.notes.length > 0);
  });
  assert.ok(r.roadmap.length >= 3);
  assert.equal(r.generatedAt, NOW.toISOString());
});

test('the stated bottleneck drives the top recommendation', () => {
  optionsOf('bottleneck').forEach(bottleneck => {
    const r = E.generateReport({ ...base, objective: 'time', bottleneck });
    const top = E.LIBRARY.find(o => o.id === r.opportunities[0].id);
    assert.ok((top.signals.bottleneck || {})[bottleneck] >= 5, `${bottleneck} -> ${top.id}`);
    assert.match(r.opportunities[0].reasons[0], /biggest bottleneck/);
  });
});

test('launch objective at idea stage recommends validating the product first', () => {
  const r = E.generateReport({ industry: 'software', stage: 'idea', objective: 'launch', bottleneck: 'content' });
  assert.equal(r.opportunities[0].id, 'product-validation');
});

test('every combination produces a clean report without placeholders or invented figures', () => {
  const forbidden = /\{customers\}|\{work\}|\bundefined\b|\bNaN\b|%|£|\$|€|\bROI\b|guaranteed? (results|savings|returns)/;
  let count = 0;
  for (const industry of optionsOf('industry')) {
    for (const stage of optionsOf('stage')) {
      for (const objective of optionsOf('objective')) {
        for (const bottleneck of optionsOf('bottleneck')) {
          const r = E.generateReport({ industry, stage, objective, bottleneck });
          const text = JSON.stringify(r.opportunities) + r.headline + r.summary + JSON.stringify(r.roadmap);
          assert.ok(!forbidden.test(text), `${industry}/${stage}/${objective}/${bottleneck}: ${text.match(forbidden)}`);
          count += 1;
        }
      }
    }
  }
  assert.equal(count, 12 * 6 * 6 * 11);
});

test('recommendations are labelled as generated, not verified', () => {
  const r = E.generateReport(base);
  assert.match(r.method, /rule-based/i);
  assert.match(r.method, /No AI model, market research/);
  assert.match(r.limits, /not verified analysis/);
  assert.match(r.limits, /nothing here is a guaranteed outcome/i);
});

test('benefits are framed as possible outcomes, not typical or proven results', () => {
  E.LIBRARY.forEach(o => {
    o.benefits.forEach(b => {
      assert.match(b, /^(Could|Would|Keeps|Lets)\b/, `${o.id}: ${b}`);
      assert.ok(!/\b(typically|typical|proven|always|guarantee)/i.test(b), `${o.id}: ${b}`);
    });
    const text = JSON.stringify(o);
    assert.ok(!/\b(typically|proven|mature|most needs|will go back)\b/i.test(text), `${o.id} uses certain or typical wording`);
  });
});

test('every opportunity states costs and dependencies, and AI options require human review', () => {
  E.LIBRARY.forEach(o => {
    const deps = o.dependencies.join(' ');
    assert.ok(o.dependencies.length >= 3, o.id);
    assert.match(deps, /cost|subscription|budget|software|tool|platform/i, `${o.id} names something that costs money`);
    if (o.kind === 'AI') assert.match(`${deps} ${o.risks.join(' ')} ${o.how.join(' ')}`, /review|person|human/i, `${o.id} needs human review`);
  });
});

test('report explains it ranks a fixed library from the visitor\'s answers and may miss opportunities', () => {
  const r = E.generateReport(base);
  assert.match(r.method, new RegExp(`fixed library of ${E.LIBRARY.length}`));
  assert.match(r.method, /against the answers you gave/);
  assert.match(r.limits, /may miss opportunities/);
  assert.match(r.limits, /possible outcomes to test, not measured results/);
  assert.match(r.limits, /human review/);
});

test('report generation is deterministic', () => {
  const input = { ...base, tasks: ['documents', 'data-entry'], tools: ['accounting'], context: 'invoices everywhere' };
  assert.deepEqual(E.generateReport(input, { now: NOW }), E.generateReport(input, { now: NOW }));
});

test('complexity reflects existing tools and paper processes', () => {
  const opp = id => E.LIBRARY.find(o => o.id === id);
  const lead = { ...base, bottleneck: 'leads', objective: 'revenue' };
  assert.equal(E.assessComplexity(opp('lead-followup'), E.normalizeAnswers({ ...lead, tools: ['crm'] }).answers).level, 'low');
  assert.equal(E.assessComplexity(opp('lead-followup'), E.normalizeAnswers({ ...lead, tools: ['paper'] }).answers).level, 'high');
  const skipped = E.assessComplexity(opp('lead-followup'), E.normalizeAnswers(lead).answers);
  assert.equal(skipped.level, 'medium');
  assert.ok(skipped.notes.some(n => /skipped the tools question/.test(n)));
  const payments = E.assessComplexity(opp('payment-followup'), E.normalizeAnswers({ ...base, tools: ['spreadsheets'] }).answers);
  assert.equal(payments.level, 'medium');
});

test('reasons explain the answers that drove each match', () => {
  const r = E.generateReport({ ...base, tasks: ['proposals'], tools: ['crm'], context: 'We quote every job by hand.' });
  const proposal = r.opportunities.find(o => o.id === 'proposal-drafting');
  assert.ok(proposal, 'proposal drafting is selected');
  const joined = proposal.reasons.join(' ');
  assert.match(joined, /writing proposals or quotes/);
  assert.match(joined, /a CRM, which you already use/);
  assert.match(joined, /“quote”/);
});

test('note keywords only match at the start of a word', () => {
  const opp = E.LIBRARY.find(o => o.id === 'content-workflow');
  const a = E.normalizeAnswers({ ...base, context: 'We had to postpone the project' }).answers;
  assert.equal(E.scoreOpportunity(opp, a).parts.filter(p => p.type === 'keyword').length, 0);
});

test('weak signals are flagged as general starting points', () => {
  const r = E.generateReport({ industry: 'other', stage: 'solo', objective: 'decisions', bottleneck: 'people' });
  assert.equal(typeof r.general, 'boolean');
  const weak = E.generateReport({ industry: 'other', stage: 'idea', objective: 'costs', bottleneck: 'people' });
  if (weak.general) assert.match(weak.summary, /did not point strongly/);
});

test('share links round-trip without the optional notes and reject tampering', () => {
  const answers = E.normalizeAnswers({ ...base, industry: 'other', industryOther: 'Café & bakery', tasks: ['documents'], tools: ['paper'], context: 'private note' }).answers;
  const token = E.encodeAnswers(answers);
  assert.match(token, /^v1\.[A-Za-z0-9_-]+$/);
  const decoded = E.decodeAnswers(token);
  assert.equal(decoded.context, '');
  assert.equal(decoded.industryOther, 'Café & bakery');
  assert.deepEqual(decoded.tasks, ['documents']);
  assert.throws(() => E.decodeAnswers('v2.abc'), /not valid/);
  assert.throws(() => E.decodeAnswers('v1.!!!'), /not valid/);
  assert.throws(() => E.decodeAnswers(`v1.${'A'.repeat(1300)}`), /not valid/);
  assert.throws(() => E.decodeAnswers('v1.bm90LWpzb24'), /could not be read/);
  assert.throws(() => E.decodeAnswers(E.encodeAnswers({ industry: 'retail' })), /incomplete/);
});

test('matchBrief returns related items and sanitises links', () => {
  const r = E.generateReport(base);
  const brief = { items: [
    { title: 'Reading invoices with AI', summary: 'A worked example.', date: '2026-11', tags: ['document-processing'], url: '/brief/invoices' },
    { title: 'Unsafe', tags: ['admin'], url: 'javascript:alert(1)' },
    { title: 'Unrelated', tags: ['nothing'] },
    { tags: ['admin'] }
  ] };
  const items = E.matchBrief(brief, r);
  assert.deepEqual(items.map(i => i.title), ['Reading invoices with AI', 'Unsafe']);
  assert.equal(items[1].url, '');
  assert.deepEqual(E.matchBrief(null, r), []);
  assert.deepEqual(E.matchBrief({ items: 'bad' }, r), []);
});

test('plain-text export contains every report section', () => {
  const text = E.toPlainText(E.generateReport({ ...base, context: 'notes here' }, { now: NOW }));
  ['ABOUT THIS REPORT', 'YOUR ANSWERS', 'Why this was selected', 'Problem:', 'Proposed solution:', 'Possible benefits to validate', 'Implementation complexity', 'Dependencies', 'Risks and limitations', 'Suggested first experiment', 'Indicative sequence', 'INDICATIVE PLAN', 'Notes: notes here']
    .forEach(s => assert.ok(text.includes(s), s));
});
