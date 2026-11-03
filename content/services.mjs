/*
 * Service landing pages. scripts/build-pages.mjs turns each entry into /<slug>.
 *
 * Claims rules (see tests/growth.test.js): no client results, testimonials, prices,
 * turnaround promises, rankings, "leading"/"best"/"number one", guaranteed AI
 * recommendations, office addresses or local staff. BuildWise is remote-first.
 * Evidence comes only from what the site already shows: Huntly (live), Traider (in
 * development), Staff with its example employee Maya (in validation), the scanner and
 * website audit on this site, and website maintenance for an aesthetics business
 * (unnamed until the client gives written permission).
 */
export const SITE = 'https://buildwisegroup.dev';
export const WA_NUMBER = '2349165681202';

// Pages that service pages may link to as "related" besides each other.
export const STATIC_PAGES = {
  cybersecurity: { slug: 'cybersecurity', navName: 'Application & cloud security', summary: 'Scoped, authorised security reviews of web apps, APIs, cloud and AI features.' },
  'website-audit': { slug: 'website-audit', navName: 'Free website & AI visibility audit', summary: 'An automated, read-only check of how search engines and AI crawlers see your site.' },
  scan: { slug: 'scan', navName: 'AI Business Opportunity Scanner', summary: 'Eight questions, a rule-based report on where AI or automation could help.' }
};

const PROCESS = {
  heading: 'Small first version.<br class="br-md"> Evidence before scale.',
  note: 'We would rather automate one workflow that works every day than ten that look good in a demo. Each stage ends with something you can see and decide on.',
  steps: [
    { h: 'Discovery call', p: 'A short conversation about the work as it happens today: who does it, how often, which tools are involved and what a better outcome looks like.' },
    { h: 'Map and prioritise', p: 'We map the workflow, mark the steps worth automating and the ones that should stay human, and agree what “working” means in measurable terms.' },
    { h: 'Build a focused first version', p: 'One workflow, built around your existing tools, with logging, error handling and a clear way for a person to step in.' },
    { h: 'Test with real cases', p: 'We run it against real (or realistic) examples, including the awkward ones, and fix what breaks before anyone depends on it.' },
    { h: 'Launch, measure, extend', p: 'It goes live with your team, we watch the results together, and the evidence decides what we automate next.' }
  ]
};

const AREA_NG_WORLD = [{ '@type': 'Country', name: 'Nigeria' }, { '@type': 'Place', name: 'Worldwide' }];

export const SERVICES = [
  /* ------------------------------------------------------------------ */
  {
    slug: 'ai-automation-nigeria',
    navName: 'AI automation in Nigeria',
    summary: 'AI agents, WhatsApp and workflow automation for Nigerian businesses, delivered remotely.',
    lastmod: '2026-11-03',
    title: 'AI Automation Company in Nigeria | BuildWise Group',
    ogTitle: 'AI Automation Solutions for Businesses in Nigeria — BuildWise Group',
    description: 'BuildWise Group builds AI automation for Nigerian businesses: AI agents, WhatsApp automation, lead handling and workflow automation, delivered remotely across Nigeria.',
    serviceName: 'AI automation for businesses in Nigeria',
    serviceType: 'AI automation services',
    projectType: 'AI automation audit',
    cta: 'Request an AI automation audit',
    headerCta: 'Request an audit',
    waText: 'Hello Buildwise, I would like to discuss AI automation for my business in Nigeria.',
    label: 'AI automation · Nigeria',
    h1Lines: ['AI automation solutions', 'for businesses in Nigeria.'],
    lead: 'We design and build AI agents, WhatsApp automation and workflow automation that take repetitive work off your team, so enquiries get answered, leads get followed up and operations run with fewer manual steps.',
    facts: ['Remote-first, serving businesses across Nigeria', 'Built around the tools you already use', 'Human oversight where it matters'],
    glance: [
      ['Who it’s for', 'Nigerian SMEs and growing companies with repetitive customer or back-office work'],
      ['First step', 'An AI automation audit: one call, then a short written view of what to automate first'],
      ['Channels', 'WhatsApp, web chat, email, forms, spreadsheets, CRMs and internal tools'],
      ['How we work', 'Remotely, by video call, WhatsApp and shared documents. No physical office.']
    ],
    intro: {
      label: 'What AI automation means',
      heading: 'Software that handles the routine, so people handle the judgement.',
      paras: [
        '<strong>AI automation</strong> is the use of software, including AI models that can read and write language, to complete business tasks that used to need a person at every step. Classic automation follows fixed rules: when a form is submitted, copy it to a spreadsheet. AI automation can also deal with messy input, such as a customer’s WhatsApp message, a scanned invoice or an email asking three questions at once.',
        'For a Nigerian business, that usually means answering the same customer questions at any hour, qualifying leads before a salesperson calls, booking appointments, moving data between systems without retyping it, and producing routine documents and reports.',
        'BuildWise Group is a remote-first technology company. We work with businesses in Lagos, Abuja, Port Harcourt and across Nigeria, and with international clients, without a physical office. Discovery, design, delivery and support all happen remotely.'
      ]
    },
    uses: {
      label: 'What can be automated',
      heading: 'Where AI automation<br class="br-md"> earns its keep.',
      note: 'These are the areas we look at first, because they are frequent, repetitive and easy to measure. Your audit will tell you which ones are worth it for your business.',
      items: [
        { h: 'Customer enquiries and support', p: 'Answer common questions on WhatsApp or your website from your own price lists, policies and FAQs, and hand anything unusual to a person with the full conversation attached. See <a href="/whatsapp-automation">WhatsApp automation</a>.' },
        { h: 'Lead capture and qualification', p: 'Ask the right questions when a lead arrives, score it against your criteria, add it to your CRM or sheet and alert the right salesperson, so no enquiry sits unanswered.' },
        { h: 'AI agents for multi-step work', p: 'Agents that read a request, look up information in your systems and take approved actions, such as checking stock or creating a booking. See <a href="/ai-agents">AI agents</a>.' },
        { h: 'Bookings and reminders', p: 'Let customers pick a slot, confirm it, send reminders and reduce no-shows, with your staff seeing the same calendar. See <a href="/ai-receptionist">AI receptionists</a>.' },
        { h: 'Back-office workflows', p: 'Invoices, approvals, onboarding, reporting and data entry between tools that don’t talk to each other. See <a href="/business-automation">business automation</a>.' }
      ]
    },
    caps: {
      label: 'What we build',
      heading: 'Three building blocks,<br class="br-md"> one connected system.',
      note: 'Most projects combine more than one. We recommend the simplest combination that does the job.',
      items: [
        { icon: 'i-chat', h: 'Conversational automation', lead: 'Assistants that talk to customers on the channels they already use.', ticks: ['WhatsApp Business Platform and website chat', 'Answers grounded in your own information', 'Human handover with conversation history', 'English, with other languages tested before launch'] },
        { icon: 'i-ai', h: 'AI agents', lead: 'Software that reads, decides within rules you set and takes approved actions.', ticks: ['Lead qualification and routing', 'Look-ups in your systems and documents', 'Limited, logged permissions for every action', 'Escalation when confidence is low'] },
        { icon: 'i-flow', h: 'Workflow automation', lead: 'The plumbing that moves data and tasks between your tools.', ticks: ['CRMs, spreadsheets, email and accounting tools', 'Notifications, approvals and reports', 'Low-code tools or custom code, whichever fits', 'Monitoring so failures are noticed'] }
      ]
    },
    process: PROCESS,
    proof: {
      label: 'What we have built',
      heading: 'We build and run our own AI products, not just client projects.',
      paras: [
        '<strong>Staff</strong> is our AI employee platform. Its example employee, Maya, is an AI receptionist that is being validated on everyday workflows such as enquiries and bookings. <strong>Huntly</strong>, our AI job-search assistant, is live. The <a href="/scan">AI Business Opportunity Scanner</a> on this site was built in-house too.',
        'We also maintain the website of an aesthetics business and have worked with them on Maya. We name clients only with their permission, and we don’t publish results we can’t show.'
      ]
    },
    honesty: { title: 'What we won’t promise.', text: 'We don’t quote percentage savings before we have seen your workflow, and AI is not the answer to every problem. If a spreadsheet, a better form or a clearer process would solve it, the audit will say so.' },
    faq: [
      ['How much does AI automation cost in Nigeria?', 'It depends on the workflow, the number of systems involved and the volume of messages or tasks. We quote after the discovery call and audit, in naira or US dollars. Running costs, such as WhatsApp message charges from Meta and AI model usage, are shown separately so you can see what you pay each month.'],
      ['Do you have an office in Lagos or Abuja?', 'No. BuildWise Group is remote-first and does not have a physical office. We work with clients across Nigeria and internationally by video call, WhatsApp and shared documents, and that is how discovery, delivery and support happen.'],
      ['What is an AI automation audit?', 'A short, structured review of where time goes in your business. After one call (and any examples you can share), we send a written view of the two or three workflows most worth automating, what each would involve, the risks, and a suggested first version. If automation isn’t worth it yet, we say so.'],
      ['Will AI replace my staff?', 'That is not how we design systems. Automation takes over repetitive steps, such as answering the same question or retyping data, so your team can spend time on customers and decisions. Every system we build has a clear way for a person to step in.'],
      ['Is customer data safe, and what about the NDPA?', 'We design with the Nigeria Data Protection Act 2023 in mind: collect only what the workflow needs, tell customers how their data is used, control who can access it and choose providers carefully. We can’t give legal advice, so we recommend you confirm your obligations with a data protection professional.'],
      ['Which tools and platforms do you work with?', 'Whatever your business already uses where it offers a way to connect, such as an API: CRMs, spreadsheets, email, booking tools, accounting software and the WhatsApp Business Platform. We use low-code automation tools where they are enough and custom code where they aren’t.'],
      ['Do you work with businesses outside Nigeria?', 'Yes. Nigeria is our first market, and we work remotely with international clients too.']
    ],
    related: ['ai-automation-lagos', 'ai-agents', 'whatsapp-automation', 'business-automation'],
    enquire: {
      heading: ['Find out what’s', 'worth automating first.'],
      intro: 'Tell us about your business and where work piles up. We’ll reply to book a short discovery call, then send a written audit.',
      include: ['What your business does and roughly how many people work in it', 'The tasks that take the most time or get missed', 'The tools you use today, such as WhatsApp, Excel or a CRM', 'Where your customers are: Lagos, across Nigeria or abroad'],
      messageLabel: 'Where does work pile up today?',
      messageHint: 'Describe the tasks you’d like to automate, how often they happen and the tools involved. No passwords or customer data, please.'
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'ai-automation-lagos',
    navName: 'AI automation in Lagos',
    summary: 'Remote AI automation for Lagos businesses: enquiries, bookings, leads and operations.',
    lastmod: '2026-11-03',
    title: 'AI Automation Services in Lagos | BuildWise Group',
    ogTitle: 'AI Automation Services for Businesses in Lagos — BuildWise Group',
    description: 'AI automation for Lagos businesses: WhatsApp assistants, AI agents, booking and lead automation. BuildWise Group is a remote-first company serving Lagos clients.',
    serviceName: 'AI automation for businesses in Lagos',
    serviceType: 'AI automation services',
    areaServed: [{ '@type': 'City', name: 'Lagos', containedInPlace: { '@type': 'Country', name: 'Nigeria' } }],
    projectType: 'AI automation audit',
    cta: 'Book a consultation',
    waText: 'Hello Buildwise, I run a business in Lagos and would like to discuss AI automation.',
    label: 'AI automation · Lagos',
    h1Lines: ['AI automation services', 'for businesses in Lagos.'],
    lead: 'Lagos businesses run on WhatsApp, Instagram DMs and phone calls, and the busiest ones lose enquiries every day. We build AI automation that answers, qualifies and books customers around the clock, with your team in control.',
    facts: ['A remote technology partner for Lagos businesses', 'No office visits needed: we work by video call and WhatsApp', 'Your team stays in control of every conversation'],
    glance: [
      ['Who it’s for', 'Lagos businesses with busy customer channels: retail, clinics, real estate, logistics, hospitality, services'],
      ['First step', 'A discovery call, then a written view of what to automate first'],
      ['Where we are', 'Remote-first. We don’t have a Lagos office or walk-in service.'],
      ['Also see', '<a href="/ai-automation-nigeria">AI automation across Nigeria</a>']
    ],
    intro: {
      label: 'A remote partner for Lagos',
      heading: 'Lagos moves fast. Your replies should too.',
      paras: [
        'In Lagos, a customer who waits an hour for a reply has often bought somewhere else. Many businesses still rely on one or two people answering WhatsApp, checking DMs and copying orders into a notebook or spreadsheet. That works until it doesn’t: at weekends, after hours, or the day the order volume doubles.',
        '<strong>AI automation</strong> lets software handle the predictable part of that work: answering common questions from your own price list, taking booking details, qualifying a lead, confirming an order and updating your records, while your staff handle negotiation, complaints and anything unusual.',
        'BuildWise Group is a <strong>remote-first</strong> technology company. We serve Lagos businesses remotely and do not have a physical office, local walk-in service or field staff in Lagos. For most automation projects that is an advantage: no one sits in traffic for a meeting, and everything we agree is written down.'
      ]
    },
    uses: {
      label: 'Typical Lagos use cases',
      heading: 'Built for how Lagos<br class="br-md"> businesses actually sell.',
      note: 'Examples of workflows we design for. Each one starts as a small, measurable first version.',
      items: [
        { h: 'Retail and e-commerce on WhatsApp and Instagram', p: 'Answer “how much?”, “do you have it in size 42?” and “do you deliver to Lekki?” instantly from your catalogue, then pass the ready-to-buy customer to a salesperson with the order details.' },
        { h: 'Clinics, salons and aesthetics', p: 'Take appointment requests, confirm slots, send reminders and answer pre-visit questions, with clinical questions always sent to a person.' },
        { h: 'Real estate and property', p: 'Qualify enquiries by budget, location and timeline, share matching listings and book inspections for your agents.' },
        { h: 'Logistics and delivery', p: 'Let customers check order status, book pickups and get updates without calling your dispatch line.' },
        { h: 'Professional services and B2B', p: 'Capture and qualify leads from your website and WhatsApp, follow up automatically and keep your CRM up to date.' }
      ]
    },
    process: {
      ...PROCESS,
      heading: 'Remote by design.<br class="br-md"> Clear at every step.',
      note: 'Every stage happens over video calls, WhatsApp and shared documents, so decisions are written down and nobody loses an afternoon to Third Mainland Bridge.'
    },
    proof: {
      label: 'Evidence, labelled plainly',
      heading: 'What we have built so far.',
      paras: [
        '<strong>Staff</strong>, our AI employee platform, is being validated on everyday workflows such as enquiries and bookings; Maya, an AI receptionist, is its example employee. We have worked with an aesthetics business on Maya and maintain its website. <strong>Huntly</strong>, our AI job-search assistant, is live.',
        'We name clients only with their permission, and we don’t publish figures we can’t show you.'
      ]
    },
    honesty: { title: 'Remote-first, stated plainly.', text: 'We don’t have a Lagos office, and we won’t pretend to. If your project needs someone on site, such as installing hardware, we’ll tell you at the start so you can arrange it locally.' },
    faq: [
      ['Is BuildWise based in Lagos?', 'BuildWise Group is a remote-first company and does not have a physical office in Lagos. We serve Lagos businesses remotely, and all discovery, delivery and support happens by video call, WhatsApp and shared documents.'],
      ['Can we meet in person?', 'Our standard way of working is remote. If an in-person session would genuinely help your project, raise it on the discovery call and we’ll tell you honestly whether we can arrange it.'],
      ['How quickly can a first version go live?', 'It depends on the workflow and how quickly accounts such as WhatsApp Business Platform access can be set up. We give you a plan with stages after discovery rather than a promise before we understand the work.'],
      ['Will the assistant understand Pidgin or Yoruba?', 'Modern AI models handle Nigerian English and Pidgin reasonably well, and Yoruba, Igbo and Hausa less consistently. We test with real messages from your customers before launch, and anything the assistant isn’t sure about goes to a person.'],
      ['What if the AI gives a wrong answer?', 'Assistants answer from information you approve, such as prices and policies, and are told to hand over when they are unsure. Conversations are logged so you can review them, and we tune the system during the first weeks.'],
      ['How is pricing handled?', 'We quote per project after discovery, in naira or US dollars. Ongoing costs, such as WhatsApp message charges and AI model usage, are shown separately.']
    ],
    related: ['ai-automation-nigeria', 'whatsapp-automation', 'ai-receptionist', 'ai-agents'],
    enquire: {
      heading: ['Tell us where your', 'customers are waiting.'],
      intro: 'Describe your business and the conversations or tasks that slow you down. We’ll reply to book a short discovery call.',
      include: ['What you sell and where in Lagos your customers are', 'Which channels customers use: WhatsApp, Instagram, calls, website', 'Roughly how many enquiries you get in a busy week', 'The tools you use today'],
      messageLabel: 'What would you like to automate?',
      messageHint: 'Describe the enquiries, bookings or tasks that take the most time. No passwords or customer data, please.'
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'ai-agents',
    navName: 'AI agents',
    summary: 'Custom AI agents for support, sales, enquiries and internal operations, with guardrails.',
    lastmod: '2026-11-03',
    title: 'Custom AI Agent Development | BuildWise Group',
    ogTitle: 'Custom AI Agents for Business Operations — BuildWise Group',
    description: 'BuildWise Group designs and builds custom AI agents for customer support, sales, enquiries and internal operations, with limited permissions, logging and human handover.',
    serviceName: 'Custom AI agent development',
    serviceType: 'AI agent development',
    projectType: 'AI agents and AI employees',
    cta: 'Discuss an AI agent',
    waText: 'Hello Buildwise, I would like to discuss building an AI agent for my business.',
    label: 'AI agents',
    h1Lines: ['Custom AI agents', 'that do real work,', 'safely.'],
    lead: 'An AI agent reads a request, works out what to do and takes approved actions in your systems. We build agents for customer support, sales, enquiries and internal operations, with limits, logs and a person in the loop.',
    facts: ['Narrow permissions for every action', 'Every decision logged and reviewable', 'Escalates to a person when unsure'],
    glance: [
      ['Who it’s for', 'Businesses with high-volume, rules-based work that still needs reading and judgement'],
      ['First step', 'A discovery call to pick one workflow and define what the agent may and may not do'],
      ['Built with', 'Leading AI models, chosen per task, connected to your systems through their APIs'],
      ['Where', 'Remote-first. Nigeria and international clients.']
    ],
    intro: {
      label: 'What an AI agent is',
      heading: 'More than a chatbot. Less than a magic employee.',
      paras: [
        'A traditional chatbot follows a script: if the customer says X, reply Y. An <strong>AI agent</strong> uses a language model to understand a request in plain words, decide which steps are needed, use tools you have allowed (such as searching your product list, checking an order or creating a booking) and report back.',
        'That makes agents useful for work that is repetitive but not perfectly predictable: a customer asking three questions in one message, an email that needs classifying and routing, or a sales enquiry that needs qualifying before a person gets involved.',
        'Agents also make mistakes. Good agent design is mostly about limits: what the agent can see, which actions it may take, when it must ask a person, and how every step is recorded. That is where most of our engineering effort goes.'
      ]
    },
    uses: {
      label: 'Use cases',
      heading: 'Where agents<br class="br-md"> are worth it.',
      note: 'We start with one agent and one workflow. If it works, the same foundations carry the next one.',
      items: [
        { h: 'Customer support agents', p: 'Answer questions from your documentation, look up order or account status and hand complex cases to your team with a summary, on WhatsApp, web chat or email.' },
        { h: 'Sales and lead qualification agents', p: 'Respond to new leads in minutes, ask qualifying questions, update your CRM and book a call with the right salesperson.' },
        { h: 'Enquiry and booking agents', p: 'Handle availability questions, take booking details and confirm appointments. Maya, the example employee on our Staff platform, is an AI receptionist built for this kind of work.' },
        { h: 'Internal operations agents', p: 'Triage incoming emails and documents, extract the data that matters, draft replies and reports, and route tasks to the right person.' },
        { h: 'Knowledge assistants', p: 'Give your team fast, cited answers from your own policies, contracts and manuals, with access limited to what each person is allowed to see.' }
      ]
    },
    caps: {
      label: 'How we build agents',
      heading: 'Guardrails are<br class="br-md"> the product.',
      note: 'The parts that make an agent safe to rely on are designed in from the start, not added after the demo.',
      items: [
        { icon: 'i-ai', h: 'Reasoning and grounding', lead: 'The agent answers from your information, not from guesswork.', ticks: ['Retrieval from your documents and data', 'Model choice matched to the task and budget', 'Clear instructions and tested prompts', 'Evaluation sets built from real cases'] },
        { icon: 'i-app', h: 'Tools and permissions', lead: 'Every action the agent can take is explicit and limited.', ticks: ['Least-privilege access to each system', 'Approval steps for sensitive actions', 'Rate limits and spending limits', 'Defences against prompt injection'] },
        { icon: 'i-chat', h: 'Oversight and handover', lead: 'People stay in charge of the outcome.', ticks: ['Handover to a person with full context', 'Logs of every conversation and action', 'Dashboards for review and correction', 'Regular tuning from real conversations'] }
      ]
    },
    process: PROCESS,
    proof: {
      label: 'Our own agents',
      heading: 'We build agents into our own products first.',
      paras: [
        '<strong>Huntly</strong>, our live AI job-search assistant, evaluates opportunities against a person’s profile and helps prepare applications. <strong>Staff</strong>, our AI employee platform, is in validation, with Maya, an AI receptionist, as its example employee.',
        'Because AI agents can be steered by untrusted input, we also review agent security as a service: see <a href="/cybersecurity">Application &amp; Cloud Security Review</a>.'
      ]
    },
    honesty: { title: 'Agents are not infallible.', text: 'Any agent built on a language model can misread a request. We design for that with limited permissions, confirmation steps and human handover, and we’ll recommend against an agent where a mistake would be costly and a simpler system would do.' },
    faq: [
      ['What is the difference between an AI agent and a chatbot?', 'A scripted chatbot follows a fixed decision tree. An AI agent understands free-form requests and can take actions you allow, such as checking an order or creating a booking. Agents are more flexible, and need more careful limits.'],
      ['Which AI models do you use?', 'We choose per task, from established providers, weighing quality, speed, cost and where data is processed. Agents are built so the model can be changed later without rebuilding everything.'],
      ['Can an agent work on WhatsApp?', 'Yes, through the WhatsApp Business Platform, subject to Meta’s policies on opt-in, message templates and business verification. See <a href="/whatsapp-automation">WhatsApp automation</a>.'],
      ['How do you stop an agent doing something it shouldn’t?', 'It only gets the permissions the workflow needs, sensitive actions need confirmation, every action is logged, and inputs from customers or documents are treated as untrusted. We test these limits before launch.'],
      ['Can you connect an agent to our existing systems?', 'Usually, if the system offers an API or another reliable way to connect. We check this in discovery, and if a system can’t be connected safely we’ll say so.'],
      ['Do you build AI employees?', 'Staff, our AI employee platform, is still being validated. For client work we build focused agents for specific workflows, which is the honest way to start.']
    ],
    related: ['whatsapp-automation', 'ai-receptionist', 'business-automation', 'cybersecurity'],
    enquire: {
      heading: ['Describe the work', 'you want an agent to do.'],
      intro: 'We’ll reply to arrange a short discovery call and help you decide whether an agent is the right tool.',
      include: ['The task, and who does it today', 'How often it happens and what a good result looks like', 'The systems the agent would need to read or update', 'Anything it must never do'],
      messageLabel: 'What should the agent handle?',
      messageHint: 'Describe the workflow, the systems involved and any limits. No passwords or customer data, please.'
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'whatsapp-automation',
    navName: 'WhatsApp automation',
    summary: 'WhatsApp AI assistants for enquiries, lead qualification, bookings and notifications.',
    lastmod: '2026-11-03',
    title: 'WhatsApp Automation & AI Chatbots in Nigeria | BuildWise Group',
    ogTitle: 'WhatsApp Business Automation and AI Chatbots — BuildWise Group',
    description: 'WhatsApp automation for Nigerian businesses: AI chatbots that answer enquiries, qualify leads, book appointments, send notifications and hand over to your team.',
    serviceName: 'WhatsApp business automation',
    serviceType: 'WhatsApp chatbot and automation development',
    projectType: 'WhatsApp automation',
    cta: 'Discuss WhatsApp automation',
    waText: 'Hello Buildwise, I would like to discuss WhatsApp automation for my business.',
    label: 'WhatsApp automation',
    h1Lines: ['WhatsApp automation', 'that answers, qualifies', 'and hands over.'],
    lead: 'Your customers already message you on WhatsApp. We build WhatsApp assistants on the official WhatsApp Business Platform that reply instantly, qualify leads, book appointments and send updates, and bring in your team when a person is needed.',
    facts: ['Built on Meta’s official WhatsApp Business Platform', 'Opt-in and template rules respected', 'Seamless handover to your staff'],
    glance: [
      ['Who it’s for', 'Businesses that get more WhatsApp messages than their team can answer quickly'],
      ['First step', 'A discovery call and a review of a sample of real (anonymised) conversations'],
      ['You’ll need', 'A Meta Business account, a phone number for the API and business verification'],
      ['Connects to', 'Your CRM, spreadsheet, booking calendar, order system or payment links']
    ],
    intro: {
      label: 'What WhatsApp automation is',
      heading: 'From a busy inbox to a system that replies.',
      paras: [
        '<strong>WhatsApp automation</strong> means software handles part of your WhatsApp conversations: greeting customers, answering common questions, collecting details, booking appointments and sending updates such as order confirmations. An <strong>AI chatbot</strong> adds a language model, so it can understand messages written in everyday language rather than only fixed menu choices.',
        'The WhatsApp Business <em>app</em> on a phone offers simple greeting and away messages. Real automation runs on the WhatsApp Business <em>Platform</em> (the API), which Meta provides for businesses through its Cloud API or through partners. It supports multiple agents, integrations and automated replies, and it comes with rules: customers must opt in to receive messages from you, messages you start outside a customer-service window need pre-approved templates, and Meta charges for some message types.',
        'We set this up properly, design the conversations, connect them to your systems and make sure a person can take over any chat at any time.'
      ]
    },
    uses: {
      label: 'What it can do',
      heading: 'Seven jobs a WhatsApp<br class="br-md"> assistant can take on.',
      note: 'Most businesses start with two or three of these and add more once the first ones are working.',
      items: [
        { h: 'Automated conversations', p: 'Instant answers to common questions about prices, availability, delivery areas and opening hours, drawn from information you approve.' },
        { h: 'Lead qualification', p: 'Ask what the customer needs, their budget and timeline, then route hot leads to a salesperson and log every lead in your CRM or sheet.' },
        { h: 'Appointment bookings', p: 'Offer available slots, confirm bookings and send reminders, synced with the calendar your team uses.' },
        { h: 'Customer support', p: 'Track orders, explain policies and collect complaint details so your team starts with the facts.' },
        { h: 'CRM integration', p: 'Every conversation linked to a customer record, so anyone on your team can see the history.' },
        { h: 'Human handover', p: 'When the assistant is unsure, or the customer asks for a person, the chat moves to your staff with a summary, and the bot stays quiet until handed back.' },
        { h: 'Business notifications', p: 'Order confirmations, delivery updates, payment reminders and appointment reminders sent with approved templates to customers who opted in.' }
      ]
    },
    process: PROCESS,
    proof: {
      label: 'Our experience',
      heading: 'WhatsApp is how we talk to clients too.',
      paras: [
        'WhatsApp is one of the two ways to contact BuildWise, so we design for it as users, not just builders. Our AI employee platform, <strong>Staff</strong>, is being validated on enquiry and booking workflows, the same jobs most WhatsApp assistants do.',
        'We also review the security of AI assistants that handle customer data: see <a href="/cybersecurity">Application &amp; Cloud Security Review</a>.'
      ]
    },
    honesty: { title: 'No spam, no shortcuts.', text: 'We only build on Meta’s official platform, and we don’t build bulk-messaging tools for people who haven’t opted in. Unofficial WhatsApp automation tools risk getting your number banned.' },
    faq: [
      ['What is the difference between the WhatsApp Business app and the WhatsApp Business Platform?', 'The app is for small teams answering manually on a phone, with basic quick replies and away messages. The Platform (API) is for automation: chatbots, multiple agents, integrations and notifications at scale. It needs a Meta Business account and follows Meta’s policies.'],
      ['How much does WhatsApp automation cost?', 'There are two parts: building the assistant, which we quote after discovery, and running costs. Running costs include Meta’s charges for certain message types, AI model usage and any hosting or partner fees. Meta sets and changes its own pricing, so we show you current rates for your country during scoping.'],
      ['Can I keep my current WhatsApp number?', 'Often yes, but a number registered on the Platform can’t be used in the regular WhatsApp app at the same time. Many businesses use a new number for the automated line. We’ll walk through the options before anything changes.'],
      ['Can it send messages to all my customers?', 'Only to customers who have opted in to hear from you, using approved message templates. Messaging people who haven’t opted in breaks WhatsApp’s policies and puts your number at risk.'],
      ['Can it take payments?', 'It can send payment links from your payment provider and confirm when a payment comes through, if the provider supports that. Card details are never collected in the chat.'],
      ['Does it understand Pidgin and local languages?', 'AI models handle Nigerian English and Pidgin reasonably well, and Yoruba, Igbo and Hausa less consistently. We test with real messages before launch and route anything uncertain to a person.']
    ],
    related: ['ai-receptionist', 'ai-agents', 'business-automation', 'ai-automation-lagos'],
    enquire: {
      heading: ['Let’s automate your', 'WhatsApp inbox.'],
      intro: 'Tell us how your team uses WhatsApp today. We’ll reply to book a short discovery call.',
      include: ['Roughly how many WhatsApp messages you get in a week', 'The questions customers ask most', 'Whether you use the WhatsApp Business app or the API today', 'The tools you’d want it connected to'],
      messageLabel: 'How do customers use WhatsApp with you?',
      messageHint: 'Describe the conversations you’d like automated and the tools involved. No passwords or customer data, please.'
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'custom-software-development',
    navName: 'Custom software development',
    summary: 'Web apps, mobile apps, SaaS products, internal tools and integrations.',
    lastmod: '2026-11-03',
    title: 'Custom Software Development Company in Nigeria | BuildWise Group',
    ogTitle: 'Custom Software Development — BuildWise Group',
    description: 'BuildWise Group builds custom software for businesses in Nigeria and abroad: web and mobile apps, SaaS products, internal tools, integrations and AI-powered features.',
    serviceName: 'Custom software development',
    serviceType: 'Custom software development',
    projectType: 'SaaS or web application development',
    cta: 'Discuss your software project',
    headerCta: 'Discuss a project',
    waText: 'Hello Buildwise, I would like to discuss a custom software project.',
    label: 'Custom software development',
    h1Lines: ['Custom software,', 'engineered for', 'how you work.'],
    lead: 'When off-the-shelf tools don’t fit, we design and build the software that does: web and mobile applications, SaaS products, internal tools and integrations, with AI built in where it genuinely helps.',
    facts: ['Product thinking before code', 'Secure, tested and documented', 'You own the code we write for you'],
    glance: [
      ['Who it’s for', 'Businesses and founders in Nigeria and abroad with a product to build or a process off-the-shelf software can’t handle'],
      ['What we build', 'Web apps, mobile apps, SaaS, internal tools, APIs and integrations'],
      ['First step', 'A discovery call, then a written scope with a focused first release'],
      ['After launch', 'Maintenance and improvement, agreed per project']
    ],
    intro: {
      label: 'When custom software makes sense',
      heading: 'Buy what you can. Build what makes you different.',
      paras: [
        '<strong>Custom software development</strong> is designing and building software for a specific business need, instead of adapting a generic product. It makes sense when your process is a competitive advantage, when you are building a product to sell, or when the tools you pay for don’t talk to each other and your team fills the gaps by hand.',
        'It doesn’t make sense when a well-supported product already does the job. Part of our work is telling you which is which, before you spend money.',
        'BuildWise Group builds and owns its own products, so we approach client software the same way: define the problem, ship a focused first version, measure, then extend. We work remotely with clients in Nigeria and internationally.'
      ]
    },
    uses: {
      label: 'What we build',
      heading: 'From first product<br class="br-md"> to internal system.',
      note: 'Typical projects. Many combine a web application, an API and automation behind the scenes.',
      items: [
        { h: 'Web applications and SaaS products', p: 'Customer-facing platforms with sign-in, payments, dashboards and admin tools, built to grow from first users to many.' },
        { h: 'Mobile applications', p: 'Apps for Android and iOS where a mobile experience is genuinely needed, sharing a back end with your web product.' },
        { h: 'Internal tools and dashboards', p: 'Replace the spreadsheet that runs your business with a tool your team can rely on, with proper permissions and audit trails.' },
        { h: 'Integrations and APIs', p: 'Connect your CRM, payment provider, accounting software and operations tools so data flows without retyping.' },
        { h: 'AI-powered features', p: 'Search, summarisation, document processing, recommendations and assistants added to new or existing software. See <a href="/ai-agents">AI agents</a>.' }
      ]
    },
    caps: {
      label: 'Engineering standards',
      heading: 'Built to be run,<br class="br-md"> not just launched.',
      note: 'What every project includes, whatever its size.',
      items: [
        { icon: 'i-code', h: 'Sound engineering', lead: 'Readable code your team or ours can maintain.', ticks: ['Version control and code review', 'Automated tests for critical paths', 'Documentation and handover notes', 'Code ownership agreed in the contract'] },
        { icon: 'i-shield', h: 'Security by default', lead: 'The basics done properly from day one.', ticks: ['Authentication and access control', 'Secrets kept out of code', 'Data protection designed in (NDPA, GDPR where relevant)', 'Security review available: <a href="/cybersecurity">learn more</a>'] },
        { icon: 'i-cloud', h: 'Reliable delivery', lead: 'Software that is easy to deploy and watch.', ticks: ['Cloud hosting matched to budget', 'Automated deployments', 'Monitoring and error alerts', 'Backups and recovery plans'] }
      ]
    },
    process: {
      heading: 'Scope small.<br class="br-md"> Ship. Learn. Extend.',
      note: 'Large fixed-scope builds are where software projects go wrong. We plan in releases, each one usable on its own.',
      steps: [
        { h: 'Discovery', p: 'Understand the users, the problem, the constraints and what success looks like.' },
        { h: 'Scope and design', p: 'A written scope for the first release, key screens and the architecture behind them.' },
        { h: 'Build in increments', p: 'Working software you can see every week or two, not a big reveal at the end.' },
        { h: 'Test and launch', p: 'Automated and hands-on testing, then a controlled launch to real users.' },
        { h: 'Maintain and improve', p: 'Fixes, updates and new features, based on how people actually use it.' }
      ]
    },
    proof: {
      label: 'What we have built',
      heading: 'Software we build and run ourselves.',
      paras: [
        '<strong>Huntly</strong>, our AI job-search assistant, is live. <strong>Traider</strong>, a crypto research and trading-signals project, is in development. <strong>Staff</strong>, our AI employee platform, is in validation.',
        'On this website you can try two tools we built in-house: the <a href="/scan">AI Business Opportunity Scanner</a> and the <a href="/website-audit">Website &amp; AI Visibility Audit</a>. We also maintain the website of an aesthetics business.'
      ]
    },
    honesty: { title: 'Honest estimates.', text: 'We don’t give fixed prices or timelines before discovery. After it, you get a written scope, a price and a plan in stages, and we tell you early if anything changes.' },
    faq: [
      ['How much does custom software cost in Nigeria?', 'It depends on scope: the number of users and roles, integrations, platforms and how polished the first release needs to be. We quote after discovery, in naira or US dollars, and recommend a focused first release so you can learn before committing to more.'],
      ['How long does it take?', 'A focused first release is usually planned in weeks rather than months, but we only commit to a timeline once the scope is written down.'],
      ['Do I own the code?', 'For software we build for you, ownership of the code is set out in the contract. Our default is that you own what you pay us to build.'],
      ['Can you take over an existing product?', 'Yes. We start with a review of the code, hosting and documentation, tell you what we find, and then propose a plan to stabilise and improve it.'],
      ['Do you build mobile apps?', 'Yes, when a mobile app is genuinely needed. For many businesses a fast, mobile-friendly web application is cheaper to build and maintain, and we’ll tell you if that is the case.'],
      ['Do you work with international clients?', 'Yes. We work remotely with clients in Nigeria and abroad, and agree working hours and communication channels at the start.']
    ],
    related: ['business-automation', 'ai-agents', 'cybersecurity', 'ai-visibility'],
    enquire: {
      heading: ['Tell us what', 'you’re building.'],
      intro: 'Share the idea or the problem. We’ll reply to arrange a discovery call.',
      include: ['What the software should do, and for whom', 'Whether it is a new product or an existing one', 'The systems it needs to connect to', 'Any deadline you are working towards'],
      messageLabel: 'Project description',
      messageHint: 'What are you building or trying to change, who is it for, and what would a good outcome look like? No passwords or customer data, please.'
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'ai-visibility',
    navName: 'AI search visibility',
    summary: 'Help search engines and AI assistants understand, trust and cite your business.',
    lastmod: '2026-11-03',
    title: 'AI Search Visibility & GEO Services | BuildWise Group',
    ogTitle: 'AI Search Visibility Services — BuildWise Group',
    description: 'Help Google, ChatGPT, Gemini and Perplexity find, understand and cite your business: technical fixes, clear content, structured data and genuine authority.',
    serviceName: 'AI search visibility and generative engine optimisation',
    serviceType: 'AI search optimisation',
    projectType: 'AI search visibility',
    cta: 'Discuss AI visibility',
    waText: 'Hello Buildwise, I would like to discuss AI search visibility for my business.',
    label: 'AI search visibility',
    h1Lines: ['Be understood by', 'search engines and', 'AI assistants.'],
    lead: 'People now ask ChatGPT, Gemini, Perplexity and Google’s AI Mode which company to call. We do the real work that makes your business easier for those systems to find, understand and cite, without tricks and without guarantees nobody can keep.',
    facts: ['Grounded in Google’s and OpenAI’s published guidance', 'Technical, content and authority work together', 'Measured, not promised'],
    glance: [
      ['Who it’s for', 'Businesses whose customers research online before they buy'],
      ['Start free', 'Run our <a href="/website-audit">Website &amp; AI Visibility Audit</a> on your site'],
      ['Covers', 'Crawler access, site structure, structured data, content and third-party presence'],
      ['Not included', 'Fake reviews, link schemes or promises of rankings or AI recommendations']
    ],
    intro: {
      label: 'What AI visibility actually is',
      heading: 'There is no secret file. There is a lot of careful work.',
      paras: [
        '<strong>AI search visibility</strong> (sometimes called generative engine optimisation, or GEO) is the work of making a business easy for AI-powered search to find, understand and recommend. Systems such as ChatGPT search, Perplexity, Gemini and Google’s AI Overviews mostly build answers from pages they can crawl and index, then cite the sources they rely on.',
        'Google says there are no special requirements to appear in AI Overviews or AI Mode beyond normal SEO best practice: pages must be crawlable and indexable, easy to reach through internal links, and useful. OpenAI says sites that allow its <strong>OAI-SearchBot</strong> crawler can appear in ChatGPT search answers, and that this is separate from its <strong>GPTBot</strong> training crawler.',
        'So the work is real but unglamorous: make sure crawlers aren’t blocked (including by your CDN or firewall), make every page say clearly who you are, what you do and for whom, publish content that genuinely answers your customers’ questions, mark up facts with accurate structured data, and build a presence on trustworthy third-party sites. No one can guarantee an AI system will recommend you, and anyone who does is guessing.'
      ]
    },
    uses: {
      label: 'What we do',
      heading: 'Five workstreams,<br class="br-md"> prioritised for you.',
      note: 'We start with an audit and fix the problems that block everything else first.',
      items: [
        { h: 'Crawler access and indexing', p: 'Check robots.txt rules for Googlebot, Bingbot, OAI-SearchBot, PerplexityBot and others, CDN and firewall bot settings, sitemaps, canonicals and Search Console, and fix what blocks them.' },
        { h: 'Entity clarity', p: 'Make your company name, services, location and contact details consistent across your site, your structured data and your profiles elsewhere, so systems can tell exactly who you are.' },
        { h: 'Pages that answer real questions', p: 'Service pages and guides that answer what your customers actually ask, written for people first, with clear headings and direct answers.' },
        { h: 'Structured data', p: 'Accurate Organization, Service, Article and Breadcrumb markup that matches what’s visible on the page, validated and maintained.' },
        { h: 'Authority and measurement', p: 'A plan for genuine third-party presence (directories, reviews, partners, press), plus tracking of search impressions and visits from AI assistants where they can be identified.' }
      ]
    },
    process: {
      heading: 'Audit. Fix. Publish.<br class="br-md"> Measure.',
      note: 'Visibility builds over months. We report what changed and what the data shows, including when it shows nothing yet.',
      steps: [
        { h: 'Audit', p: 'Technical, content and entity review of your site and profiles, starting from our free automated audit.' },
        { h: 'Fix the blockers', p: 'Crawler access, indexing, canonical and structured data problems first.' },
        { h: 'Clarify and create', p: 'Rewrite key pages for clarity and publish content that answers customer questions.' },
        { h: 'Build presence', p: 'Accurate profiles on relevant directories and platforms, and genuine reviews from real clients.' },
        { h: 'Measure and iterate', p: 'Search Console, analytics and referral data reviewed monthly, with the next priorities agreed.' }
      ]
    },
    proof: {
      label: 'Our own tools',
      heading: 'We built an AI visibility audit tool.',
      paras: [
        'The <a href="/website-audit">Website &amp; AI Visibility Audit</a> on this site checks a public website’s technical SEO, its robots.txt rules for search and AI crawlers, and how clearly its content explains the business, with evidence for each finding. It is free and doesn’t need a sign-up.',
        'We apply the same work to this website: explicit crawler rules, structured data and service pages that each answer a distinct question.'
      ]
    },
    honesty: { title: 'No guarantees, by design.', text: 'We can’t promise rankings, AI Overview inclusion or ChatGPT recommendations, and we don’t use fake reviews, paid link schemes or content that pretends to be independent. Those tactics can get a site penalised and they damage trust.' },
    faq: [
      ['Can you get my business recommended by ChatGPT?', 'No one can guarantee that. What we can do is remove the obstacles (blocked crawlers, unclear pages, inconsistent information) and build the signals AI search systems rely on: clear, useful pages, accurate structured data and genuine presence on trusted third-party sites.'],
      ['Is AI visibility different from SEO?', 'Mostly it is good SEO with more attention to clarity and to how your business is described across the web. Google says normal SEO best practice applies to its AI features. The differences are in details, such as allowing AI search crawlers and measuring visits from AI assistants.'],
      ['Do I need an llms.txt file?', 'It can’t hurt, but no major AI search provider has said it uses llms.txt to rank or cite sites. It is not a substitute for crawlable, clear pages.'],
      ['Should I block AI crawlers?', 'That is a business decision. Blocking search crawlers such as OAI-SearchBot removes you from those AI search answers. Blocking training crawlers such as GPTBot or Google-Extended is a separate choice that doesn’t, according to the providers, affect search. We explain the trade-offs.'],
      ['How long until we see results?', 'Technical fixes can take effect within days of being crawled. Content and authority take months. We report on the data honestly every month.'],
      ['How do you measure AI visibility?', 'Search Console impressions and clicks, analytics referrals from AI assistants such as chatgpt.com and perplexity.ai where they pass a referrer, enquiries that mention AI tools, and periodic manual checks of how AI assistants describe you.']
    ],
    related: ['website-audit', 'custom-software-development', 'ai-automation-nigeria', 'business-automation'],
    enquire: {
      heading: ['Find out how AI', 'search sees you.'],
      intro: 'Tell us about your business and your website. We’ll reply to arrange a discovery call.',
      include: ['Your website address', 'The services and locations you want to be found for', 'Who your competitors are', 'Whether you use Google Search Console today'],
      messageLabel: 'What would you like to be found for?',
      messageHint: 'Describe your business, your website and the searches or questions you want to appear for. No passwords, please.'
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'business-automation',
    navName: 'Business process automation',
    summary: 'Workflow automation that connects your tools and removes manual data entry.',
    lastmod: '2026-11-03',
    title: 'Business Process Automation Services | BuildWise Group',
    ogTitle: 'Business Process & Workflow Automation — BuildWise Group',
    description: 'Business process automation from BuildWise Group: connect your tools, remove manual data entry and automate approvals, documents and reporting, with people in control.',
    serviceName: 'Business process automation',
    serviceType: 'Business process and workflow automation',
    projectType: 'Business automation and integrations',
    cta: 'Discuss an automation',
    waText: 'Hello Buildwise, I would like to discuss automating a business process.',
    label: 'Business process automation',
    h1Lines: ['Business process', 'automation that', 'your team trusts.'],
    lead: 'Copying data between systems, chasing approvals and building the same report every week costs hours your team doesn’t have. We map how the work happens, then automate the repetitive steps around the tools you already use.',
    facts: ['Starts with how the work really happens', 'Low-code or custom code, whichever fits', 'Monitored, so failures don’t go unnoticed'],
    glance: [
      ['Who it’s for', 'Operations, finance, sales and admin teams doing repetitive, rules-based work'],
      ['First step', 'Map one workflow end to end on a discovery call'],
      ['Connects', 'Spreadsheets, CRMs, accounting, email, forms, storage and in-house systems'],
      ['Where', 'Remote-first. Nigeria and international clients.']
    ],
    intro: {
      label: 'What business process automation is',
      heading: 'Fewer handoffs. Fewer mistakes. Same team.',
      paras: [
        '<strong>Business process automation</strong> uses software to carry out the repeatable steps of a workflow, such as moving data, sending notifications, generating documents and routing approvals, so they happen the same way every time without someone doing them by hand.',
        'Rules-based automation handles the predictable steps. AI extends it to the messy ones: reading an emailed invoice, classifying a request, or drafting a reply. We use each where it fits, and keep people in charge of decisions that need judgement.',
        'Good automation starts on paper. Before we build anything, we map the workflow as it actually happens, including the workarounds, because automating a broken process just breaks it faster.'
      ]
    },
    uses: {
      label: 'What we automate',
      heading: 'Common workflows<br class="br-md"> we take on.',
      note: 'Each one starts small, with a clear measure of success, before we add more.',
      items: [
        { h: 'Data entry between systems', p: 'Orders, leads and records copied automatically between your website, CRM, spreadsheets and accounting software.' },
        { h: 'Approvals and notifications', p: 'Requests routed to the right person, with reminders and a clear record of who approved what and when.' },
        { h: 'Documents and invoices', p: 'Quotes, invoices, contracts and certificates generated from templates, and incoming documents read and filed.' },
        { h: 'Reporting', p: 'The weekly report assembled automatically from your systems and delivered to the right inbox or WhatsApp group.' },
        { h: 'Customer onboarding', p: 'Welcome messages, forms, document collection and account set-up triggered when a deal closes.' }
      ]
    },
    process: PROCESS,
    proof: {
      label: 'How we work',
      heading: 'Built by a team that runs its own products.',
      paras: [
        'We build and operate our own products, including <strong>Huntly</strong> (live) and <strong>Staff</strong> (in validation), so we design automation to be maintained, not just demonstrated. The <a href="/scan">AI Business Opportunity Scanner</a> on this site will give you a first view of where automation could help, in eight questions.',
        'When an automation touches customer data or money, we design its access and logging with the same care as any software we ship.'
      ]
    },
    honesty: { title: 'Sometimes the answer is “don’t automate yet”.', text: 'If a process changes every week or happens twice a month, automating it may cost more than it saves. We’ll tell you, and suggest what to fix first.' },
    faq: [
      ['What business processes can be automated?', 'Processes that are frequent, follow recognisable rules and involve moving information between people or systems: data entry, approvals, notifications, document generation, reporting and onboarding are the usual candidates.'],
      ['Do you use Zapier, Make or n8n?', 'We use low-code automation tools when they are reliable and cost-effective for the job, and write custom code when volumes, security or complexity call for it. We explain the trade-off, including running costs, before building.'],
      ['What if one of our systems has no API?', 'There are often other options, such as scheduled exports, email parsing or database connections. If no reliable option exists, we’ll say so rather than build something fragile.'],
      ['How do we know the automation is working?', 'Every automation we build logs what it does and alerts someone when a step fails. We agree the measures of success, such as hours saved or errors avoided, before we start.'],
      ['Will automation work with our accounting or ERP software?', 'Usually, if it offers an API or reliable import and export. We check during discovery.'],
      ['How much does it cost?', 'It depends on the number of steps and systems involved. We quote after discovery, and show any subscription costs for automation tools separately.']
    ],
    related: ['ai-agents', 'custom-software-development', 'whatsapp-automation', 'ai-automation-nigeria'],
    enquire: {
      heading: ['Show us the process', 'that eats your week.'],
      intro: 'Describe the workflow and the tools involved. We’ll reply to arrange a short discovery call.',
      include: ['The process, step by step, as it happens today', 'How often it happens and who does it', 'The tools and systems involved', 'What usually goes wrong'],
      messageLabel: 'Which process would you like to automate?',
      messageHint: 'Describe the steps, how often they happen and the tools involved. No passwords or customer data, please.'
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'ai-receptionist',
    navName: 'AI receptionists',
    summary: 'AI receptionists for enquiries, appointment booking and after-hours cover.',
    lastmod: '2026-11-03',
    title: 'AI Receptionist & Appointment Booking Automation | BuildWise Group',
    ogTitle: 'AI Receptionists for Enquiries and Bookings — BuildWise Group',
    description: 'AI receptionists from BuildWise Group answer enquiries, book appointments and send reminders on WhatsApp and web chat, with your staff always in control.',
    serviceName: 'AI receptionist and appointment booking automation',
    serviceType: 'AI receptionist and automated customer service',
    projectType: 'AI receptionist or voice agent',
    cta: 'Discuss an AI receptionist',
    waText: 'Hello Buildwise, I would like to discuss an AI receptionist for my business.',
    label: 'AI receptionists',
    h1Lines: ['An AI receptionist', 'that never misses', 'an enquiry.'],
    lead: 'An AI receptionist answers common questions, takes booking requests, confirms appointments and sends reminders, day and night, then passes anything sensitive to your staff. It is built on the same thinking as Maya, the AI receptionist on our Staff platform.',
    facts: ['WhatsApp and web chat first', 'Voice scoped case by case', 'Your staff stay in control'],
    glance: [
      ['Who it’s for', 'Clinics, salons, aesthetics, property, hospitality and service businesses that live on bookings'],
      ['Channels', 'WhatsApp and website chat. Phone and voice assessed per project.'],
      ['First step', 'A discovery call and a look at your booking process'],
      ['Related', 'Maya, the example employee on <a href="/#ventures">Staff</a>, in validation']
    ],
    intro: {
      label: 'What an AI receptionist is',
      heading: 'The front desk, extended to every hour of the day.',
      paras: [
        'An <strong>AI receptionist</strong> is an AI assistant that handles the first contact with your customers: answering questions about services, prices and opening hours, taking booking requests, confirming and rescheduling appointments, and sending reminders. It works from information you approve, and hands over to a person whenever a conversation needs one.',
        'Most of our receptionist work runs on WhatsApp and website chat, because that is where customers in Nigeria already message businesses. <strong>AI voice agents</strong>, which answer phone calls, are possible with telephony and speech providers, but call quality, local number availability and costs vary, so we assess voice for each project rather than promise it.',
        'Our own AI employee platform, <strong>Staff</strong>, is being validated on exactly this work. Its example employee, Maya, is an AI receptionist, and we have worked with an aesthetics business on Maya.'
      ]
    },
    uses: {
      label: 'What it handles',
      heading: 'The questions your<br class="br-md"> front desk answers daily.',
      note: 'You decide which of these the receptionist handles and which always go to a person.',
      items: [
        { h: 'Enquiries about services and prices', p: 'Instant, consistent answers from your approved price list and service descriptions.' },
        { h: 'Appointment booking', p: 'Check availability, take details, confirm the slot and add it to the calendar your staff use.' },
        { h: 'Reminders and rescheduling', p: 'Reminders before appointments and an easy way to reschedule, which helps reduce no-shows.' },
        { h: 'After-hours cover', p: 'Enquiries at night and at weekends are answered or captured, so your team starts the day with a clean list.' },
        { h: 'Escalation to staff', p: 'Complaints, medical or legal questions and anything unusual go straight to a person, with the conversation attached.' }
      ]
    },
    process: PROCESS,
    proof: {
      label: 'Built on our own work',
      heading: 'Maya: our AI receptionist, in validation.',
      paras: [
        '<strong>Staff</strong> is our applied-AI employee platform, being developed and validated on everyday workflows such as enquiries and bookings. Maya, an AI receptionist, is its example employee. We have worked with an aesthetics business on Maya.',
        'Staff is not yet generally available. For clients, we build receptionists for specific workflows, using what we have learned from Staff.'
      ]
    },
    honesty: { title: 'Sensitive questions go to people.', text: 'An AI receptionist should not give medical, legal or financial advice. We configure it to recognise those questions and pass them to your staff, and we review conversations with you during the first weeks.' },
    faq: [
      ['Can an AI receptionist answer phone calls?', 'It can, using telephony and speech providers, but voice quality, Nigerian number availability and per-minute costs vary. We assess voice per project. Most businesses start on WhatsApp and web chat, where customers already message them.'],
      ['Will customers know they are talking to AI?', 'Yes. We recommend the receptionist says it is an AI assistant and offers a person at any time. It builds trust and avoids misunderstandings.'],
      ['Can it connect to our booking system?', 'If your booking or calendar system offers an API or calendar integration, usually yes. If not, the receptionist can collect requests for your staff to confirm.'],
      ['What happens when it doesn’t know the answer?', 'It says so and hands the conversation to a member of staff, with the history attached, rather than guessing.'],
      ['Is Maya available to buy?', 'Not yet. Staff, the platform Maya belongs to, is in validation. We build receptionists for clients as projects in the meantime.'],
      ['How much does it cost?', 'We quote after discovery. Running costs, such as WhatsApp message charges, AI model usage and any voice minutes, are shown separately.']
    ],
    related: ['whatsapp-automation', 'ai-agents', 'ai-automation-lagos', 'business-automation'],
    enquire: {
      heading: ['Tell us how bookings', 'work today.'],
      intro: 'Describe your front desk and booking process. We’ll reply to arrange a short discovery call.',
      include: ['What kind of business you run and your opening hours', 'How customers contact you: WhatsApp, calls, website, Instagram', 'How bookings are recorded today', 'Questions that must always go to a person'],
      messageLabel: 'How do enquiries and bookings work today?',
      messageHint: 'Describe your channels, booking process and the questions you get most. No passwords or customer data, please.'
    }
  }
];
