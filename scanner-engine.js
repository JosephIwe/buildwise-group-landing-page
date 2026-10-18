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

  const ENGINE_VERSION = '2.0.0';
  const LIMITS = { context: 600, otherText: 60, multi: 6, website: 200 };

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
        { value: 'knowledge', label: 'Know-how stuck in a few people’s heads' },
        { value: 'unsure', label: 'Not sure yet' }
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
      id: 'capacity', short: 'Resources', type: 'single', required: false,
      title: 'What could you put towards a first project?',
      help: 'Optional. This helps match each suggestion to what you can realistically support.',
      options: [
        { value: 'diy', label: 'A small budget and no technical staff' },
        { value: 'some', label: 'A modest budget, but no in-house developers' },
        { value: 'team', label: 'Budget plus technical staff or a development partner' }
      ]
    },
    {
      id: 'context', short: 'Anything else', type: 'text', required: false, max: LIMITS.context,
      title: 'Anything else we should know?',
      help: 'Optional. Describe a process, a frustration or a goal in your own words, and add your website if you like.',
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
      benefits: ['Could shorten the time new {customers} wait for a first reply', 'Could reduce leads lost to forgotten follow-ups', 'Could give a clearer picture of where enquiries come from and what happens to them'],
      complexity: { level: 'medium', why: 'It uses standard tools, but your lead sources need connecting and reply templates need agreeing.', easierWith: ['crm'] },
      integrates: true, digital: true,
      dependencies: ['One place to hold leads (a CRM or a well-structured spreadsheet)', 'Access to the channels enquiries arrive through', 'Agreed reply templates and a named owner for each lead', 'A person to review AI-drafted replies, and an AI model provider whose cost grows with usage'],
      risks: ['Generic automated replies can put people off, so keep a person reviewing drafts at first', 'Enquiries contain personal data that must be handled in line with privacy law, such as UK GDPR', 'Too many follow-ups annoy people, so set sensible limits'],
      experiment: 'For two weeks, route every new enquiry from one channel into a single list and send a drafted first reply within the hour. Compare reply times before and after, and count how many enquiries turned into a conversation.',
      sequence: ['Map where enquiries arrive today and who answers them', 'Centralise one channel and agree reply templates', 'Add drafted replies with human approval', 'Add automated follow-ups and connect the remaining channels'],
      questions: ['Where do your best {customers} usually first get in touch?', 'How quickly do you reply today, and does speed matter in your market?', 'Who should own a lead once it arrives?'],
      area: 'leads',
      metrics: ["Median time from enquiry to first reply", "Share of enquiries that get at least one follow-up", "Enquiries that turn into a conversation or quote"],
      estimateInputs: ["How many enquiries you receive each month and how many become {customers} today", "The average value of a new customer", "Time spent per enquiry, and the cost of any CRM or AI tool"]
    },
    {
      id: 'enquiry-assistant', kind: 'AI', title: 'Answer routine questions with a grounded assistant',
      signals: {
        bottleneck: { enquiries: 6, knowledge: 1 }, tasks: { 'same-questions': 4 },
        objective: { experience: 3, time: 2, costs: 1 }, tools: { email: 1, booking: 1, ecommerce: 1 }, stages: { idea: -3 },
        keywords: ['question', 'enquir', 'support ticket', 'customer service', 'live chat', 'chatbot', 'inbox', 'out of hours', 'after hours']
      },
      problem: 'Your team spends much of the day answering the same questions from {customers}, which slows down replies to the questions that genuinely need a person.',
      solution: 'An assistant that answers routine questions using only information you have approved, such as prices, policies, hours and process, and hands everything else to your team with the conversation attached.',
      how: [
        'Collect the questions you are asked most and write approved answers for them.',
        'The assistant answers on your website or drafts replies in your inbox, drawing only on that approved content.',
        'Anything outside that content, or anything sensitive, goes to a person.',
        'You review conversations weekly and add missing answers.'
      ],
      benefits: ['Could give {customers} answers to routine questions outside working hours', 'Could reduce repetitive replies for the team', 'Would build a written record of what {customers} actually ask'],
      complexity: { level: 'medium', why: 'Tools for this are widely available. The work is in writing good source content, deciding when to hand over to a person and reviewing conversations.' },
      integrates: false, digital: true,
      dependencies: ['An up-to-date set of approved answers', 'A chosen channel: website chat, email drafts or messaging', 'An AI model provider, whose running cost grows with usage', 'A person to take handovers and review conversation logs'],
      risks: ['AI models can give confident but wrong answers, so restrict them to approved content and log every conversation', 'Some {customers} prefer a person, so make handover easy', 'Questions about health, money or legal matters need strict limits'],
      experiment: 'Pull your last 50 customer questions, group them and write approved answers for the top ten. Use them as suggested replies in your inbox for two weeks and count how many needed editing.',
      sequence: ['Collect and group recent questions', 'Write approved answers and handover rules', 'Pilot as suggested replies that staff review', 'Open a customer-facing channel once accuracy is consistently acceptable'],
      questions: ['Which questions take the most time each week?', 'Which topics must always go to a person?', 'Where do {customers} prefer to ask: website, email, phone or messaging?'],
      area: 'answers',
      metrics: ["Share of questions answered without a person", "Share of assistant answers that staff had to correct", "Time to first response"],
      estimateInputs: ["Weekly question volume and the share that are routine", "Average time spent answering one question", "Expected AI usage cost at your volume, which a provider can quote"],
      simplerFirst: "Before an AI assistant, check whether a searchable FAQ or help centre would answer most questions. If written answers do not exist yet, writing them is the first step either way."
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
      benefits: ['Could cut the time spent arranging {work}', 'Could reduce double bookings, and reminders may reduce missed appointments', 'Would let {customers} book at any hour'],
      complexity: { level: 'low', why: 'Off-the-shelf booking tools may cover your needs. The work is configuring your rules and connecting calendars.', easierWith: ['booking'] },
      integrates: true, digital: true,
      dependencies: ['A booking tool that fits how you work', 'Shared calendars for the people being booked', 'Clear rules for availability and cancellations', 'A booking tool subscription, which is an ongoing cost'],
      risks: ['Rigid rules can frustrate {customers} with unusual needs, so keep a way to contact a person', 'Reminder messages need consent and an easy opt-out', 'Calendar sync must be reliable or double bookings return'],
      experiment: 'Offer online booking for one service or one team member for a month, with an automatic reminder the day before. Note how much scheduling back-and-forth disappears and whether missed appointments change.',
      sequence: ['Write down your booking rules and exceptions', 'Set up a booking tool for one service', 'Add reminders and calendar sync', 'Roll out to the remaining services and connect payments if useful'],
      questions: ['Which {work} cause the most back-and-forth to arrange?', 'How often do appointments get missed or moved at short notice?', 'Should {customers} pay or leave a deposit when they book?'],
      area: 'scheduling',
      metrics: ["Hours per week spent arranging appointments", "Missed appointments per month", "Share of bookings made online"],
      estimateInputs: ["Bookings per week and time spent arranging each one", "Your current missed-appointment rate and the value of a slot", "The booking tool’s subscription cost"]
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
      benefits: ['Could reduce manual retyping', 'Could reduce keying errors reaching your records, provided flagged fields are checked', 'Could help you handle more documents without the same growth in admin time'],
      complexity: { level: 'medium', why: 'Consistent document types are the easiest place to start. Mixed layouts or handwriting need more testing, and every batch needs human review.', easierWith: ['accounting'] },
      integrates: true, digital: true,
      dependencies: ['Examples of each document type you receive', 'A destination system with a way to import data', 'A person to review flagged fields', 'An extraction service or AI model provider, charged by volume or subscription'],
      risks: ['Extraction is never perfect, so keep a review step for anything financial', 'Documents can contain personal or sensitive data, so storage and retention need care', 'Unusual layouts need extra examples before they extract reliably'],
      experiment: 'Run 30 recent documents of a single type through an extraction tool. Compare the output with what your team typed and note which fields came out right every time.',
      sequence: ['List document types by volume and pain', 'Test extraction on one type against real examples', 'Add a review queue and export to your system', 'Extend to further document types'],
      questions: ['Which document type takes the longest to process?', 'Which fields must be exactly right, and which can be checked later?', 'Where does the data need to end up?'],
      area: 'documents',
      metrics: ["Documents processed per week without retyping", "Fields corrected during review", "Time from receipt to entry in your system"],
      estimateInputs: ["Documents per month, by type", "Minutes spent keying each one today", "The per-document or subscription cost of an extraction service"],
      simplerFirst: "First check whether your accounting or bank software can import these documents directly, or whether suppliers can send the data electronically. That may remove the need for AI extraction."
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
      benefits: ['Could shorten the time to produce proposals and quotes', 'Could make quality and pricing more consistent', 'Could free time for conversations with prospective {customers}'],
      complexity: { level: 'medium', why: 'It needs well-organised templates and pricing rules. Current AI models can draft text, but every draft needs a person to review it.', easierWith: ['crm'] },
      integrates: false, digital: true,
      dependencies: ['A few strong past proposals to learn your style from', 'An up-to-date price list or pricing rules', 'An AI model provider with suitable data terms, whose cost grows with usage', 'A person to review every draft and check every price before sending'],
      risks: ['Pricing mistakes are costly, so calculate prices with rules and check them', 'Every draft must be reviewed before it is sent', 'Confidential client details should only go to providers with suitable data terms'],
      experiment: 'Write a short brief for your next three proposals and generate drafts from your best past examples. Time each one against your usual process and note how much editing was needed.',
      sequence: ['Gather strong examples and tidy the price list', 'Define the brief and draft template', 'Pilot on live proposals with full review', 'Connect to your CRM so briefs fill themselves'],
      questions: ['How many proposals or quotes do you write in a typical month?', 'Which parts are always the same and which change every time?', 'Who signs off pricing today?'],
      area: 'proposals',
      metrics: ["Time to produce a proposal or quote", "Edits needed per draft", "Proposals or quotes sent per month"],
      estimateInputs: ["Proposals per month and hours spent on each", "Your current win rate, if you track it", "The AI tool’s cost at your volume"],
      simplerFirst: "A well-structured template and a pricing spreadsheet may get you most of the way before any AI drafting."
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
      benefits: ['Could get invoices out more promptly and consistently', 'Could reduce the time spent chasing payments', 'Would give clearer visibility of what is owed'],
      complexity: { level: 'low', why: 'Many accounting tools include this. The work is setting the rules and the tone.', harderWithout: ['accounting'], harderNote: 'You did not mention accounting software, so setting that up comes first.' },
      integrates: true, digital: true,
      dependencies: ['Accounting or invoicing software', 'Agreed payment terms and reminder wording', 'A link between completed work and invoicing', 'A person to handle exceptions and disputes'],
      risks: ['Reminders must reflect the real account status or they damage relationships', 'Some {customers} need a personal approach, so allow exceptions', 'Payment details should never be sent by plain email'],
      experiment: 'Switch on scheduled payment reminders in your accounting software for one month. Compare the number of overdue invoices and the time spent chasing with the previous month.',
      sequence: ['Agree payment terms and reminder wording', 'Turn on reminders in your accounting tool', 'Trigger invoices from completed work', 'Add online payment links and an overdue report'],
      questions: ['How long does it usually take to get paid?', 'Which {customers} pay late most often, and why?', 'Can {customers} pay online today?'],
      area: 'payments',
      metrics: ["Average days to get paid", "Overdue invoices at month end", "Time spent chasing per week"],
      estimateInputs: ["Invoices per month and the value currently overdue", "Time spent chasing payments today", "The cost of accounting software or add-ons"]
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
      benefits: ['Could reduce the time spent building reports by hand', 'Could give the team one agreed version of the numbers', 'Could flag problems earlier once alerts are set up'],
      complexity: { level: 'medium', why: 'It depends on how many sources there are and how clean the data is.' },
      integrates: true, digital: true,
      dependencies: ['Access to the systems that hold the data', 'Agreed definitions for each measure', 'Someone who owns the reports and acts on them', 'A reporting or data tool, which may carry a subscription cost'],
      risks: ['Automating a report built on messy data spreads the mess faster, so agree definitions first', 'A dashboard nobody uses adds no value, so start from the decisions you need to make', 'Financial and personal data need proper access permissions'],
      experiment: 'Choose the report you produce most often. Write down where each number comes from and how it is defined, then automate just that report and run it alongside the manual version for a month.',
      sequence: ['Choose the decisions and measures that matter', 'Connect the first data sources', 'Automate one report and check it against the manual version', 'Add further reports, alerts and sources'],
      questions: ['Which decisions are you making without the numbers you need?', 'Which report takes the longest to produce?', 'Where do the numbers disagree today?'],
      area: 'reporting',
      metrics: ["Hours spent preparing the chosen report", "Days between period end and the report being ready", "Figures disputed in meetings"],
      estimateInputs: ["Hours spent per report and how often it is produced", "How many data sources are involved and how clean they are", "The cost of a reporting tool or the build work"]
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
      benefits: ['Could reduce copying and retyping', 'Could keep records consistent across systems', 'Could create a foundation for later reporting and AI work'],
      complexity: { level: 'medium', why: 'Many popular tools offer standard integrations. Older or in-house systems may need custom work.' },
      integrates: true, digital: true,
      dependencies: ['Admin access to the tools involved', 'A clear source of truth for each record', 'An integration platform (an ongoing subscription) or a developer for custom connectors', 'Someone to monitor and fix failed transfers'],
      risks: ['Badly mapped fields can corrupt data quickly, so test on copies first', 'Integrations need monitoring and can break when tools change', 'Each connected tool widens who can see your data'],
      experiment: 'List every place one piece of information, such as a new customer, gets typed. Automate the most frequent transfer with an integration tool and count how many manual entries it replaces over two weeks.',
      sequence: ['Map the flow of your key records', 'Automate the single highest-volume transfer', 'Add monitoring and failure alerts', 'Connect the remaining systems one at a time'],
      questions: ['Which piece of information do you type most often?', 'Which system should be the master copy?', 'What breaks when two systems disagree?'],
      area: 'integration',
      metrics: ["Manual entries replaced per week", "Records that disagree between systems", "Failed transfers per month"],
      estimateInputs: ["How often each record is typed and how long it takes", "How often errors occur and what fixing them costs", "An integration platform subscription or developer time"]
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
      benefits: ['Could reduce interruptions for your most experienced people', 'Could help new team members get up to speed sooner', 'Could lower the disruption when a key person is away'],
      complexity: { level: 'medium', why: 'The assistant itself is straightforward. Capturing and maintaining the knowledge is the real work.' },
      integrates: false, digital: true,
      dependencies: ['Time from experienced staff to capture what they know', 'A place to keep documents current, and someone responsible for it', 'An AI model provider with suitable data terms, whose cost grows with usage'],
      risks: ['Answers are only as good as the documents behind them, and outdated content gives outdated answers', 'Access must respect who is allowed to see what', 'AI can still misread documents, so answers should cite their sources and a person should review the ones staff flag'],
      experiment: 'Ask your most interrupted person to list the ten questions they answer most. Document the answers, load them into an assistant restricted to those documents and let two colleagues use it for two weeks.',
      sequence: ['List the questions people ask most', 'Document the answers and processes', 'Pilot the assistant with a small group', 'Expand coverage and set a routine for keeping content current'],
      questions: ['Who gets interrupted most, and with which questions?', 'How long does a new starter take to work independently?', 'Which documents already exist, and are they current?'],
      area: 'knowledge',
      metrics: ["Questions asked of key people per week", "Time for a new starter to work independently", "Share of assistant answers that cite a current source"],
      estimateInputs: ["Hours your key people spend answering questions", "How long it takes to onboard a new starter today", "Time to write the documents, plus AI usage cost"],
      simplerFirst: "Start by writing the answers into a shared, searchable document or wiki. Add an AI assistant only if people still cannot find what they need."
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
      benefits: ['Could make the first experience more consistent', 'Could reduce missed steps', 'Could cut time spent chasing forms and documents'],
      complexity: { level: 'low', why: 'Workflow and form tools may handle this without custom software.', easierWith: ['crm', 'pm'] },
      integrates: true, digital: true,
      dependencies: ['A written list of your onboarding steps', 'A form or workflow tool, which may carry a subscription cost', 'Secure storage for the documents you collect'],
      risks: ['Identity and employment documents are sensitive, so store them securely', 'An overly rigid flow can feel impersonal, so keep a personal welcome', 'Steps change over time and the checklist must keep up'],
      experiment: 'Write your onboarding steps as a checklist and run your next three new {customers} or hires through an automated version with a form and scheduled reminders. Note what was still missed.',
      sequence: ['Document the current steps and pain points', 'Build the checklist and forms', 'Pilot with the next few starts', 'Connect it to your other systems'],
      questions: ['What gets missed most often during onboarding?', 'Which documents do you collect, and where do they go?', 'How long does onboarding take from first yes to fully set up?'],
      area: 'onboarding',
      metrics: ["Steps missed per onboarding", "Days from first yes to fully set up", "Reminders needed per onboarding"],
      estimateInputs: ["Onboardings per month and hours spent on each", "The cost of delays or missed steps", "The form or workflow tool’s cost"]
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
      benefits: ['Could reduce stock-outs of the items that matter', 'Could reduce cash and space tied up in slow stock', 'Would put ordering decisions on recorded data rather than memory'],
      complexity: { level: 'medium', why: 'Visibility and reorder rules can be built with widely available tools. Forecasting needs clean, sufficient history.', easierWith: ['ecommerce'] },
      integrates: true, digital: true,
      dependencies: ['Accurate stock counts to start from', 'Sales history for your key items', 'Supplier lead times', 'Stock or forecasting software, which may carry a subscription cost', 'A person to approve suggested orders'],
      risks: ['Forecasts depend on clean history and are never certain', 'Promotions, seasons and supply shocks still need human judgement', 'Supplier data may arrive in inconsistent formats'],
      experiment: 'Track stock, sales and reorder dates for your 20 most important items in one shared view for a month. Note each stock-out or overstock and whether a simple reorder rule would have caught it.',
      sequence: ['Choose key items and verify stock counts', 'Build one shared stock view', 'Add reorder rules and alerts', 'Introduce forecasting once the history is reliable'],
      questions: ['Which items run out most often?', 'How do you decide what to order today?', 'How reliable are your current stock counts?'],
      area: 'inventory',
      metrics: ["Stock-outs of key items per month", "Stock value tied up in slow-moving items", "Time spent deciding what to order"],
      estimateInputs: ["Sales history and stock levels for key items", "Margin lost per stock-out and the cost of holding stock", "Software subscription cost"]
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
      benefits: ['Could make records easier to find when an auditor asks', 'Could surface failed or missed checks sooner', 'Could reduce paper handling and filing'],
      complexity: { level: 'low', why: 'Digital checklist tools are widely available. The effort is in adapting your existing checks and getting staff using them.' },
      integrates: false, digital: false,
      dependencies: ['Your current checklists and standards', 'Phones or tablets for the people doing the checks', 'A named owner for follow-up actions', 'A checklist app subscription, which is an ongoing cost'],
      risks: ['Software does not make you compliant; your process and the people following it do', 'Regulated records may have specific retention rules', 'Staff may go back to paper if the tool is not simple'],
      experiment: 'Digitise one check that happens at least weekly. Run it on phones for a month and compare completion rates and the time needed to find records with the paper version.',
      sequence: ['List recurring checks and their rules', 'Digitise the most frequent check', 'Add alerts and audit-ready exports', 'Move the remaining checks across'],
      questions: ['Which check is most often missed or late?', 'What does an auditor or inspector ask to see?', 'Who acts when a check fails?'],
      area: 'compliance',
      metrics: ["Check completion rate", "Time to retrieve a record for an audit", "Failed or overdue checks found per month"],
      estimateInputs: ["Checks per month and time per check", "Time spent preparing for audits today", "The checklist app’s subscription cost"]
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
      benefits: ['Could support a steadier publishing rhythm', 'Could shorten the time from blank page to draft', 'Keeps content grounded in your own expertise, provided a person edits it'],
      complexity: { level: 'low', why: 'Starting is straightforward. Tools carry subscription or usage costs, and quality depends on a clear voice and a human review step.' },
      integrates: false, digital: true,
      dependencies: ['A brand voice guide, even a short one', 'Regular raw material from people who know the subject', 'A reviewer with time set aside to edit and fact-check every piece', 'AI writing tools, which carry a subscription or usage cost'],
      risks: ['Unedited AI content reads as generic and can contain errors', 'Check the accuracy of any claim, and your rights to any material used', 'Audiences and search engines reward original insight, which AI alone does not provide'],
      experiment: 'Record a 20-minute conversation about a topic you know well and use it to draft four posts and one email. Track the editing time and compare how the posts perform against your usual content.',
      sequence: ['Write a brand voice guide and calendar', 'Pilot drafting from recorded material', 'Set up review and scheduling', 'Repurpose content across channels'],
      questions: ['Which channels actually bring you {customers}?', 'Who has the expertise worth sharing?', 'How much review time can you commit each week?'],
      area: 'content',
      metrics: ["Pieces published per month", "Editing time per piece", "Enquiries or sales you can trace to content"],
      estimateInputs: ["Hours spent on content today", "How you currently trace enquiries back to content", "AI tool subscription cost"],
      simplerFirst: "A content calendar and a few reusable templates may be enough to steady your publishing before adding AI drafting."
    },
    {
      id: 'product-validation', kind: 'Software', title: 'Validate a new AI-enabled product or service',
      signals: {
        objective: { launch: 7, revenue: 1 }, coreObjectives: ['launch'], stages: { idea: 4, solo: 2, small: 1 },
        keywords: ['launch', 'new product', 'new service', 'idea', 'mvp', 'startup', 'prototype', 'mobile app', 'saas']
      },
      problem: 'You have an idea for a new product or service, but building the full version before knowing whether people will use it or pay for it is expensive and risky.',
      solution: 'Define the riskiest assumption, then build the smallest working version, such as a prototype or a manually run service behind a simple interface, and test it with real prospective {customers}.',
      how: [
        'Write down who it is for, the problem it solves and the assumption most likely to be wrong.',
        'Test demand with conversations or a simple landing page before building.',
        'Build a narrow prototype that delivers the core value, doing some steps by hand if needed.',
        'Put it in front of a small group and let what they do decide the next step.'
      ],
      benefits: ['Could give you evidence about demand before committing a large budget', 'Keeps the first version focused and smaller to build', 'Lets real users, rather than assumptions, shape what comes next'],
      complexity: { level: 'medium', why: 'A focused prototype is a much smaller build than a full product. A production product with AI features needs careful engineering, security and support.' },
      integrates: false, digital: true,
      dependencies: ['Access to people who match your target {customers}', 'A clear statement of the problem and the riskiest assumption', 'Engineering capacity for the prototype', 'Budget for build, hosting and any AI usage costs'],
      risks: ['Early interest does not guarantee paying demand', 'AI features add running costs and accuracy risks that must be designed for', 'Scope tends to grow, so protect the experiment’s focus'],
      experiment: 'Write one sentence on who the product is for and the problem it solves. Speak to ten people who match that description before building anything, and note how many describe the problem without being prompted.',
      sequence: ['Frame the problem, audience and riskiest assumption', 'Test demand with conversations or a landing page', 'Build a narrow working prototype', 'Pilot with a small group and decide what to build next'],
      questions: ['Who exactly has this problem, and how do they solve it today?', 'What would they need to see to pay for it?', 'What is the smallest version that proves the idea?'],
      area: 'launch',
      metrics: ["Target customers who describe the problem without prompting", "Sign-ups or commitments from a landing page or pilot", "Pilot users who come back after first use"],
      estimateInputs: ["The size of your target audience and how you would reach them", "What people say they would pay, tested in conversations", "Build, hosting and AI usage costs for a prototype"]
    },
    {
      id: 'admin-basics', kind: 'Software', title: 'Move paperwork into off-the-shelf job and accounting software',
      requires: { withoutTools: ['accounting'] }, goodFor: ['diy'], covers: ['payments'],
      signals: {
        bottleneck: { admin: 6, payments: 2 }, tasks: { documents: 4, chasing: 2, 'data-entry': 2, proposals: 1 },
        objective: { costs: 2, time: 2 }, industries: { trades: 1, professional: 1, health: 1 }, stages: { idea: -3, large: -3, established: -2 },
        keywords: ['paper', 'paperwork', 'receipt', 'invoice', 'spreadsheet', 'admin', 'evenings', 'shoebox']
      },
      problem: 'Quotes, invoices, receipts and job details live on paper and in spreadsheets, so admin eats into evenings, documents go missing and it is hard to see what is owed.',
      solution: 'Adopt one off-the-shelf tool for quotes, invoices and expenses, use its phone app to photograph receipts as they arrive, and switch on its built-in payment reminders, before considering anything custom or AI-based.',
      how: [
        'Choose one accounting or job-management tool that covers quotes, invoices and expenses for a business of your size.',
        'Set up your services, prices and customer list once.',
        'Photograph receipts and supplier invoices with the tool’s app as they arrive, instead of keeping paper.',
        'Send invoices from the tool and turn on its automatic payment reminders.'
      ],
      benefits: ['Could cut the evenings spent on paperwork', 'Could reduce lost receipts and missed invoices', 'Would show what is owed and what has been paid in one place'],
      complexity: { level: 'low', why: 'These tools are designed to be set up without technical help. The work is moving your price list and customer details across and building the habit.' },
      integrates: false, digital: false,
      dependencies: ['A monthly subscription for the tool, which is an ongoing cost', 'A few hours to set up prices, customers and bank connection', 'A smartphone for capturing receipts', 'Advice from your accountant on which tool they can work with'],
      risks: ['Switching tools mid-year can complicate your accounts, so check timing with your accountant', 'The tool only helps if receipts are captured every time', 'Bank connections and data are sensitive, so use strong passwords and two-factor sign-in'],
      experiment: 'Pick a tool your accountant supports and use its free trial for one month on new work only: quote, invoice and capture every receipt in it. Note the hours spent on admin each week compared with the previous month.',
      sequence: ['Ask your accountant which tools they support', 'Trial one tool on new work for a month', 'Move existing customers and open invoices across', 'Switch on payment reminders and bank feeds'],
      questions: ['Which tool does your accountant already work with?', 'Which paperwork takes the most time each week?', 'Do you need quotes and job tracking as well as invoices?'],
      area: 'documents',
      metrics: ['Hours spent on admin each week', 'Receipts or invoices that go missing', 'Average days to get paid'],
      estimateInputs: ['Hours you spend on admin each week today', 'The tool’s monthly subscription', 'How much is currently overdue or written off']
    },
    {
      id: 'help-centre', kind: 'Software', title: 'Searchable help centre and FAQ',
      signals: {
        bottleneck: { enquiries: 6 }, tasks: { 'same-questions': 4, onboarding: 1 },
        objective: { experience: 3, time: 2, costs: 2 }, industries: { software: 1, retail: 1 }, stages: { idea: -3 },
        keywords: ['help doc', 'docs', 'documentation', 'faq', 'how do i', 'how-do-i', 'how-to', 'how to', 'article', 'help centre', 'help center', 'knowledge base', 'same question']
      },
      problem: '{customers} ask questions that already have answers, because the answers are hard to find or do not exist in writing yet. Each repeat question takes the team’s time.',
      solution: 'Publish clear answers to your most common questions in a searchable help centre, link to them from your website, emails and contact page, and suggest relevant articles before {customers} send a message.',
      how: [
        'Pull your most frequent questions from recent emails, calls or tickets.',
        'Write short, specific answers and organise them by topic.',
        'Put the help centre where {customers} look: website navigation, confirmation emails and the contact page.',
        'Suggest matching articles on the contact form, and review searches that return nothing.'
      ],
      benefits: ['Could reduce repeat questions reaching the team', 'Would let {customers} find answers at any hour without waiting', 'Would create approved written answers that an AI assistant could use later, if one is ever needed'],
      complexity: { level: 'low', why: 'Help-centre tools and website FAQ pages are widely available. The work is writing and maintaining the answers.' },
      integrates: false, digital: true,
      dependencies: ['A list of your most common questions and their correct answers', 'A help-centre tool or a section of your website', 'Someone responsible for keeping answers current', 'A subscription cost, if you use a dedicated help-centre tool'],
      risks: ['Out-of-date answers create more questions, so set a review routine', 'Articles that are hard to find will not be used, so search and placement matter', 'Some {customers} will still prefer a person, so keep contact easy'],
      experiment: 'Write answers to your ten most frequent questions, publish them on one page and link to it from your contact page and confirmation emails. For a month, count how many messages ask those ten questions and compare with the month before.',
      sequence: ['Collect recent questions and rank them by frequency', 'Write and publish the first ten answers', 'Add search, and link articles from emails and the contact form', 'Review failed searches monthly and fill the gaps'],
      questions: ['Which questions take up the most replies each week?', 'Do written answers to them already exist anywhere?', 'Where do {customers} look before they contact you?'],
      area: 'answers',
      metrics: ['Messages per week about the questions you published', 'Help-centre searches that return no result', 'Contact-form visitors who open a suggested article'],
      estimateInputs: ['How many enquiries you receive each week, and what share are repeat questions', 'Average time spent answering one', 'The cost of a help-centre tool, if you choose one']
    },
    {
      id: 'order-updates', kind: 'Automation', title: 'Proactive order and status updates',
      requires: { industries: ['retail', 'logistics', 'manufacturing'] },
      signals: {
        bottleneck: { enquiries: 6 }, tasks: { 'same-questions': 3, chasing: 1 },
        objective: { experience: 3, costs: 1, time: 1 }, industries: { retail: 1, logistics: 1 }, stages: { idea: -4 },
        keywords: ['where is my order', 'where is', 'order status', 'tracking', 'track', 'delivery', 'deliveries', 'dispatch', 'shipping', 'shipped', 'returns', 'refund', 'status update', 'progress update']
      },
      problem: 'Many messages from {customers} ask where their {work} have got to, or how returns work. The answer is already in your systems, but they have to ask for it.',
      solution: 'Send automatic updates at the stages {customers} care about, such as confirmed, dispatched and delivered, with a tracking link and a plain-language returns page, so the most common questions are answered before they are asked.',
      how: [
        'List the stages {customers} care about and the questions each one triggers.',
        'Turn on or configure status notifications in your e-commerce, shipping or job system.',
        'Include a tracking link and a link to a clear returns or changes page.',
        'Watch which questions still arrive and add an update or page for them.'
      ],
      benefits: ['Could reduce “where is my order” and returns enquiries', 'Would keep {customers} informed without them having to ask', 'Would use features many e-commerce and shipping tools already include'],
      complexity: { level: 'low', why: 'Many e-commerce and shipping tools include status notifications. The work is choosing the stages and writing clear messages.', easierWith: ['ecommerce'] },
      integrates: true, digital: true,
      dependencies: ['A system that knows the status of each order or job', 'Courier tracking links, if you ship goods', 'A returns or changes policy written in plain language', 'A notifications or shipping add-on, which may carry a subscription or per-message cost'],
      risks: ['Too many messages annoy people, so send only updates that answer real questions', 'Messages must reflect the true status or they create more enquiries', 'Text messages need consent and an opt-out'],
      experiment: 'Tag a month of support emails by topic to see how many ask about order status or returns. Then turn on dispatch and delivery notifications with a tracking link and a returns-page link, and compare the next month.',
      sequence: ['Tag recent enquiries by topic', 'Write a plain-language returns or changes page', 'Turn on status notifications for the key stages', 'Add further updates for whatever questions remain'],
      questions: ['What share of enquiries are about status or returns?', 'Which system knows the current status of each order?', 'Which stage triggers the most questions?'],
      area: 'status',
      metrics: ['Weekly enquiries about order status or returns', 'Time from order to first status update', 'Opt-out rate for status messages'],
      estimateInputs: ['Weekly volume of status and returns enquiries', 'Average time spent handling one', 'The per-message or subscription cost of the notification tool']
    },
    {
      id: 'customer-portal', kind: 'Software', title: 'Customer self-service portal', notFor: ['diy'],
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
      benefits: ['Could reduce routine status enquiries, if {customers} adopt it', 'Would give {customers} access at any hour', 'Would keep clearer records of requests and changes'],
      complexity: { level: 'high', why: 'A portal involves sign-in, security and integration with your systems, so it is a larger build.' },
      integrates: true, digital: true,
      dependencies: ['Systems that hold status and documents, with a way to read from them', 'Secure authentication', 'Budget for the build plus ongoing hosting, support and maintenance'],
      risks: ['Security matters: a portal exposes customer data if built carelessly', 'Low adoption if {customers} are not shown why it helps', 'Ongoing maintenance costs as systems change'],
      experiment: 'List the five status questions you are asked most. Send automatic status updates for one month as a stand-in for a portal, and track whether those enquiries fall.',
      sequence: ['Identify the most common self-service needs', 'Pilot proactive status updates', 'Build a narrow portal for one need', 'Add documents, requests and further integrations'],
      questions: ['What do {customers} contact you about most after they have bought?', 'Where does status information live today?', 'Would your {customers} sign in to a portal, or prefer updates sent to them?'],
      area: 'status',
      metrics: ["Routine status enquiries per week", "Share of {customers} who sign in", "Requests completed without staff involvement"],
      estimateInputs: ["Weekly status enquiries and the time spent on each", "How many {customers} would realistically use it", "A build quote plus hosting and maintenance costs"]
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

  /* The optional website is context only: the scanner never visits it. Only a
   * public-looking http(s) address is kept, reduced to its origin and path, so a
   * query string or fragment (which can carry tokens) is never stored or repeated. */
  const WEBSITE_ERROR = 'Enter a website address like example.com, or leave it empty.';
  function normalizeWebsite(value) {
    const text = clean(value, 400);
    if (!text) return { url: '', display: '', error: '' };
    if (text.length > LIMITS.website || /\s/.test(text)) return { url: '', display: '', error: WEBSITE_ERROR };
    let url;
    try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`); } catch (e) { return { url: '', display: '', error: WEBSITE_ERROR }; }
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const labels = host.split('.');
    const tld = labels[labels.length - 1];
    const publicName = labels.length >= 2 && labels.every(l => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))
      && (/^[a-z]{2,63}$/.test(tld) || /^xn--[a-z0-9-]{2,59}$/.test(tld))
      && !/(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|test|invalid|example)$/.test(host);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || (url.port && url.port !== '80' && url.port !== '443') || !publicName) {
      return { url: '', display: '', error: WEBSITE_ERROR };
    }
    const pathname = url.pathname === '/' ? '' : url.pathname;
    return { url: `${url.protocol}//${host}${pathname || '/'}`, display: `${host}${pathname}`.replace(/\/$/, ''), error: '' };
  }

  function normalizeAnswers(input) {
    const raw = input && typeof input === 'object' ? input : {};
    const answers = { industry: '', industryOther: '', stage: '', objective: '', bottleneck: '', tasks: [], tools: [], capacity: '', context: '', website: '' };
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
    // An invalid website is dropped rather than blocking the report; the page checks it with normalizeWebsite first.
    answers.website = normalizeWebsite(raw.website).url;
    return { answers, errors, valid: Object.keys(errors).length === 0 };
  }

  /* ---------- Scoring ----------
   * Every point comes from one of the visitor's answers, and the report shows
   * the breakdown. "Specific" evidence (bottleneck, repetitive tasks, words in
   * the notes) decides the match label; "general" evidence (objective, sector,
   * size) only orders options that are otherwise close. Tools never add points:
   * they only change how complex an option is likely to be.
   */
  const POINTS = { bottleneckDirect: 6, /* also used for an objective that is the problem itself */ bottleneckPartial: 1, taskDirect: 3, taskPartial: 1, taskCap: 6, keyword: 2, keywordCap: 4, objectiveDirect: 2, objectivePartial: 1, industry: 1, stageCap: 2 };
  const PENALTY = { perLevel: 0.75, ai: 1, aiLimited: 2.5 };
  const LIMITED_HINTS = ['no budget', 'small budget', 'tight budget', 'limited budget', 'low budget', 'no developer', 'no tech', 'no it ', 'do everything myself', 'on my own', 'just me'];
  const MATCH_RULES = {
    'Strong match': 'Addresses your biggest bottleneck, and at least two more of your specific answers (repetitive tasks, notes, or an objective that is itself the problem) point directly to it.',
    'Good match': 'Addresses your biggest bottleneck and one more specific answer points directly to it, or two specific answers point directly to it.',
    'Partial match': 'Addresses your biggest bottleneck on its own, or only one or two of your specific answers point to it, some only indirectly.',
    'General suggestion': 'None of your specific answers point to it. It is included because it suits your objective, sector or size.'
  };

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
      if (!found.some(f => f.includes(word) || word.includes(f))) found.push(word);
    });
    return found.slice(0, 2);
  }

  /* Resources the visitor can put towards a project: their answer, or an inference they can see. */
  function resourcesFor(a) {
    if (a.capacity) return { level: a.capacity, inferred: false };
    const text = ` ${a.context.toLowerCase()} `;
    if (LIMITED_HINTS.some(h => text.includes(h))) return { level: 'diy', inferred: 'notes' };
    if (a.stage === 'solo' || a.stage === 'idea') return { level: 'diy', inferred: 'stage' };
    return { level: '', inferred: false };
  }

  function scoreOpportunity(opp, a) {
    const s = opp.signals;
    const parts = [];
    const add = (type, points, label, specific, strong) => { if (points) parts.push({ type, points, label, specific, strong: Boolean(strong) }); };

    const b = (s.bottleneck || {})[a.bottleneck];
    if (b) {
      const direct = b >= 5;
      add(direct ? 'bottleneck' : 'bottleneck-partial', direct ? POINTS.bottleneckDirect : POINTS.bottleneckPartial,
        `${direct ? 'Addresses' : 'Partly addresses'} your biggest bottleneck: ${lower(labelFor('bottleneck', a.bottleneck))}`, true, direct);
    }
    let taskPoints = 0;
    a.tasks.forEach(t => {
      const w = (s.tasks || {})[t];
      if (!w) return;
      const pts = Math.min(w >= 4 ? POINTS.taskDirect : POINTS.taskPartial, POINTS.taskCap - taskPoints);
      taskPoints += pts;
      add('task', pts, `${w >= 4 ? 'Matches' : 'Partly matches'} a repetitive task: ${lower(labelFor('tasks', t))}`, true, w >= 4);
    });
    findKeywords(a.context, s.keywords).slice(0, POINTS.keywordCap / POINTS.keyword)
      .forEach(k => add('keyword', POINTS.keyword, `Your notes mention “${k}”`, true, true));

    const o = (s.objective || {})[a.objective];
    if (o) {
      // For a few patterns the objective itself is the problem (launching something new), so it counts as specific evidence.
      const core = (s.coreObjectives || []).includes(a.objective);
      const pts = core ? POINTS.bottleneckDirect : (o >= 3 ? POINTS.objectiveDirect : POINTS.objectivePartial);
      add(core ? 'objective-core' : 'objective', pts, `${core ? 'Directly serves' : 'Supports'} your objective: ${focusFor(a.objective)}`, core, core);
    }
    if ((s.industries || {})[a.industry]) add('industry', POINTS.industry, `Relevant to ${lower(labelFor('industry', a.industry))} businesses`, false);
    const st = (s.stages || {})[a.stage];
    if (st) add('stage', Math.min(st, POINTS.stageCap), st > 0 ? `Suits a business of your size (${lower(labelFor('stage', a.stage))})` : `Less suited to a business of your size (${lower(labelFor('stage', a.stage))})`, false);

    const score = parts.reduce((sum, p) => sum + p.points, 0);
    return { score, parts };
  }

  const TIERS = ['General suggestion', 'Partial match', 'Good match', 'Strong match'];
  function matchStrength(parts) {
    const direct = parts.some(p => p.type === 'bottleneck');
    const strong = parts.filter(p => p.strong && p.type !== 'bottleneck').length;
    if (direct && strong >= 2) return 'Strong match';
    if ((direct && strong === 1) || strong >= 2) return 'Good match';
    if (direct || parts.some(p => p.specific)) return 'Partial match';
    return 'General suggestion';
  }

  function isEligible(opp, a, parts, resources) {
    if (opp.notFor && opp.notFor.includes(resources.level)) return false;
    // AI is only suggested when a specific answer points straight at it, never on indirect evidence alone.
    if (opp.kind === 'AI' && !parts.some(p => p.strong)) return false;
    if (opp.requires && opp.requires.industries && !opp.requires.industries.includes(a.industry) && !parts.some(p => p.type === 'keyword')) return false;
    if (opp.requires && opp.requires.withoutTools && opp.requires.withoutTools.some(t => a.tools.includes(t))) return false;
    return true;
  }

  function assessComplexity(opp, a, resources) {
    const c = opp.complexity;
    const res = resources || resourcesFor(a);
    let index = LEVELS.indexOf(c.level);
    const notes = [c.why];
    const toolLabels = values => listJoin(values.map(v => lower(labelFor('tools', v))));

    if (a.tools.length) {
      const helpful = (c.easierWith || []).filter(t => a.tools.includes(t));
      if (helpful.length) { index -= 1; notes.push(`You already use ${toolLabels(helpful)}, which this can build on.`); }
      if (c.harderWithout && !c.harderWithout.some(t => a.tools.includes(t))) { index += 1; notes.push(c.harderNote); }
      if (a.tools.includes('paper') && opp.digital) { index += 1; notes.push('Much of your information is on paper or handled manually, so it needs capturing digitally first.'); }
      if (a.tools.includes('custom') && opp.integrates) notes.push('Connecting to your in-house system depends on whether it can share data, for example through an API.');
    } else {
      notes.push('You skipped the tools question, so this assumes a typical setup.');
    }
    if ((a.stage === 'large' || a.stage === 'established') && opp.integrates) {
      index += 1;
      notes.push('At your size, security review, permissions and rollout across teams add effort.');
    }
    if (res.level === 'diy') {
      const why = res.inferred === 'notes' ? 'Your notes suggest a limited budget' : res.inferred === 'stage' ? 'As a very small business you may have limited budget and technical help' : 'You said you have a small budget and no technical staff';
      if (opp.integrates && index >= 1) { index += 1; notes.push(`${why}, so connecting systems would need a no-code tool or outside help.`); }
      else notes.push(`${why}. Start with off-the-shelf tools you can configure yourself.`);
    } else if (res.level === 'team' && opp.integrates && index > 0) {
      index -= 1;
      notes.push('Your technical staff or development partner could take on the integration work.');
    }
    const level = LEVELS[Math.max(0, Math.min(2, index))];
    return { level, label: LEVEL_LABELS[level], notes };
  }

  function buildReasons(parts, a) {
    const reasons = [];
    const of = type => parts.filter(p => p.type === type);
    if (of('bottleneck').length) reasons.push(`You named “${lower(labelFor('bottleneck', a.bottleneck))}” as your biggest bottleneck, and this addresses it directly.`);
    if (of('bottleneck-partial').length) reasons.push(`It eases part of your biggest bottleneck, “${lower(labelFor('bottleneck', a.bottleneck))}”, though it is not the main fix.`);
    const tasks = of('task');
    if (tasks.length) reasons.push(`You flagged ${listJoin(tasks.map(t => `“${t.label.replace(/^(Partly matches|Matches) a repetitive task: /, '')}”`))} as repetitive work, which this would ${tasks.every(t => !t.strong) ? 'help with' : 'take on'}.`);
    const keywords = of('keyword');
    if (keywords.length) reasons.push(`Your notes mention ${listJoin(keywords.map(k => k.label.replace('Your notes mention ', '')))}.`);
    if (of('objective-core').length) reasons.push(`It directly serves your main objective of ${focusFor(a.objective)}.`);
    if (of('objective').length) reasons.push(`It supports your objective of ${focusFor(a.objective)}.`);
    if (!parts.some(p => p.specific)) reasons.push('None of your specific answers point to this, so treat it as a general suggestion rather than a finding about your business.');
    return reasons;
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
      sequence: opp.sequence.map(f), questions: opp.questions.map(f), metrics: opp.metrics.map(f),
      estimateInputs: opp.estimateInputs.map(f), simplerFirst: opp.simplerFirst ? f(opp.simplerFirst) : ''
    };
  }

  function rankLibrary(a) {
    const resources = resourcesFor(a);
    return LIBRARY.map(opp => {
      const { score, parts } = scoreOpportunity(opp, a);
      const complexity = assessComplexity(opp, a, resources);
      const adjustments = [];
      const levelPenalty = LEVELS.indexOf(complexity.level) * PENALTY.perLevel;
      if (levelPenalty) adjustments.push({ label: `${complexity.label} complexity`, points: -levelPenalty });
      if (opp.goodFor && opp.goodFor.includes(resources.level)) adjustments.push({ label: 'Suited to limited budget and no technical staff', points: 1.5 });
      if (opp.kind === 'AI') {
        const ai = resources.level === 'diy' ? PENALTY.aiLimited : PENALTY.ai;
        adjustments.push({ label: resources.level === 'diy' ? 'AI option with limited resources: simpler options are preferred' : 'AI option: simpler options are preferred when close', points: -ai });
      }
      const priority = score + adjustments.reduce((sum, x) => sum + x.points, 0);
      return { opp, score, parts, complexity, adjustments, priority, match: matchStrength(parts), eligible: isEligible(opp, a, parts, resources) };
    }).filter(x => x.eligible && x.score > 0)
      .sort((x, y) => TIERS.indexOf(y.match) - TIERS.indexOf(x.match) || y.priority - x.priority || x.opp.id.localeCompare(y.opp.id));
  }

  /* One recommendation per problem area. The best runner-up in the same area is shown as "also considered". */
  function selectDistinct(ranked, count) {
    const picked = [];
    const byArea = new Map();
    const areasOf = opp => [opp.area, ...(opp.covers || [])];
    ranked.forEach(item => {
      const holder = areasOf(item.opp).map(area => byArea.get(area)).find(Boolean);
      if (holder) {
        if (!holder.alternative && item.parts.some(p => p.specific)) holder.alternative = item;
        return;
      }
      if (picked.length >= count) return;
      picked.push(item);
      areasOf(item.opp).forEach(area => { if (!byArea.has(area)) byArea.set(area, item); });
    });
    return picked;
  }

  const ORDINAL = ['first', 'second', 'third'];
  function rankNote(rank, item) {
    const specific = item.parts.filter(p => p.specific && p.type !== 'bottleneck').length;
    const direct = item.parts.some(p => p.type === 'bottleneck');
    const indirectOnly = !item.parts.some(p => p.strong);
    let because;
    if (direct && specific > 0) because = `it addresses your biggest bottleneck and ${specific === 1 ? 'one more of your specific answers points' : `${specific} more of your specific answers point`} to it`;
    else if (direct) because = 'it addresses your biggest bottleneck';
    else if (indirectOnly && item.parts.some(p => p.specific)) because = 'some of your answers point to it, though only indirectly';
    else if (specific > 1) because = `${specific} of your specific answers point to it`;
    else if (specific === 1) because = 'one of your specific answers points to it';
    else return `Ranked ${ORDINAL[rank - 1]} as a general suggestion. Your specific answers do not point to it.`;
    const easy = item.complexity.level === 'low' ? ', and it is rated low complexity' : '';
    return `Ranked ${ORDINAL[rank - 1]} because ${because}${easy}.`;
  }

  function alternativeNote(item) {
    const alt = item.alternative;
    if (!alt) return null;
    let why;
    if (alt.opp.kind === 'AI' && item.opp.kind !== 'AI') why = 'it uses AI for a problem the simpler option may solve; consider it if the simpler option is not enough';
    else if (LEVELS.indexOf(alt.complexity.level) > LEVELS.indexOf(item.complexity.level)) why = 'it addresses the same problem with more complexity';
    else why = 'fewer of your answers point to it';
    return { id: alt.opp.id, title: alt.opp.title, text: `Ranked lower because ${why}.` };
  }

  function buildRoadmap(picked) {
    const [first, second, third] = picked;
    const steps = [
      { phase: 'Prove', text: `Run the first experiment for “${first.title}”. Agree in advance which measure would make it worth continuing.` },
      { phase: 'Embed', text: `If the result holds up, make “${first.title}” part of everyday work and assign an owner.` }
    ];
    if (second) steps.push({ phase: 'Extend', text: `Start discovery for “${second.title}”, reusing any data, integrations or content the first step created.` });
    if (third) steps.push({ phase: 'Scope', text: `Scope “${third.title}” once the first two are stable, and revisit this plan with what you have learned.` });
    return steps;
  }

  function sharpenTips(a, general) {
    const tips = [];
    if (a.bottleneck === 'unsure') tips.push('Pick the one area where work gets stuck most often, even if it is only a hunch.');
    if (!a.tasks.length) tips.push('Select the tasks your team repeats every week.');
    if (!a.context) tips.push('Describe one frustrating process in a sentence or two in the notes.');
    if (!a.tools.length) tips.push('Say which tools you use, so complexity can be judged properly.');
    if (!a.capacity) tips.push('Say what budget and technical help you have, so suggestions match what you can support.');
    return general || tips.length >= 3 ? tips : [];
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
    const resources = resourcesFor(a);
    const ranked = rankLibrary(a);
    const specific = item => item.match === 'Strong match' || item.match === 'Good match';
    // In a specific report, weak filler (indirect evidence only, few points) is left out rather than padded in.
    const relevant = ranked.filter(item => item.parts.some(p => p.strong) || item.score >= 4);
    const general = !relevant.some(specific);
    const picked = selectDistinct(general ? ranked : relevant, 3);

    const opportunities = picked.map((item, i) => Object.assign({
      rank: i + 1,
      id: item.opp.id,
      title: item.opp.title,
      kind: item.opp.kind,
      area: item.opp.area,
      match: item.match,
      matchRule: MATCH_RULES[item.match],
      score: item.score,
      evidence: item.parts.map(p => ({ label: p.label, points: p.points, specific: p.specific })),
      adjustments: item.adjustments,
      rankNote: rankNote(i + 1, item),
      reasons: buildReasons(item.parts, a),
      complexity: item.complexity,
      alternative: alternativeNote(item)
    }, personalise(item.opp, words)));

    const industryLabel = a.industry === 'other' && a.industryOther ? a.industryOther : labelFor('industry', a.industry);
    const profile = {
      industry: industryLabel,
      stage: labelFor('stage', a.stage),
      objective: labelFor('objective', a.objective),
      bottleneck: labelFor('bottleneck', a.bottleneck),
      tasks: a.tasks.map(t => labelFor('tasks', t)),
      tools: a.tools.map(t => labelFor('tools', t)),
      capacity: a.capacity ? labelFor('capacity', a.capacity) : '',
      context: a.context,
      website: a.website ? normalizeWebsite(a.website).display : ''
    };
    const who = a.industry === 'other' && !a.industryOther ? 'a business' : `${article(industryLabel)} ${lower(industryLabel)} business`;
    const count = ['No', 'One', 'Two', 'Three'][opportunities.length];

    return {
      engine: ENGINE_VERSION,
      generatedAt: (opts.now || new Date()).toISOString(),
      answers: a,
      profile,
      general,
      resources,
      headline: general
        ? `Starting points for ${who} focused on ${focusFor(a.objective)}`
        : `${count} opportunities for ${who} focused on ${focusFor(a.objective)}`,
      summary: general
        ? (picked.some(item => item.parts.some(p => p.type === 'bottleneck'))
          ? 'Your biggest bottleneck points to the first suggestion, but nothing else you told us confirms it yet, so treat these as starting points rather than matches. The tips below would sharpen the result.'
          : 'Your answers do not point clearly to one problem, so these are general suggestions rather than matches. The tips below would sharpen the result.')
        : (a.bottleneck === 'unsure'
          ? `Based on your repetitive tasks and notes, and your objective of ${focusFor(a.objective)}.`
          : `Based mainly on where work gets stuck (${lower(profile.bottleneck)}) and your objective of ${focusFor(a.objective)}.`),
      sharpen: sharpenTips(a, general),
      shortfall: !general && opportunities.length < 3
        ? `Only ${opportunities.length === 1 ? 'one option fits' : 'two options fit'} your answers closely enough to suggest. More detail in the questions may surface others.`
        : '',
      opportunities,
      roadmap: buildRoadmap(opportunities),
      scoring: 'Points come only from your answers. Your biggest bottleneck, repetitive tasks and notes count as specific evidence and decide the match label. Options are ordered by match label first, then by points. Your objective, sector and size add smaller amounts, and within the same label, lower-complexity and non-AI options rank higher. Only one option per problem area is shown.',
      method: `These recommendations were generated in your browser by a rule-based engine. It ranks a fixed library of ${LIBRARY.length} AI, automation and software patterns, written by BuildWise Group, against the answers you gave. No AI model, market research or data about your business beyond your answers was used.`,
      // The website is never fetched, so the report says so instead of implying it was checked.
      websiteNote: profile.website ? `You added ${profile.website}, but the scanner did not visit or check it. This report is based only on your answers.` : '',
      limits: 'Because the library is fixed and the ranking depends only on your answers, it may miss opportunities that suit your business. These are general recommendations, not verified findings: confirming any of them would need a look at your actual processes and data. Benefits are possible outcomes to test, not measured results, and nothing here is a guaranteed outcome. Every option has costs, and the AI-based ones need human review.'
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
  const SHARE_KEYS = ['industry', 'industryOther', 'stage', 'objective', 'bottleneck', 'tasks', 'tools', 'capacity'];

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
    // Only the shareable answers are read from a link, even if one was edited to carry notes or a website.
    const shared = {};
    if (data && typeof data === 'object') SHARE_KEYS.forEach(k => { if (k in data) shared[k] = data[k]; });
    const { answers, valid } = normalizeAnswers(shared);
    if (!valid) throw new Error('This report link is incomplete.');
    return answers;
  }

  function toPlainText(report) {
    const lines = [];
    const rule = '-'.repeat(60);
    lines.push('BuildWise Group · AI Business Opportunity Scanner', report.headline, `Generated ${report.generatedAt.slice(0, 10)}`, '');
    lines.push('ABOUT THIS REPORT', report.method, report.scoring, report.limits, '');
    if (report.shortfall) lines.push(report.shortfall, '');
    if (report.sharpen.length) lines.push('TO GET A SHARPER REPORT', ...report.sharpen.map(t => `- ${t}`), '');
    lines.push('YOUR ANSWERS');
    const p = report.profile;
    lines.push(`Business: ${p.industry}`, `Size: ${p.stage}`, `Objective: ${p.objective}`, `Bottleneck: ${p.bottleneck}`);
    if (p.tasks.length) lines.push(`Repetitive tasks: ${p.tasks.join('; ')}`);
    if (p.tools.length) lines.push(`Tools: ${p.tools.join('; ')}`);
    if (p.capacity) lines.push(`Resources: ${p.capacity}`);
    if (p.context) lines.push(`Notes: ${p.context}`);
    if (report.websiteNote) lines.push(`Website: ${p.website} (not visited)`, report.websiteNote);
    report.opportunities.forEach(o => {
      lines.push('', rule, `${o.rank}. ${o.title} (${o.kind} · ${o.match})`, rule);
      if (o.rankNote) lines.push(o.rankNote);
      lines.push(`Match rule: ${o.matchRule}`);
      lines.push('', 'Why this was selected:', ...o.reasons.map(r => `- ${r}`));
      lines.push('', 'How this was scored:', ...o.evidence.map(e => `- ${e.label}: ${e.points > 0 ? '+' : ''}${e.points}`), ...o.adjustments.map(x => `- Ranking adjustment, ${lower(x.label)}: ${x.points}`));
      if (o.alternative) lines.push('', `Also considered: ${o.alternative.title}. ${o.alternative.text}`);
      lines.push('', `Problem: ${o.problem}`, '', `Proposed solution: ${o.solution}`, '', 'How it would work:', ...o.how.map((h, i) => `${i + 1}. ${h}`));
      if (o.simplerFirst) lines.push('', `Before using AI: ${o.simplerFirst}`);
      lines.push('', 'Possible benefits to validate (not measured results):', ...o.benefits.map(b => `- ${b}`));
      lines.push('', `Implementation complexity: ${o.complexity.label}`, ...o.complexity.notes.map(n => `- ${n}`));
      lines.push('', 'Dependencies:', ...o.dependencies.map(d => `- ${d}`), '', 'Risks and limitations:', ...o.risks.map(r => `- ${r}`));
      lines.push('', `Suggested first experiment: ${o.experiment}`, '', 'Success metrics to track:', ...o.metrics.map(m => `- ${m}`));
      lines.push('', 'Needed to estimate costs, savings or ROI:', ...o.estimateInputs.map(m => `- ${m}`));
      lines.push('', 'Indicative sequence:', ...o.sequence.map((s, i) => `${i + 1}. ${s}`));
    });
    lines.push('', rule, 'INDICATIVE PLAN', ...report.roadmap.map((s, i) => `${i + 1}. ${s.phase}: ${s.text}`));
    return lines.join('\n');
  }

  return { ENGINE_VERSION, LIMITS, QUESTIONS, LIBRARY, LEVELS, MATCH_RULES, normalizeAnswers, normalizeWebsite, generateReport, matchBrief, encodeAnswers, decodeAnswers, toPlainText, scoreOpportunity, assessComplexity, resourcesFor };
});
