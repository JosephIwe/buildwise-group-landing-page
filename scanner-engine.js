/*
 * BuildWise AI Business Opportunity Scanner: report engine.
 *
 * A transparent, rule-based engine that runs entirely in the visitor's browser.
 * It does not call an AI model or any server. Each opportunity in LIBRARY lists
 * the answers that point towards it (signals); the engine scores the library
 * against the visitor's answers, explains which answers drove each match and
 * assembles a report from reviewed, pre-written content.
 *
 * Works as a browser global (window.BWScanner) and as a CommonJS module for tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BWScanner = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  const ENGINE_VERSION = '1.0.0';
  const LIMITS = { context: 600, otherText: 60, multi: 6 };

  /* ---------- Questions ---------- */
  const INDUSTRIES = [
    { value: 'professional', label: 'Professional services', customers: 'clients', work: 'engagements' },
    { value: 'retail', label: 'Retail & e-commerce', customers: 'customers', work: 'orders' },
    { value: 'hospitality', label: 'Hospitality & food', customers: 'guests', work: 'bookings' },
    { value: 'health', label: 'Health & wellness', customers: 'clients', work: 'appointments' },
    { value: 'trades', label: 'Construction & trades', customers: 'customers', work: 'jobs' },
    { value: 'property', label: 'Property & real estate', customers: 'clients', work: 'properties and deals' },
    { value: 'logistics', label: 'Logistics & transport', customers: 'customers', work: 'shipments' },
    { value: 'manufacturing', label: 'Manufacturing', customers: 'customers', work: 'orders' },
    { value: 'education', label: 'Education & training', customers: 'learners', work: 'courses and enrolments' },
    { value: 'finance', label: 'Finance & insurance', customers: 'clients', work: 'cases' },
    { value: 'software', label: 'Software & technology', customers: 'customers', work: 'accounts' },
    { value: 'other', label: 'Something else', customers: 'customers', work: 'work' }
  ];

  const QUESTIONS = [
    {
      id: 'industry', short: 'Business type', type: 'single', required: true, allowOther: true,
      title: 'What kind of business do you run?',
      help: 'Pick the closest fit. It shapes the language and examples in your report.',
      options: INDUSTRIES.map(({ value, label }) => ({ value, label }))
    },
    {
      id: 'stage', short: 'Size', type: 'single', required: true,
      title: 'How big is the business today?',
      help: 'An approximate answer is fine.',
      options: [
        { value: 'idea', label: 'Pre-launch or idea stage' },
        { value: 'solo', label: 'Just me' },
        { value: 'small', label: '2 to 10 people' },
        { value: 'growing', label: '11 to 50 people' },
        { value: 'established', label: '51 to 250 people' },
        { value: 'large', label: 'More than 250 people' }
      ]
    },
    {
      id: 'objective', short: 'Objective', type: 'single', required: true,
      title: 'What matters most over the next year?',
      help: 'Choose the one objective you would prioritise.',
      options: [
        { value: 'revenue', label: 'Grow revenue', focus: 'growing revenue' },
        { value: 'costs', label: 'Reduce costs', focus: 'reducing costs' },
        { value: 'time', label: 'Free up the team’s time', focus: 'freeing up the team’s time' },
        { value: 'experience', label: 'Improve the customer experience', focus: 'improving the customer experience' },
        { value: 'launch', label: 'Launch a new product or service', focus: 'launching a new product or service' },
        { value: 'decisions', label: 'Make better decisions with data', focus: 'making better decisions with data' }
      ]
    },
    {
      id: 'bottleneck', short: 'Bottleneck', type: 'single', required: true,
      title: 'Where does work get stuck most often?',
      help: 'Your biggest operational bottleneck carries the most weight in the report.',
      options: [
        { value: 'leads', label: 'Following up leads and sales' },
        { value: 'enquiries', label: 'Answering customer enquiries' },
        { value: 'scheduling', label: 'Scheduling and bookings' },
        { value: 'admin', label: 'Admin and paperwork' },
        { value: 'payments', label: 'Invoicing and getting paid' },
        { value: 'reporting', label: 'Reporting and finding the numbers' },
        { value: 'people', label: 'Hiring and onboarding' },
        { value: 'inventory', label: 'Stock, supply and orders' },
        { value: 'compliance', label: 'Quality, safety and compliance' },
        { value: 'content', label: 'Marketing and content' },
        { value: 'knowledge', label: 'Know-how stuck in a few people’s heads' }
      ]
    },
    {
      id: 'tasks', short: 'Repetitive tasks', type: 'multi', required: false, max: LIMITS.multi,
      title: 'Which tasks repeat every week?',
      help: 'Optional. Select up to six.',
      options: [
        { value: 'data-entry', label: 'Copying data between systems' },
        { value: 'same-questions', label: 'Answering the same questions' },
        { value: 'proposals', label: 'Writing proposals or quotes' },
        { value: 'chasing', label: 'Chasing payments or approvals' },
        { value: 'reports', label: 'Putting reports together' },
        { value: 'scheduling', label: 'Arranging appointments' },
        { value: 'documents', label: 'Processing invoices, forms or documents' },
        { value: 'content', label: 'Writing posts, emails or listings' },
        { value: 'onboarding', label: 'Onboarding customers or staff' }
      ]
    },
    {
      id: 'tools', short: 'Current tools', type: 'multi', required: false, max: 9,
      title: 'What do you run the business on today?',
      help: 'Optional. This helps judge how hard each change would be.',
      options: [
        { value: 'spreadsheets', label: 'Spreadsheets' },
        { value: 'email', label: 'Shared email inbox' },
        { value: 'crm', label: 'A CRM' },
        { value: 'accounting', label: 'Accounting software' },
        { value: 'booking', label: 'A booking system' },
        { value: 'ecommerce', label: 'An e-commerce platform' },
        { value: 'pm', label: 'Project or task management' },
        { value: 'custom', label: 'An in-house system' },
        { value: 'paper', label: 'Mostly paper or manual' }
      ]
    },
    {
      id: 'context', short: 'Anything else', type: 'text', required: false, max: LIMITS.context,
      title: 'Anything else we should know?',
      help: 'Optional. Describe a process, a frustration or a goal in your own words.',
      placeholder: 'For example: we quote every job by hand from an old spreadsheet and it takes most evenings.'
    }
  ];

  const QUESTION_MAP = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
  const LEVELS = ['low', 'medium', 'high'];
  const LEVEL_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

  /* ---------- Opportunity library ----------
   * signals.bottleneck / tasks / objective / tools / industries / stages map an
   * answer value to a weight. keywords are matched against the optional notes.
   * {customers} and {work} are replaced with the visitor's industry wording.
   */
  const LIBRARY = [
    {
      id: 'lead-followup', kind: 'Automation', title: 'Instant lead response and follow-up',
      signals: {
        bottleneck: { leads: 6, enquiries: 2 }, tasks: { chasing: 2, 'data-entry': 1 },
        objective: { revenue: 3, experience: 1 }, tools: { crm: 1, email: 1 }, stages: { idea: -3 },
        keywords: ['lead', 'follow up', 'follow-up', 'sales', 'prospect', 'pipeline', 'conversion']
      },
      problem: 'New enquiries wait for a reply, details are retyped into different places and follow-ups depend on someone remembering. Interested {customers} cool off before anyone gets back to them.',
      solution: 'Capture every enquiry in one place, reply straight away with a useful first response and schedule follow-ups automatically, with a person stepping in wherever judgement is needed.',
      how: [
        'Enquiries from your website, email and forms land in a single list or CRM.',
        'An AI step sorts each enquiry and drafts a tailored first reply for a person to approve. Simple cases get an approved template.',
        'Follow-ups are scheduled until the lead replies or is closed.',
        'Everyone can see the status of each lead.'
      ],
      benefits: ['Faster first replies to new {customers}', 'Fewer leads lost to forgotten follow-ups', 'A clearer picture of where enquiries come from and what happens to them'],
      complexity: { level: 'medium', why: 'It uses standard tools, but your lead sources need connecting and reply templates need agreeing.', easierWith: ['crm'] },
      integrates: true, digital: true,
      dependencies: ['One place to hold leads (a CRM or a well-structured spreadsheet)', 'Access to the channels enquiries arrive through', 'Agreed reply templates and a named owner for each lead'],
      risks: ['Generic automated replies can put people off, so keep a person reviewing drafts at first', 'Enquiries contain personal data that must be handled in line with privacy law, such as UK GDPR', 'Too many follow-ups annoy people, so set sensible limits'],
      experiment: 'For two weeks, route every new enquiry from one channel into a single list and send a drafted first reply within the hour. Compare reply times before and after, and count how many enquiries turned into a conversation.',
      sequence: ['Map where enquiries arrive today and who answers them', 'Centralise one channel and agree reply templates', 'Add drafted replies with human approval', 'Add automated follow-ups and connect the remaining channels'],
      questions: ['Where do your best {customers} usually first get in touch?', 'How quickly do you reply today, and does speed matter in your market?', 'Who should own a lead once it arrives?']
    },
    {
      id: 'enquiry-assistant', kind: 'AI', title: 'Answer routine questions with a grounded assistant',
      signals: {
        bottleneck: { enquiries: 6, knowledge: 1 }, tasks: { 'same-questions': 4 },
        objective: { experience: 3, time: 2, costs: 1 }, tools: { email: 1, booking: 1, ecommerce: 1 }, stages: { idea: -3 },
        keywords: ['question', 'faq', 'enquir', 'support', 'customer service', 'chat', 'phone', 'calls', 'inbox']
      },
      problem: 'Your team spends much of the day answering the same questions from {customers}, which slows down replies to the questions that genuinely need a person.',
      solution: 'An assistant that answers routine questions using only information you have approved, such as prices, policies, hours and process, and hands everything else to your team with the conversation attached.',
      how: [
        'Collect the questions you are asked most and write approved answers for them.',
        'The assistant answers on your website or drafts replies in your inbox, drawing only on that approved content.',
        'Anything outside that content, or anything sensitive, goes to a person.',
        'You review conversations weekly and add missing answers.'
      ],
      benefits: ['Quicker answers for {customers}, including outside working hours', 'Less repetitive work for the team', 'A written record of what {customers} actually ask'],
      complexity: { level: 'medium', why: 'The technology is mature. The work is in writing good source content and deciding when to hand over to a person.' },
      integrates: false, digital: true,
      dependencies: ['An up-to-date set of approved answers', 'A chosen channel: website chat, email drafts or messaging', 'An AI model provider, whose running cost grows with usage'],
      risks: ['AI models can give confident but wrong answers, so restrict them to approved content and log every conversation', 'Some {customers} prefer a person, so make handover easy', 'Questions about health, money or legal matters need strict limits'],
      experiment: 'Pull your last 50 customer questions, group them and write approved answers for the top ten. Use them as suggested replies in your inbox for two weeks and count how many needed editing.',
      sequence: ['Collect and group recent questions', 'Write approved answers and handover rules', 'Pilot as suggested replies that staff review', 'Open a customer-facing channel once accuracy is consistently acceptable'],
      questions: ['Which questions take the most time each week?', 'Which topics must always go to a person?', 'Where do {customers} prefer to ask: website, email, phone or messaging?']
    },
    {
      id: 'booking-automation', kind: 'Automation', title: 'Self-serve booking with automatic reminders',
      signals: {
        bottleneck: { scheduling: 6 }, tasks: { scheduling: 4, chasing: 1 },
        objective: { time: 2, experience: 2, revenue: 1 }, tools: { booking: 1, email: 1 },
        industries: { hospitality: 2, health: 2, trades: 1, education: 1, professional: 1 },
        keywords: ['booking', 'appointment', 'schedul', 'calendar', 'no-show', 'no show', 'reschedul', 'diary']
      },
      problem: 'Arranging {work} takes rounds of back-and-forth, double bookings slip in, and missed appointments cost time that cannot be recovered.',
      solution: 'Let {customers} book, change and cancel within rules you set, with confirmations and reminders sent automatically and your calendar kept in sync.',
      how: [
        'Set your availability, durations, buffers and cancellation rules once.',
        '{customers} book online at a time that suits them.',
        'Confirmations and reminders go out automatically by email or text.',
        'Bookings appear in your team’s calendars and in any system that needs them.'
      ],
      benefits: ['Less time spent arranging {work}', 'Fewer double bookings and, typically, fewer missed appointments', 'Easier booking for {customers} at any hour'],
      complexity: { level: 'low', why: 'Off-the-shelf booking tools cover most needs. The work is configuring your rules and connecting calendars.', easierWith: ['booking'] },
      integrates: true, digital: true,
      dependencies: ['A booking tool that fits how you work', 'Shared calendars for the people being booked', 'Clear rules for availability and cancellations'],
      risks: ['Rigid rules can frustrate {customers} with unusual needs, so keep a way to contact a person', 'Reminder messages need consent and an easy opt-out', 'Calendar sync must be reliable or double bookings return'],
      experiment: 'Offer online booking for one service or one team member for a month, with an automatic reminder the day before. Note how much scheduling back-and-forth disappears and whether missed appointments change.',
      sequence: ['Write down your booking rules and exceptions', 'Set up a booking tool for one service', 'Add reminders and calendar sync', 'Roll out to the remaining services and connect payments if useful'],
      questions: ['Which {work} cause the most back-and-forth to arrange?', 'How often do appointments get missed or moved at short notice?', 'Should {customers} pay or leave a deposit when they book?']
    },
    {
      id: 'document-processing', kind: 'AI', title: 'Automated document intake and data extraction',
      signals: {
        bottleneck: { admin: 5, payments: 2, compliance: 2 }, tasks: { documents: 5, 'data-entry': 3 },
        objective: { costs: 3, time: 3 }, tools: { accounting: 1, email: 1 }, stages: { idea: -3 },
        keywords: ['invoice', 'receipt', 'form', 'pdf', 'paperwork', 'document', 'scan', 'data entry', 'typing', 'retyp']
      },
      problem: 'Information arrives in invoices, forms, PDFs and emails, and someone retypes it into your systems. It is slow, prone to errors and grows with every new customer or supplier.',
      solution: 'Use AI document extraction to read incoming documents, pull out the fields you need and place them in your systems, with a person checking anything the system is unsure about.',
      how: [
        'Documents arrive in a dedicated inbox or upload folder.',
        'An extraction step reads each one and pulls out agreed fields such as dates, amounts, names and references.',
        'Uncertain fields are flagged for a quick human check.',
        'Approved data goes into your accounting software, spreadsheet or database.'
      ],
      benefits: ['Less manual retyping', 'Fewer keying errors reaching your records', 'Capacity to handle more volume without adding admin time'],
      complexity: { level: 'medium', why: 'It is reliable for consistent document types. Mixed layouts or handwriting need more testing and review.', easierWith: ['accounting'] },
      integrates: true, digital: true,
      dependencies: ['Examples of each document type you receive', 'A destination system with a way to import data', 'A person to review flagged fields'],
      risks: ['Extraction is never perfect, so keep a review step for anything financial', 'Documents can contain personal or sensitive data, so storage and retention need care', 'Unusual layouts need extra examples before they extract reliably'],
      experiment: 'Run 30 recent documents of a single type through an extraction tool. Compare the output with what your team typed and note which fields came out right every time.',
      sequence: ['List document types by volume and pain', 'Test extraction on one type against real examples', 'Add a review queue and export to your system', 'Extend to further document types'],
      questions: ['Which document type takes the longest to process?', 'Which fields must be exactly right, and which can be checked later?', 'Where does the data need to end up?']
    },
    {
      id: 'proposal-drafting', kind: 'AI', title: 'AI-assisted proposals and quotes',
      signals: {
        bottleneck: { leads: 2, admin: 2 }, tasks: { proposals: 6 },
        objective: { revenue: 3, time: 2 }, tools: { crm: 1, spreadsheets: 1 },
        industries: { professional: 2, trades: 2, software: 1, manufacturing: 1, property: 1 },
        keywords: ['proposal', 'quote', 'quoting', 'quotation', 'estimate', 'tender', 'bid', 'pricing', 'scope']
      },
      problem: 'Each proposal or quote is assembled by hand from old documents, price lists and notes, so it takes a long time and quality varies.',
      solution: 'Generate a first draft of each proposal or quote from a short structured brief, your approved templates and your current pricing, then have a person review and send it.',
      how: [
        'Capture the details of each opportunity in a short brief or form.',
        'Prices are calculated by fixed rules from your price list, not by the AI model.',
        'An AI model drafts the written sections in your style from your best past examples.',
        'A person reviews, edits and sends the final version.'
      ],
      benefits: ['Faster turnaround on proposals and quotes', 'More consistent quality and pricing', 'More time for the conversations that win work'],
      complexity: { level: 'medium', why: 'It needs well-organised templates and pricing rules. Drafting text is a strength of current AI models.', easierWith: ['crm'] },
      integrates: false, digital: true,
      dependencies: ['A few strong past proposals to learn your style from', 'An up-to-date price list or pricing rules', 'An AI model provider with suitable data terms'],
      risks: ['Pricing mistakes are costly, so calculate prices with rules and check them', 'Every draft must be reviewed before it is sent', 'Confidential client details should only go to providers with suitable data terms'],
      experiment: 'Write a short brief for your next three proposals and generate drafts from your best past examples. Time each one against your usual process and note how much editing was needed.',
      sequence: ['Gather strong examples and tidy the price list', 'Define the brief and draft template', 'Pilot on live proposals with full review', 'Connect to your CRM so briefs fill themselves'],
      questions: ['How many proposals or quotes do you write in a typical month?', 'Which parts are always the same and which change every time?', 'Who signs off pricing today?']
    },
    {
      id: 'payment-followup', kind: 'Automation', title: 'Automated invoicing and payment reminders',
      signals: {
        bottleneck: { payments: 6 }, tasks: { chasing: 4, 'data-entry': 1 },
        objective: { costs: 2, time: 2, revenue: 1 }, tools: { accounting: 2, crm: 1 }, stages: { idea: -4 },
        keywords: ['invoice', 'payment', 'overdue', 'late pay', 'chase', 'chasing', 'cash flow', 'cashflow', 'debtor', 'billing']
      },
      problem: 'Invoices go out late or inconsistently, and chasing overdue payments is uncomfortable, manual and easy to put off, which ties up cash.',
      solution: 'Raise invoices automatically when work is complete and send polite, scheduled reminders for anything unpaid, bringing in a person only when needed.',
      how: [
        'Invoices are created from completed {work} without retyping.',
        'Reminders go out on a schedule you set, in a tone you approve.',
        'Paid invoices stop the reminders automatically.',
        'Accounts that stay overdue are flagged for a personal call.'
      ],
      benefits: ['Invoices sent promptly and consistently', 'Less time spent chasing', 'Clearer visibility of what is owed'],
      complexity: { level: 'low', why: 'Most accounting software supports this already. The work is setting the rules and the tone.', harderWithout: ['accounting'], harderNote: 'You did not mention accounting software, so setting that up comes first.' },
      integrates: true, digital: true,
      dependencies: ['Accounting or invoicing software', 'Agreed payment terms and reminder wording', 'A link between completed work and invoicing'],
      risks: ['Reminders must reflect the real account status or they damage relationships', 'Some {customers} need a personal approach, so allow exceptions', 'Payment details should never be sent by plain email'],
      experiment: 'Switch on scheduled payment reminders in your accounting software for one month. Compare the number of overdue invoices and the time spent chasing with the previous month.',
      sequence: ['Agree payment terms and reminder wording', 'Turn on reminders in your accounting tool', 'Trigger invoices from completed work', 'Add online payment links and an overdue report'],
      questions: ['How long does it usually take to get paid?', 'Which {customers} pay late most often, and why?', 'Can {customers} pay online today?']
    },
    {
      id: 'reporting', kind: 'Software', title: 'Automated reporting from a single source of truth',
      signals: {
        bottleneck: { reporting: 6 }, tasks: { reports: 5, 'data-entry': 2 },
        objective: { decisions: 4, time: 2, costs: 1 }, tools: { spreadsheets: 2, accounting: 1, crm: 1, ecommerce: 1 },
        stages: { idea: -4, solo: -1, growing: 1, established: 1, large: 1 },
        keywords: ['report', 'dashboard', 'kpi', 'metric', 'numbers', 'visibility', 'spreadsheet', 'excel', 'data']
      },
      problem: 'Reports are built by hand from several spreadsheets and systems, so they arrive late, take hours to prepare, and different people quote different numbers.',
      solution: 'Connect your key data sources in one place, define each measure once and produce the reports you rely on automatically, on a schedule.',
      how: [
        'Agree the handful of measures that drive real decisions.',
        'Connect the systems those numbers come from.',
        'Define each measure once so everyone uses the same figure.',
        'Reports and alerts are produced automatically and shared with the right people.'
      ],
      benefits: ['Hours of manual report building handed back to the team', 'One agreed version of the numbers', 'Earlier warning when something drifts'],
      complexity: { level: 'medium', why: 'It depends on how many sources there are and how clean the data is.' },
      integrates: true, digital: true,
      dependencies: ['Access to the systems that hold the data', 'Agreed definitions for each measure', 'Someone who owns the reports and acts on them'],
      risks: ['Automating a report built on messy data spreads the mess faster, so agree definitions first', 'Dashboards nobody uses are a common failure, so start from the decisions you need to make', 'Financial and personal data need proper access permissions'],
      experiment: 'Choose the report you produce most often. Write down where each number comes from and how it is defined, then automate just that report and run it alongside the manual version for a month.',
      sequence: ['Choose the decisions and measures that matter', 'Connect the first data sources', 'Automate one report and check it against the manual version', 'Add further reports, alerts and sources'],
      questions: ['Which decisions are you making without the numbers you need?', 'Which report takes the longest to produce?', 'Where do the numbers disagree today?']
    },
    {
      id: 'integration', kind: 'Automation', title: 'Connect your systems and remove double entry',
      signals: {
        bottleneck: { admin: 3, reporting: 1, inventory: 1 }, tasks: { 'data-entry': 6 },
        objective: { costs: 2, time: 3 }, tools: { custom: 1, crm: 1, accounting: 1, ecommerce: 1 }, stages: { idea: -4 },
        keywords: ['copy', 'paste', 'double entry', 're-enter', 'reenter', 'retype', 'sync', 'integrat', 'manual', 'systems']
      },
      problem: 'The same information is typed into several tools, so records drift out of sync and your team spends time copying rather than doing the work.',
      solution: 'Link the tools you already use so that information entered once flows to everywhere it is needed, with a log of each transfer and an alert if one fails.',
      how: [
        'Map where each key record (a customer, an order, a job) gets typed.',
        'Pick one system as the source for each record.',
        'Use an integration platform or small custom connectors to pass changes between systems.',
        'Transfers are logged, and failures alert a named person.'
      ],
      benefits: ['Less copying and retyping', 'Records that agree across systems', 'A foundation that later reporting and AI work can build on'],
      complexity: { level: 'medium', why: 'Most popular tools connect through standard integrations. Older or in-house systems may need custom work.' },
      integrates: true, digital: true,
      dependencies: ['Admin access to the tools involved', 'A clear source of truth for each record', 'An integration platform or a developer for custom connectors'],
      risks: ['Badly mapped fields can corrupt data quickly, so test on copies first', 'Integrations need monitoring and break when tools change', 'Each connected tool widens who can see your data'],
      experiment: 'List every place one piece of information, such as a new customer, gets typed. Automate the most frequent transfer with an integration tool and count how many manual entries it replaces over two weeks.',
      sequence: ['Map the flow of your key records', 'Automate the single highest-volume transfer', 'Add monitoring and failure alerts', 'Connect the remaining systems one at a time'],
      questions: ['Which piece of information do you type most often?', 'Which system should be the master copy?', 'What breaks when two systems disagree?']
    },
    {
      id: 'knowledge-assistant', kind: 'AI', title: 'Internal knowledge assistant for your team',
      signals: {
        bottleneck: { knowledge: 6, people: 3 }, tasks: { onboarding: 2, 'same-questions': 1 },
        objective: { time: 2, experience: 1, costs: 1 }, tools: { pm: 1, custom: 1 },
        stages: { idea: -4, solo: -4, growing: 2, established: 2, large: 2 },
        keywords: ['knowledge', 'process', 'sop', 'documentation', 'training', 'wiki', 'depends on', 'key person', 'handbook']
      },
      problem: 'Important know-how lives in a few people’s heads or in scattered documents, so work slows when they are busy or away, and new people take a long time to get up to speed.',
      solution: 'Write down your key processes and let your team ask questions in plain language, with answers drawn only from your own documents and linked back to the source.',
      how: [
        'Capture key processes, policies and answers as short documents.',
        'Load them into an assistant that can only answer from those documents.',
        'Each answer links to its source so people can check it.',
        'Gaps the assistant cannot answer become a list of documents to write.'
      ],
      benefits: ['Fewer interruptions for your most experienced people', 'Faster onboarding for new team members', 'Less risk when a key person is away'],
      complexity: { level: 'medium', why: 'The assistant itself is straightforward. Capturing and maintaining the knowledge is the real work.' },
      integrates: false, digital: true,
      dependencies: ['Time from experienced staff to capture what they know', 'A place to keep documents current', 'An AI model provider with suitable data terms'],
      risks: ['Answers are only as good as the documents behind them, and outdated content gives outdated answers', 'Access must respect who is allowed to see what', 'AI can still misread documents, so answers should cite their sources'],
      experiment: 'Ask your most interrupted person to list the ten questions they answer most. Document the answers, load them into an assistant restricted to those documents and let two colleagues use it for two weeks.',
      sequence: ['List the questions people ask most', 'Document the answers and processes', 'Pilot the assistant with a small group', 'Expand coverage and set a routine for keeping content current'],
      questions: ['Who gets interrupted most, and with which questions?', 'How long does a new starter take to work independently?', 'Which documents already exist, and are they current?']
    },
    {
      id: 'onboarding-flow', kind: 'Automation', title: 'Structured onboarding workflow',
      signals: {
        bottleneck: { people: 5, leads: 1 }, tasks: { onboarding: 6, documents: 1, chasing: 1 },
        objective: { experience: 3, time: 2 }, tools: { crm: 1, pm: 1 }, stages: { idea: -3 },
        keywords: ['onboard', 'new client', 'new starter', 'induction', 'welcome', 'setup', 'set up', 'kyc', 'hiring']
      },
      problem: 'Bringing on new {customers} or staff involves the same steps every time, but they are tracked in emails and memory, so things get missed and first impressions suffer.',
      solution: 'Turn onboarding into a guided checklist that sends forms, collects documents, sets up accounts and nudges people automatically, so everyone can see what is outstanding.',
      how: [
        'Write the onboarding steps down once, in order.',
        'Each new person or account starts a checklist automatically.',
        'Forms and document requests go out on schedule, with reminders.',
        'The team sees what is complete and what is blocked.'
      ],
      benefits: ['A consistent, professional first experience', 'Fewer missed steps', 'Less time spent chasing forms and documents'],
      complexity: { level: 'low', why: 'Workflow and form tools handle most of this without custom software.', easierWith: ['crm', 'pm'] },
      integrates: true, digital: true,
      dependencies: ['A written list of your onboarding steps', 'A form or workflow tool', 'Secure storage for the documents you collect'],
      risks: ['Identity and employment documents are sensitive, so store them securely', 'An overly rigid flow can feel impersonal, so keep a personal welcome', 'Steps change over time and the checklist must keep up'],
      experiment: 'Write your onboarding steps as a checklist and run your next three new {customers} or hires through an automated version with a form and scheduled reminders. Note what was still missed.',
      sequence: ['Document the current steps and pain points', 'Build the checklist and forms', 'Pilot with the next few starts', 'Connect it to your other systems'],
      questions: ['What gets missed most often during onboarding?', 'Which documents do you collect, and where do they go?', 'How long does onboarding take from first yes to fully set up?']
    },
    {
      id: 'inventory-signals', kind: 'Software', title: 'Stock and demand visibility',
      signals: {
        bottleneck: { inventory: 6 }, tasks: { reports: 2, 'data-entry': 1 },
        objective: { costs: 3, decisions: 2, revenue: 1 }, tools: { ecommerce: 2, spreadsheets: 1, accounting: 1 },
        industries: { retail: 2, hospitality: 2, manufacturing: 2, logistics: 1 }, stages: { idea: -4 },
        keywords: ['stock', 'inventory', 'supply', 'supplier', 'reorder', 're-order', 'demand', 'forecast', 'waste', 'warehouse']
      },
      problem: 'Stock levels, orders and supplier lead times sit in different places, so you either run out of what sells or tie up cash and space in what does not.',
      solution: 'Bring sales, stock and supplier data together, set reorder rules for key items and, once the data is reliable, add simple demand forecasting to flag what to order and when.',
      how: [
        'Stock and sales data flow into one view.',
        'Reorder points are set for your most important items.',
        'Alerts flag low stock and slow movers.',
        'With enough clean history, a forecast suggests order quantities for a person to approve.'
      ],
      benefits: ['Fewer stock-outs of the items that matter', 'Less cash and space tied up in slow stock', 'Ordering decisions based on data rather than memory'],
      complexity: { level: 'medium', why: 'Visibility and reorder rules are achievable with common tools. Forecasting needs clean, sufficient history.', easierWith: ['ecommerce'] },
      integrates: true, digital: true,
      dependencies: ['Accurate stock counts to start from', 'Sales history for your key items', 'Supplier lead times'],
      risks: ['Forecasts depend on clean history and are never certain', 'Promotions, seasons and supply shocks still need human judgement', 'Supplier data often arrives in inconsistent formats'],
      experiment: 'Track stock, sales and reorder dates for your 20 most important items in one shared view for a month. Note each stock-out or overstock and whether a simple reorder rule would have caught it.',
      sequence: ['Choose key items and verify stock counts', 'Build one shared stock view', 'Add reorder rules and alerts', 'Introduce forecasting once the history is reliable'],
      questions: ['Which items run out most often?', 'How do you decide what to order today?', 'How reliable are your current stock counts?']
    },
    {
      id: 'compliance-workflow', kind: 'Software', title: 'Digital checklists and compliance records',
      signals: {
        bottleneck: { compliance: 6, admin: 1 }, tasks: { documents: 2, reports: 1 },
        objective: { costs: 1, decisions: 1, experience: 1 }, tools: { paper: 2 },
        industries: { health: 2, trades: 2, manufacturing: 2, hospitality: 1, logistics: 1, finance: 1 }, stages: { idea: -4 },
        keywords: ['compliance', 'audit', 'inspection', 'safety', 'quality', 'checklist', 'certificat', 'regulat', 'iso 9001', 'risk assess']
      },
      problem: 'Checks, inspections and approvals are recorded on paper or in scattered files, so proving compliance takes effort and problems are spotted late.',
      solution: 'Move routine checks to digital checklists that work on a phone, with photos, sign-off and timestamps, and send automatic alerts for anything failed or overdue.',
      how: [
        'Convert your existing checks into digital checklists.',
        'Staff complete them on a phone or tablet, adding photos and sign-off.',
        'Failed or overdue checks alert the right person.',
        'Records are searchable and ready for audits.'
      ],
      benefits: ['Records that are easy to find when an auditor asks', 'Problems spotted sooner', 'Less paper handling and filing'],
      complexity: { level: 'low', why: 'Digital checklist tools are mature. The effort is in adapting your existing checks and getting staff using them.' },
      integrates: false, digital: false,
      dependencies: ['Your current checklists and standards', 'Phones or tablets for the people doing the checks', 'A named owner for follow-up actions'],
      risks: ['Software does not make you compliant; your process and the people following it do', 'Regulated records may have specific retention rules', 'Staff will go back to paper if the tool is not simple'],
      experiment: 'Digitise one check that happens at least weekly. Run it on phones for a month and compare completion rates and the time needed to find records with the paper version.',
      sequence: ['List recurring checks and their rules', 'Digitise the most frequent check', 'Add alerts and audit-ready exports', 'Move the remaining checks across'],
      questions: ['Which check is most often missed or late?', 'What does an auditor or inspector ask to see?', 'Who acts when a check fails?']
    },
    {
      id: 'content-workflow', kind: 'AI', title: 'AI-assisted content production with human review',
      signals: {
        bottleneck: { content: 6 }, tasks: { content: 5 },
        objective: { revenue: 2, experience: 1, launch: 1 }, tools: { pm: 1, ecommerce: 1 },
        keywords: ['content', 'marketing', 'social', 'posts', 'posting', 'newsletter', 'blog', 'seo', 'copy', 'product description', 'listing']
      },
      problem: 'Marketing content gets produced in bursts whenever someone finds time, so it is inconsistent and competes with client work for attention.',
      solution: 'Use AI to turn your expertise and existing material into drafts for posts, emails and product descriptions, inside a simple content calendar with a human editing and approval step.',
      how: [
        'Agree a short brand voice guide and a content calendar.',
        'Capture raw material: recorded conversations, notes, past work.',
        'An AI model drafts posts, emails or listings from that material.',
        'A person edits, fact-checks and approves before anything is published.'
      ],
      benefits: ['A steadier publishing rhythm', 'Less time from blank page to draft', 'Content grounded in your real expertise'],
      complexity: { level: 'low', why: 'The tools are inexpensive and easy to start with. Quality depends on a clear voice and a review step.' },
      integrates: false, digital: true,
      dependencies: ['A brand voice guide, even a short one', 'Regular raw material from people who know the subject', 'A reviewer with time set aside'],
      risks: ['Unedited AI content reads as generic and can contain errors', 'Check the accuracy of any claim, and your rights to any material used', 'Audiences and search engines reward original insight, which AI alone does not provide'],
      experiment: 'Record a 20-minute conversation about a topic you know well and use it to draft four posts and one email. Track the editing time and compare how the posts perform against your usual content.',
      sequence: ['Write a brand voice guide and calendar', 'Pilot drafting from recorded material', 'Set up review and scheduling', 'Repurpose content across channels'],
      questions: ['Which channels actually bring you {customers}?', 'Who has the expertise worth sharing?', 'How much review time can you commit each week?']
    },
    {
      id: 'product-validation', kind: 'Software', title: 'Validate a new AI-enabled product or service',
      signals: {
        objective: { launch: 7, revenue: 1 }, stages: { idea: 4, solo: 2, small: 1 },
        keywords: ['launch', 'new product', 'new service', 'idea', 'mvp', 'startup', 'prototype', 'mobile app', 'saas']
      },
      problem: 'You have an idea for a new product or service, but building the full version before knowing whether people will use it or pay for it is expensive and risky.',
      solution: 'Define the riskiest assumption, then build the smallest working version, often a prototype or a manually run service behind a simple interface, and test it with real prospective {customers}.',
      how: [
        'Write down who it is for, the problem it solves and the assumption most likely to be wrong.',
        'Test demand with conversations or a simple landing page before building.',
        'Build a narrow prototype that delivers the core value, doing some steps by hand if needed.',
        'Put it in front of a small group and let what they do decide the next step.'
      ],
      benefits: ['Evidence about demand before committing a large budget', 'A focused first version that is quicker to ship', 'Learning from real users rather than assumptions'],
      complexity: { level: 'medium', why: 'A focused prototype is achievable quickly. A production product with AI features needs careful engineering, security and support.' },
      integrates: false, digital: true,
      dependencies: ['Access to people who match your target {customers}', 'A clear statement of the problem and the riskiest assumption', 'Engineering capacity for the prototype'],
      risks: ['Early interest does not guarantee paying demand', 'AI features add running costs and accuracy risks that must be designed for', 'Scope tends to grow, so protect the experiment’s focus'],
      experiment: 'Write one sentence on who the product is for and the problem it solves. Speak to ten people who match that description before building anything, and note how many describe the problem without being prompted.',
      sequence: ['Frame the problem, audience and riskiest assumption', 'Test demand with conversations or a landing page', 'Build a narrow working prototype', 'Pilot with a small group and decide what to build next'],
      questions: ['Who exactly has this problem, and how do they solve it today?', 'What would they need to see to pay for it?', 'What is the smallest version that proves the idea?']
    },
    {
      id: 'customer-portal', kind: 'Software', title: 'Customer self-service portal',
      signals: {
        bottleneck: { enquiries: 2, scheduling: 1, payments: 1 }, tasks: { 'same-questions': 2, chasing: 1, onboarding: 1 },
        objective: { experience: 4, costs: 1 }, tools: { custom: 1, crm: 1 },
        industries: { professional: 2, property: 2, logistics: 2, finance: 2, software: 1 },
        stages: { idea: -4, solo: -3, small: -1, growing: 1, established: 2, large: 2 },
        keywords: ['status', 'portal', 'track', 'where is', 'login', 'self-service', 'self service', 'account', 'progress']
      },
      problem: '{customers} contact you for status updates, documents and simple changes that they could handle themselves if they had access.',
      solution: 'A secure portal where {customers} can check progress on their {work}, download documents, make simple changes and raise requests, connected to the systems you already use.',
      how: [
        '{customers} sign in securely.',
        'They see live status and documents pulled from your existing systems.',
        'Simple changes and requests are handled through forms with clear rules.',
        'Anything unusual goes to your team with the context attached.'
      ],
      benefits: ['Fewer routine status enquiries', 'A more professional, always-available experience', 'Clearer records of requests and changes'],
      complexity: { level: 'high', why: 'A portal involves sign-in, security and integration with your systems, so it is a larger build.' },
      integrates: true, digital: true,
      dependencies: ['Systems that hold status and documents, with a way to read from them', 'Secure authentication', 'Ongoing hosting, support and maintenance'],
      risks: ['Security matters: a portal exposes customer data if built carelessly', 'Low adoption if {customers} are not shown why it helps', 'Ongoing maintenance costs as systems change'],
      experiment: 'List the five status questions you are asked most. Send automatic status updates for one month as a stand-in for a portal, and track whether those enquiries fall.',
      sequence: ['Identify the most common self-service needs', 'Pilot proactive status updates', 'Build a narrow portal for one need', 'Add documents, requests and further integrations'],
      questions: ['What do {customers} contact you about most after they have bought?', 'Where does status information live today?', 'Would your {customers} sign in to a portal, or prefer updates sent to them?']
    }
  ];

  /* ---------- Helpers ---------- */
  const labelFor = (questionId, value) => {
    const option = QUESTION_MAP[questionId].options.find(o => o.value === value);
    return option ? option.label : '';
  };
  const focusFor = value => QUESTION_MAP.objective.options.find(o => o.value === value).focus;
  const article = word => (/^[aeiou]/i.test(word) ? 'an' : 'a');
  const lower = text => text.charAt(0).toLowerCase() + text.slice(1);
  const listJoin = items => items.length <= 1 ? (items[0] || '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  const clean = (value, max) => String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  const capitalise = text => text.charAt(0).toUpperCase() + text.slice(1);

  /* ---------- Validation ---------- */
  function normalizeAnswers(input) {
    const raw = input && typeof input === 'object' ? input : {};
    const answers = { industry: '', industryOther: '', stage: '', objective: '', bottleneck: '', tasks: [], tools: [], context: '' };
    const errors = {};

    QUESTIONS.forEach(q => {
      const value = raw[q.id];
      if (q.type === 'single') {
        const valid = q.options.some(o => o.value === value);
        answers[q.id] = valid ? value : '';
        if (q.required && !valid) errors[q.id] = 'Please choose an option to continue.';
      } else if (q.type === 'multi') {
        const list = Array.isArray(value) ? value : [];
        const allowed = new Set(q.options.map(o => o.value));
        answers[q.id] = [...new Set(list.filter(v => allowed.has(v)))].slice(0, q.max);
        if (list.filter(v => allowed.has(v)).length > q.max) errors[q.id] = `Choose up to ${q.max} options.`;
      } else if (q.type === 'text') {
        answers[q.id] = clean(value, q.max);
      }
    });

    if (answers.industry === 'other') answers.industryOther = clean(raw.industryOther, LIMITS.otherText);
    return { answers, errors, valid: Object.keys(errors).length === 0 };
  }

  /* ---------- Scoring ---------- */
  /* Keywords match at the start of a word; the reason quotes the visitor's own word. */
  function findKeywords(context, keywords) {
    if (!context || !keywords) return [];
    const text = context.toLowerCase();
    const isWordChar = ch => /[a-z0-9-]/.test(ch || '');
    const found = [];
    keywords.forEach(k => {
      let i = text.indexOf(k);
      while (i !== -1 && isWordChar(text[i - 1])) i = text.indexOf(k, i + 1);
      if (i === -1) return;
      let end = i + k.length;
      while (isWordChar(text[end])) end += 1;
      const word = text.slice(i, end);
      if (!found.includes(word)) found.push(word);
    });
    return found.slice(0, 2);
  }

  function scoreOpportunity(opp, a) {
    const s = opp.signals;
    const parts = [];
    const add = (type, points, detail) => { if (points) parts.push({ type, points, detail }); };

    add('bottleneck', (s.bottleneck || {})[a.bottleneck] || 0, a.bottleneck);
    const taskHits = a.tasks.filter(t => (s.tasks || {})[t]);
    taskHits.forEach(t => add('task', s.tasks[t], t));
    add('objective', (s.objective || {})[a.objective] || 0, a.objective);
    const toolHits = a.tools.filter(t => (s.tools || {})[t]);
    toolHits.forEach(t => add('tool', s.tools[t], t));
    add('industry', (s.industries || {})[a.industry] || 0, a.industry);
    add('stage', (s.stages || {})[a.stage] || 0, a.stage);
    findKeywords(a.context, s.keywords).forEach(k => add('keyword', 2, k));

    const score = parts.reduce((sum, p) => sum + p.points, 0);
    return { score, parts };
  }

  function assessComplexity(opp, a) {
    const c = opp.complexity;
    let index = LEVELS.indexOf(c.level);
    const notes = [c.why];
    const answeredTools = a.tools.length > 0;
    const toolLabels = values => listJoin(values.map(v => lower(labelFor('tools', v))));

    if (answeredTools) {
      const helpful = (c.easierWith || []).filter(t => a.tools.includes(t));
      if (helpful.length) { index -= 1; notes.push(`You already use ${toolLabels(helpful)}, which this can build on.`); }
      if (c.harderWithout && !c.harderWithout.some(t => a.tools.includes(t))) { index += 1; notes.push(c.harderNote); }
      if (a.tools.includes('paper') && opp.digital) { index += 1; notes.push('Much of your information is on paper or handled manually, so it needs capturing digitally first.'); }
      if (a.tools.includes('custom') && opp.integrates) { notes.push('Connecting to your in-house system depends on whether it can share data, for example through an API.'); }
    } else {
      notes.push('You skipped the tools question, so this assumes a typical setup.');
    }
    if ((a.stage === 'large' || a.stage === 'established') && opp.integrates) {
      index += 1;
      notes.push('At your size, security review, permissions and rollout across teams add effort.');
    }
    const level = LEVELS[Math.max(0, Math.min(2, index))];
    return { level, label: LEVEL_LABELS[level], notes };
  }

  function buildReasons(parts, a) {
    const reasons = [];
    const of = type => parts.filter(p => p.type === type && p.points > 0);
    const bottleneck = of('bottleneck')[0];
    if (bottleneck) {
      reasons.push(bottleneck.points >= 5
        ? `You named “${lower(labelFor('bottleneck', a.bottleneck))}” as your biggest bottleneck, and this addresses it directly.`
        : `It eases part of your main bottleneck, “${lower(labelFor('bottleneck', a.bottleneck))}”.`);
    }
    const tasks = of('task');
    if (tasks.length) reasons.push(`You flagged ${listJoin(tasks.map(t => `“${lower(labelFor('tasks', t.detail))}”`))} as repetitive work.`);
    const objective = of('objective')[0];
    if (objective) reasons.push(`It supports your main objective of ${focusFor(a.objective)}.`);
    const tools = of('tool').filter(t => t.detail !== 'paper');
    if (tools.length) reasons.push(`It can build on ${listJoin(tools.map(t => lower(labelFor('tools', t.detail))))}, which you already use.`);
    if (of('tool').some(t => t.detail === 'paper')) reasons.push('You said you mostly work on paper or by hand, which is where this helps most.');
    const stage = of('stage')[0];
    if (stage && stage.points >= 2) reasons.push(`It suits a business at your stage (${lower(labelFor('stage', a.stage))}).`);
    const keywords = of('keyword');
    if (keywords.length) reasons.push(`Your notes mention ${listJoin(keywords.map(k => `“${k.detail}”`))}.`);
    if (!reasons.length) reasons.push('Your answers did not point strongly to one area, so this is included as a broadly useful starting point.');
    return reasons;
  }

  function matchStrength(score) {
    if (score >= 10) return 'Strong match';
    if (score >= 6) return 'Good match';
    return 'Possible match';
  }

  /* ---------- Report ---------- */
  function industryWords(a) {
    const profile = INDUSTRIES.find(i => i.value === a.industry) || INDUSTRIES[INDUSTRIES.length - 1];
    return { customers: profile.customers, work: profile.work };
  }

  function fill(text, words, sentenceStart) {
    const out = text.replace(/\{customers\}/g, words.customers).replace(/\{work\}/g, words.work);
    return sentenceStart ? capitalise(out) : out;
  }

  function personalise(opp, words) {
    const f = text => fill(text, words, /^\{/.test(text));
    return {
      problem: f(opp.problem), solution: f(opp.solution), how: opp.how.map(f), benefits: opp.benefits.map(f),
      dependencies: opp.dependencies.map(f), risks: opp.risks.map(f), experiment: f(opp.experiment),
      sequence: opp.sequence.map(f), questions: opp.questions.map(f)
    };
  }

  function rankLibrary(a) {
    return LIBRARY.map(opp => {
      const { score, parts } = scoreOpportunity(opp, a);
      const complexity = assessComplexity(opp, a);
      // Small preference for options that are quicker to start when matches are close.
      const priority = score - LEVELS.indexOf(complexity.level) * 0.75;
      return { opp, score, parts, complexity, priority };
    }).sort((x, y) => y.priority - x.priority || x.opp.id.localeCompare(y.opp.id));
  }

  function rankNote(rank, item, next) {
    if (rank === 1) {
      const quick = item.complexity.level === 'low' ? ' and it is relatively quick to start' : '';
      return `Start here. It is the closest match to your answers${quick}.`;
    }
    if (rank === 2) return 'A strong second step, and often easier once the first is in place.';
    return next ? '' : 'Worth scoping once the first two are under way.';
  }

  function buildRoadmap(picked) {
    const [first, second, third] = picked;
    const steps = [
      { phase: 'Prove', text: `Run the first experiment for “${first.title}”. Agree in advance what result would make it worth continuing.` },
      { phase: 'Embed', text: `If the result holds up, make “${first.title}” part of everyday work and assign an owner.` }
    ];
    if (second) steps.push({ phase: 'Extend', text: `Start discovery for “${second.title}”, reusing any data, integrations or content the first step created.` });
    if (third) steps.push({ phase: 'Scope', text: `Scope “${third.title}” once the first two are stable, and revisit this plan with what you have learned.` });
    return steps;
  }

  function generateReport(input, options) {
    const opts = options || {};
    const { answers: a, errors, valid } = normalizeAnswers(input);
    if (!valid) {
      const error = new Error('Some required answers are missing.');
      error.code = 'INVALID_ANSWERS';
      error.fields = errors;
      throw error;
    }
    const words = industryWords(a);
    const ranked = rankLibrary(a);
    const picked = ranked.slice(0, 3);
    const general = picked[0].score < 6;

    const opportunities = picked.map((item, i) => {
      const text = personalise(item.opp, words);
      return Object.assign({
        rank: i + 1,
        id: item.opp.id,
        title: item.opp.title,
        kind: item.opp.kind,
        match: matchStrength(item.score),
        score: item.score,
        rankNote: rankNote(i + 1, item, picked[i + 1]),
        reasons: buildReasons(item.parts, a),
        complexity: item.complexity
      }, text);
    });

    const industryLabel = a.industry === 'other' && a.industryOther ? a.industryOther : labelFor('industry', a.industry);
    const profile = {
      industry: industryLabel,
      stage: labelFor('stage', a.stage),
      objective: labelFor('objective', a.objective),
      bottleneck: labelFor('bottleneck', a.bottleneck),
      tasks: a.tasks.map(t => labelFor('tasks', t)),
      tools: a.tools.map(t => labelFor('tools', t)),
      context: a.context
    };

    return {
      engine: ENGINE_VERSION,
      generatedAt: (opts.now || new Date()).toISOString(),
      answers: a,
      profile,
      general,
      headline: a.industry === 'other' && !a.industryOther
        ? `Three opportunities for a business focused on ${focusFor(a.objective)}`
        : `Three opportunities for ${article(industryLabel)} ${lower(industryLabel)} business focused on ${focusFor(a.objective)}`,
      summary: general
        ? 'Your answers did not point strongly to one area, so these are broadly useful starting points. Adding repetitive tasks or a short note will sharpen the result.'
        : `Based mainly on where work gets stuck (${lower(profile.bottleneck)}) and your objective of ${focusFor(a.objective)}.`,
      opportunities,
      roadmap: buildRoadmap(opportunities),
      method: 'These recommendations were generated in your browser by a rule-based engine. It matches your answers against a library of common AI, automation and software patterns written by BuildWise Group. No AI model, market research or data about your business beyond your answers was used.',
      limits: 'This is a starting point for a conversation, not verified analysis. Benefits are described qualitatively because no financial inputs were collected. Nothing here is a guaranteed outcome.'
    };
  }

  /* ---------- Opportunity Brief extension point ---------- */
  function matchBrief(brief, report) {
    const items = brief && Array.isArray(brief.items) ? brief.items : [];
    const ids = new Set(report.opportunities.map(o => o.id));
    const tags = new Set([report.answers.bottleneck, report.answers.objective, report.answers.industry, ...ids]);
    return items
      .filter(item => item && typeof item.title === 'string' && Array.isArray(item.tags) && item.tags.some(t => tags.has(t)))
      .map(item => ({
        title: clean(item.title, 120),
        summary: clean(item.summary, 280),
        date: clean(item.date, 20),
        url: /^(https:\/\/|\/)/.test(item.url || '') ? item.url : ''
      }))
      .slice(0, 3);
  }

  /* ---------- Sharing and export ---------- */
  const SHARE_KEYS = ['industry', 'industryOther', 'stage', 'objective', 'bottleneck', 'tasks', 'tools'];

  function toBase64Url(text) {
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text) : Buffer.from(text, 'utf8');
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(value) {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : Buffer.from(bytes).toString('utf8');
  }

  /* The optional notes are deliberately left out of shareable links. */
  function encodeAnswers(answers) {
    const data = {};
    SHARE_KEYS.forEach(k => { if (answers[k] && answers[k].length) data[k] = answers[k]; });
    return `v1.${toBase64Url(JSON.stringify(data))}`;
  }

  function decodeAnswers(token) {
    if (typeof token !== 'string' || !/^v1\.[A-Za-z0-9_-]{1,1200}$/.test(token)) throw new Error('This report link is not valid.');
    let data;
    try { data = JSON.parse(fromBase64Url(token.slice(3))); } catch (e) { throw new Error('This report link could not be read.'); }
    const { answers, valid } = normalizeAnswers(data);
    if (!valid) throw new Error('This report link is incomplete.');
    return answers;
  }

  function toPlainText(report) {
    const lines = [];
    const rule = '-'.repeat(60);
    lines.push('BuildWise Group · AI Business Opportunity Scanner', report.headline, `Generated ${report.generatedAt.slice(0, 10)}`, '');
    lines.push('ABOUT THIS REPORT', report.method, report.limits, '');
    lines.push('YOUR ANSWERS');
    const p = report.profile;
    lines.push(`Business: ${p.industry}`, `Size: ${p.stage}`, `Objective: ${p.objective}`, `Bottleneck: ${p.bottleneck}`);
    if (p.tasks.length) lines.push(`Repetitive tasks: ${p.tasks.join('; ')}`);
    if (p.tools.length) lines.push(`Tools: ${p.tools.join('; ')}`);
    if (p.context) lines.push(`Notes: ${p.context}`);
    report.opportunities.forEach(o => {
      lines.push('', rule, `${o.rank}. ${o.title} (${o.kind} · ${o.match})`, rule);
      if (o.rankNote) lines.push(o.rankNote);
      lines.push('', 'Why this was selected:', ...o.reasons.map(r => `- ${r}`));
      lines.push('', `Problem: ${o.problem}`, '', `Proposed solution: ${o.solution}`, '', 'How it would work:', ...o.how.map((h, i) => `${i + 1}. ${h}`));
      lines.push('', 'Expected benefits (qualitative):', ...o.benefits.map(b => `- ${b}`));
      lines.push('', `Implementation complexity: ${o.complexity.label}`, ...o.complexity.notes.map(n => `- ${n}`));
      lines.push('', 'Dependencies:', ...o.dependencies.map(d => `- ${d}`), '', 'Risks and limitations:', ...o.risks.map(r => `- ${r}`));
      lines.push('', `Suggested first experiment: ${o.experiment}`, '', 'Indicative sequence:', ...o.sequence.map((s, i) => `${i + 1}. ${s}`));
    });
    lines.push('', rule, 'INDICATIVE PLAN', ...report.roadmap.map((s, i) => `${i + 1}. ${s.phase}: ${s.text}`));
    return lines.join('\n');
  }

  return { ENGINE_VERSION, LIMITS, QUESTIONS, LIBRARY, LEVELS, normalizeAnswers, generateReport, matchBrief, encodeAnswers, decodeAnswers, toPlainText, scoreOpportunity, assessComplexity };
});
