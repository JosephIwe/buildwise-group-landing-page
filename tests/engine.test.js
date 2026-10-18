const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../scanner-engine.js');

const NOW = new Date('2026-10-17T12:00:00Z');
const base = { industry: 'trades', stage: 'small', objective: 'time', bottleneck: 'admin' };
const optionsOf = id => E.QUESTIONS.find(q => q.id === id).options.map(o => o.value);

test('questionnaire has eight questions with four required', () => {
  assert.equal(E.QUESTIONS.length, 8);
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
  const r = E.generateReport({ ...base, tasks: ['proposals', 'documents', 'data-entry'], tools: ['spreadsheets', 'accounting'], context: 'quotes and invoices' }, { now: NOW });
  assert.equal(r.opportunities.length, 3);
  assert.equal(new Set(r.opportunities.map(o => o.id)).size, 3);
  r.opportunities.forEach((o, i) => {
    assert.equal(o.rank, i + 1);
    for (const key of ['title', 'problem', 'solution', 'experiment', 'match']) assert.ok(o[key], `${o.id}.${key}`);
    for (const key of ['reasons', 'how', 'benefits', 'dependencies', 'risks', 'sequence', 'questions', 'metrics', 'estimateInputs', 'evidence']) assert.ok(o[key].length > 0, `${o.id}.${key}`);
    assert.ok(E.LEVELS.includes(o.complexity.level));
    assert.ok(o.complexity.notes.length > 0);
  });
  assert.ok(r.roadmap.length >= 3);
  assert.equal(r.generatedAt, NOW.toISOString());
});

test('the stated bottleneck drives the top recommendation', () => {
  optionsOf('bottleneck').filter(b => b !== 'unsure').forEach(bottleneck => {
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
          const text = JSON.stringify(r.opportunities) + r.headline + r.summary + JSON.stringify(r.roadmap) + r.sharpen.join(' ');
          assert.ok(!forbidden.test(text), `${industry}/${stage}/${objective}/${bottleneck}: ${text.match(forbidden)}`);
          count += 1;
        }
      }
    }
  }
  assert.equal(count, ['industry', 'stage', 'objective', 'bottleneck'].reduce((n, id) => n * optionsOf(id).length, 1));
});

test('recommendations are labelled as generated, not verified', () => {
  const r = E.generateReport(base);
  assert.match(r.method, /rule-based/i);
  assert.match(r.method, /No AI model, market research/);
  assert.match(r.limits, /not verified findings/);
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
  assert.match(r.limits, /general recommendations, not verified findings/);
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
  assert.match(joined, /“quote”/);
  assert.ok(!/which you already use/.test(joined), 'tools are not presented as reasons for selection');
  assert.ok(proposal.complexity.notes.some(n => /You already use a CRM/.test(n)), 'tools affect complexity instead');
});

test('note keywords only match at the start of a word', () => {
  const opp = E.LIBRARY.find(o => o.id === 'content-workflow');
  const a = E.normalizeAnswers({ ...base, context: 'We had to postpone the project' }).answers;
  assert.equal(E.scoreOpportunity(opp, a).parts.filter(p => p.type === 'keyword').length, 0);
});

test('weak signals are flagged as general starting points', () => {
  const weak = E.generateReport({ industry: 'other', stage: 'small', objective: 'costs', bottleneck: 'unsure' });
  assert.equal(weak.general, true);
  assert.match(weak.headline, /^Starting points/);
  assert.match(weak.summary, /general suggestions rather than matches/);
  assert.ok(weak.sharpen.some(t => /Pick the one area/.test(t)));
  weak.opportunities.forEach(o => assert.ok(['Partial match', 'General suggestion'].includes(o.match)));
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
    { title: 'Reading invoices with AI', summary: 'A worked example.', date: '2026-11', tags: ['admin-basics'], url: '/brief/invoices' },
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

/* ---------- Recommendation quality audit ---------- */
const P = {
  software: { industry: 'software', stage: 'growing', objective: 'experience', bottleneck: 'enquiries', tasks: ['same-questions', 'onboarding'], tools: ['crm', 'email', 'custom'], context: 'Most support tickets are how-do-I questions that our help docs already answer, but customers do not find them.' },
  appointments: { industry: 'health', stage: 'small', objective: 'time', bottleneck: 'scheduling', tasks: ['scheduling', 'same-questions'], tools: ['spreadsheets', 'email'], context: 'Reception spends hours on the phone booking and rescheduling, and we get no-shows.' },
  ecommerce: { industry: 'retail', stage: 'small', objective: 'experience', bottleneck: 'enquiries', tasks: ['same-questions', 'data-entry'], tools: ['ecommerce', 'email'], context: 'Most emails ask where is my order or how do returns work.' },
  budget: { industry: 'trades', stage: 'solo', objective: 'costs', bottleneck: 'admin', tasks: ['documents', 'chasing'], tools: ['spreadsheets', 'paper'], context: 'I do everything myself and have no budget for developers.' },
  vague: { industry: 'other', stage: 'small', objective: 'revenue', bottleneck: 'knowledge' }
};
const ids = r => r.opportunities.map(o => o.id);

test('profile: software company with enquiries gets a help centre before an AI assistant', () => {
  const r = E.generateReport(P.software);
  assert.equal(r.opportunities[0].id, 'help-centre');
  assert.equal(r.opportunities[0].match, 'Strong match');
  assert.equal(r.opportunities[0].alternative.id, 'enquiry-assistant');
  assert.ok(!ids(r).includes('enquiry-assistant'));
});

test('profile: appointment-based service business gets booking first and no filler', () => {
  const r = E.generateReport(P.appointments);
  assert.equal(r.opportunities[0].id, 'booking-automation');
  assert.equal(r.opportunities[0].match, 'Strong match');
  assert.ok(!ids(r).includes('document-processing'));
  assert.ok(!ids(r).includes('customer-portal'), 'no high-complexity portal on indirect evidence');
  r.opportunities.forEach(o => assert.ok(o.match !== 'General suggestion'));
  if (r.opportunities.length < 3) assert.match(r.shortfall, /closely enough to suggest/);
});

test('profile: e-commerce support gets order updates and a help centre, not the same fix twice', () => {
  const r = E.generateReport(P.ecommerce);
  assert.deepEqual(ids(r).slice(0, 2), ['order-updates', 'help-centre']);
  assert.ok(!ids(r).includes('customer-portal'));
  assert.ok(!ids(r).includes('enquiry-assistant'));
});

test('profile: limited budget with no technical team gets off-the-shelf software, not AI or custom builds', () => {
  const r = E.generateReport(P.budget);
  assert.equal(r.resources.level, 'diy');
  assert.equal(r.opportunities[0].id, 'admin-basics');
  assert.equal(r.opportunities[0].complexity.level, 'low');
  r.opportunities.forEach(o => {
    assert.notEqual(o.kind, 'AI');
    assert.notEqual(o.id, 'customer-portal');
    assert.ok(o.complexity.notes.some(n => /limited budget|no technical staff/i.test(n)), `${o.id} explains the resource constraint`);
  });
  assert.ok(!ids(r).includes('payment-followup'), 'payment reminders are covered by the off-the-shelf tool');
});

test('profile: vague answers produce clearly labelled starting points and tips', () => {
  const r = E.generateReport(P.vague);
  assert.equal(r.general, true);
  assert.match(r.headline, /^Starting points/);
  assert.match(r.summary, /nothing else you told us confirms it/);
  assert.ok(r.sharpen.length >= 3);
  assert.ok(r.opportunities.every(o => o.match === 'Partial match' || o.match === 'General suggestion'));
});

test('match labels follow their stated rules in every combination', () => {
  const tasks = optionsOf('tasks');
  for (const bottleneck of optionsOf('bottleneck')) {
    for (const t of [[], [tasks[0]], tasks.slice(1, 3), tasks.slice(3, 6)]) {
      for (const industry of ['retail', 'software', 'trades', 'other']) {
        const r = E.generateReport({ industry, stage: 'small', objective: 'time', bottleneck, tasks: t, context: 'quotes, invoices and bookings' });
        r.opportunities.forEach(o => {
          const direct = o.evidence.some(e => /^Addresses your biggest bottleneck/.test(e.label));
          const strongOthers = o.evidence.filter(e => /^Matches a repetitive task|^Your notes mention/.test(e.label)).length;
          if (o.match === 'Strong match') assert.ok(direct && strongOthers >= 2, `${o.id}: ${JSON.stringify(o.evidence)}`);
          if (o.match === 'Good match') assert.ok((direct && strongOthers === 1) || strongOthers >= 2, o.id);
          if (o.match === 'General suggestion') assert.ok(o.evidence.every(e => !e.specific), o.id);
          assert.equal(o.score, o.evidence.reduce((n, e) => n + e.points, 0), 'score is the sum of the shown evidence');
          assert.equal(o.matchRule, E.MATCH_RULES[o.match]);
        });
      }
    }
  }
});

test('labels never get weaker down the ranking, and each problem area appears once', () => {
  const tiers = ['General suggestion', 'Partial match', 'Good match', 'Strong match'];
  for (const industry of optionsOf('industry')) {
    for (const bottleneck of optionsOf('bottleneck')) {
      const r = E.generateReport({ industry, stage: 'growing', objective: 'costs', bottleneck, tasks: ['same-questions', 'documents'], context: 'invoices and where is my order' });
      const t = r.opportunities.map(o => tiers.indexOf(o.match));
      t.slice(1).forEach((v, i) => assert.ok(v <= t[i], `${industry}/${bottleneck}`));
      const areas = r.opportunities.map(o => o.area);
      assert.equal(new Set(areas).size, areas.length);
    }
  }
});

test('AI is only suggested when a specific answer points straight at it', () => {
  for (const bottleneck of optionsOf('bottleneck')) {
    for (const objective of optionsOf('objective')) {
      const r = E.generateReport({ industry: 'professional', stage: 'growing', objective, bottleneck });
      r.opportunities.filter(o => o.kind === 'AI').forEach(o => {
        assert.ok(o.evidence.some(e => /^Addresses|^Matches|^Your notes/.test(e.label)), `${o.id} for ${bottleneck}/${objective}`);
        assert.ok(o.simplerFirst, `${o.id} names a simpler first step`);
      });
    }
  }
  E.LIBRARY.filter(o => o.kind === 'AI').forEach(o => assert.ok(o.simplerFirst, o.id));
});

test('every pattern has success metrics and the inputs needed to estimate costs or savings', () => {
  E.LIBRARY.forEach(o => {
    assert.ok(o.metrics.length >= 2, o.id);
    assert.ok(o.estimateInputs.length >= 2, o.id);
    assert.ok(o.area, o.id);
    assert.ok(!/\d+ ?%|£|\$/.test(o.metrics.join(' ') + o.estimateInputs.join(' ')), `${o.id} sets no numeric targets`);
  });
});

test('resources: notes and size can indicate limited budget, and an answer overrides them', () => {
  const answers = extra => E.normalizeAnswers({ ...base, ...extra }).answers;
  assert.deepEqual(E.resourcesFor(answers({ context: 'Tight budget, no developer' })), { level: 'diy', inferred: 'notes' });
  assert.deepEqual(E.resourcesFor(answers({ stage: 'solo' })), { level: 'diy', inferred: 'stage' });
  assert.deepEqual(E.resourcesFor(answers({ stage: 'solo', capacity: 'team' })), { level: 'team', inferred: false });
  const team = E.generateReport({ ...P.software, capacity: 'team' });
  const diy = E.generateReport({ ...P.software, capacity: 'diy' });
  assert.ok(!ids(diy).includes('customer-portal'), 'portal is not suggested without budget or technical staff');
  assert.ok(team.opportunities.length >= diy.opportunities.length);
});

test('a profile with a not-sure bottleneck still ranks by tasks and notes', () => {
  const r = E.generateReport({ industry: 'professional', stage: 'small', objective: 'time', bottleneck: 'unsure', tasks: ['proposals'], context: 'Every quote takes hours' });
  assert.equal(r.opportunities[0].id, 'proposal-drafting');
  assert.match(r.summary + r.headline, /tasks and notes|Starting points/);
});
