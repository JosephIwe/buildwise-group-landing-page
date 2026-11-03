/*
 * /ai-automation: the commercial page for Buildwise AI Business Automation.
 * scripts/build-pages.mjs turns this into ai-automation.html.
 *
 * Claims rules (tests/ai-automation.test.js):
 * - Staff capabilities carry their real status. "Available now" means running in Staff's
 *   production service (deployed 31 Oct 2026, invitation-only onboarding). "Early access"
 *   means built and tested but enabled per business only after validation. "By
 *   integration" means it needs engineering or a third-party account first.
 * - No testimonials, client names, results, ratings, uptime figures or guarantees.
 *   The aesthetics business stays unnamed.
 * - Prices are the founder's initial pricing (3 Nov 2026). Every price on the page comes
 *   from PACKAGES below, so the page, the structured data and the tests agree. Usage is
 *   never unlimited.
 * Source of the Staff facts: the ai-employee-platform repository (docs/EMPLOYEE_CAPABILITIES.md,
 * docs/PRODUCTION.md, docs/COSTS.md, docs/CHAT.md, docs/VOICE.md) and the staff-production
 * Railway service configuration, checked 3 Nov 2026.
 */
export const SLUG = 'ai-automation';
export const WA_TEXT = 'Hello Buildwise, I would like to talk about AI automation for my business.';

export const META = {
  title: 'AI Business Automation for Clinics & Salons | Buildwise Group',
  ogTitle: 'AI Business Automation for Clinics and Service Businesses — Buildwise Group',
  description: 'Automate enquiries, bookings and follow-ups for clinics, salons and service businesses with AI employees on Staff. Clear packages from $250. Assessment first.',
  serviceName: 'AI business automation for appointment-based businesses',
  serviceType: 'AI business automation and AI employee implementation'
};

export const HERO = {
  label: 'AI business automation',
  h1Lines: ['Your business shouldn’t', 'lose customers because', 'your team is busy.'],
  lead: 'Buildwise helps clinics and service businesses automate customer enquiries, bookings, follow-ups and repetitive operations, using AI employees on our Staff platform and connected business systems. Your team stays in charge of every decision that matters.',
  facts: ['Assessment before any build', 'Fixed, published prices', 'Usage limits you control'],
  glance: [
    ['Built for', 'Aesthetics and dental clinics, salons, spas and other appointment-based businesses'],
    ['Start with', 'An AI Opportunity Assessment: <strong>$250</strong>, one-time'],
    ['Implementation', 'From <strong>$1,250</strong>, fixed scope agreed in writing'],
    ['Running costs', '<strong>$399/month</strong> for Staff plus managed operations, before any extra usage']
  ]
};

export const PROBLEMS = {
  label: 'What we solve',
  heading: 'Busy front desks lose<br class="br-md"> customers quietly.',
  note: 'None of these are failures of effort. They happen when the same few people answer messages, run the diary and serve the customer in front of them.',
  items: [
    { h: 'Enquiries wait for a reply', p: 'A customer asks about a treatment at 9pm or during a busy clinic. By the time someone replies, they have booked elsewhere.' },
    { h: 'Booking happens by hand', p: 'Staff copy names, numbers and times between WhatsApp, a notebook and the diary, then call to confirm, reschedule and chase.' },
    { h: 'Follow-ups slip', p: 'People who asked about prices, or did not come back after a consultation, are never contacted again because there is no time.' },
    { h: 'The same questions, all day', p: 'Prices, opening hours, preparation, aftercare and location: answered again and again, sometimes inconsistently.' },
    { h: 'Nobody can see the pipeline', p: 'Owners cannot tell how many enquiries came in, where they came from, or which ones turned into appointments.' }
  ]
};

export const HOW = {
  label: 'How AI employees work',
  heading: 'A clear job, approved<br class="br-md"> knowledge, limited powers.',
  note: 'An AI employee is not a chatbot left to improvise. It has a written role, works only from information you approve, can take only the actions its job allows, and hands over to a person when it should.',
  steps: [
    { h: 'A customer gets in touch', p: 'On your website, the AI employee greets them, answers in plain language and asks what they need.' },
    { h: 'It answers from your information', p: 'Services, prices, durations, opening hours and policies come from what you approved, not from guesswork. If it doesn’t know, it says so.' },
    { h: 'It takes a permitted action', p: 'Take their details, check free times, make or request a booking, reschedule or cancel. Every action is checked against the business’s settings before it runs.' },
    { h: 'It hands over when it should', p: 'Medical questions, complaints, unusual requests and anything sensitive go to your team, with the customer’s details attached.' },
    { h: 'Your team sees everything', p: 'Enquiries and bookings appear on your owner screens, so nothing depends on someone remembering a message.' }
  ],
  principles: [
    ['It never pretends a booking is confirmed.', 'It says “booked” only when the booking system confirms, with a reference. Otherwise it says the request is received and your team will confirm.'],
    ['It reads details back first.', 'Before booking, it repeats the service, date, time and contact details and waits for the customer’s yes.'],
    ['It says it is an AI.', 'Customers are told they are talking to an AI assistant, and can reach a person.'],
    ['It never takes payments.', 'Staff does not handle card details or payments, by design.']
  ]
};

export const BOOKING = {
  label: 'Enquiry and booking automation',
  heading: 'From first question<br class="br-md"> to confirmed appointment.',
  note: 'What a standard implementation sets up for one location. The channels and integrations for your business are confirmed in the assessment.',
  items: [
    {
      icon: 'i-chat', h: 'Enquiries answered and captured',
      lead: 'Every website enquiry gets an answer or reaches your team with the details needed to reply.',
      ticks: ['Answers from your approved services, prices and policies', 'Name, phone or email and the request captured', 'Enquiries listed on your owner screens', 'Sensitive questions routed to staff']
    },
    {
      icon: 'i-flow', h: 'Bookings without the back-and-forth',
      lead: 'Customers choose a service and time, confirm their details and get a booking reference.',
      ticks: ['Services, durations and opening hours set up for you', 'Online booking, rescheduling and cancellation', 'Read-back and the customer’s yes before anything is booked', 'Or booking requests to your team, if you keep your current system']
    },
    {
      icon: 'i-bolt', h: 'Follow-ups and handover',
      lead: 'The right person gets the conversation at the right time, without copying and pasting.',
      ticks: ['Customers can reach your team on WhatsApp', 'Leads marked “wants to book: contact them”', 'WhatsApp confirmations and reminders by integration', 'A monthly review of what came in and what to improve (with AI Operations)']
    }
  ]
};

/* Staff capabilities by status. Keep in step with the Staff repository; see the header. */
export const STAFF = {
  label: 'The Staff platform',
  heading: 'What Staff does today,<br class="br-md"> and what is next.',
  intro: 'Staff is the AI employee platform Buildwise Group builds and runs. Clients use it through an implementation: we set it up for your business rather than leaving you to configure it alone. Here is exactly where each capability stands.',
  image: {
    caption: 'Product image supplied by Buildwise Group: the Staff website on a reception display, with Maya, our example AI receptionist. Illustrative, not a client deployment.',
    alt: 'The Staff website on a reception display, with Maya, an AI receptionist, talking to a customer'
  },
  groups: [
    {
      key: 'now', label: 'Available now', note: 'Running in Staff’s production service. New businesses are onboarded by invitation, with Buildwise doing the setup.',
      items: [
        'Website enquiry capture, listed on your owner screens',
        'Guided website chat that answers common questions from your approved information',
        'Online booking, rescheduling and cancellation in Staff’s built-in diary',
        '“Booked” only with a confirmed reference; otherwise a request for your team',
        'Handover to your team’s WhatsApp',
        'Owner screens for enquiries and bookings, protected by private access codes',
        'Bot protection and usage limits on every public page'
      ]
    },
    {
      key: 'early', label: 'Early access', note: 'Built and tested, switched on for a business only after it has been validated with that business.',
      items: [
        'AI conversation in written chat, using a language model',
        'AI video receptionist (Maya), deployed for an aesthetics business',
        'AI voice conversation in the browser',
        'WhatsApp booking confirmations and reminders (needs your WhatsApp Business Platform account)'
      ]
    },
    {
      key: 'integration', label: 'By integration', note: 'Needs engineering, a third-party account or a supplier’s API. Scoped and quoted separately.',
      items: [
        'Your existing booking software, where its supplier offers an API',
        'CRM and calendar synchronisation',
        'Phone numbers and inbound phone calls',
        'Email or SMS campaigns and other systems you already use'
      ]
    }
  ],
  footnote: 'Staff does not take payments. Anything in “Early access” or “By integration” is offered only after your assessment confirms it is ready for your business, and is never part of a price unless your written scope says so.'
};

export const INDUSTRIES = {
  label: 'Industry applications',
  heading: 'Built for businesses<br class="br-md"> that live on appointments.',
  items: [
    { h: 'Aesthetics clinics', p: 'Treatment questions, consultation requests and bookings answered from your menu, with skin, pregnancy, allergy and medication questions always passed to a practitioner.' },
    { h: 'Dental clinics', p: 'New-patient enquiries, check-up and hygiene bookings, rescheduling and opening-hours questions. Clinical questions and urgent pain go straight to the team.' },
    { h: 'Salons, spas and barbers', p: 'Service and stylist questions, bookings by service length, rescheduling and late-cancellation policy, outside opening hours too.' },
    { h: 'Other appointment-based businesses', p: 'Physiotherapy, wellness, consultancies, studios and repair services: anywhere a booked slot is the product.' }
  ]
};

export const PROCESS = {
  label: 'Implementation process',
  heading: 'Assessment first.<br class="br-md"> Then a focused launch.',
  note: 'Timings are typical, not promises: they depend on how quickly information and access arrive, and on any integrations. Your written plan confirms them.',
  steps: [
    { h: 'AI Opportunity Assessment', p: 'A working session on how enquiries and bookings happen today, then a written plan: what to automate, what stays human, what it needs and what it costs.', t: 'About 1 week' },
    { h: 'Scope and agreement', p: 'A fixed scope, price and acceptance checklist in writing. Nothing is built until you approve it.', t: '1 to 3 days' },
    { h: 'Setup and configuration', p: 'We set up your AI employee, knowledge, services, availability, booking rules, handover and website installation.', t: '1 to 2 weeks' },
    { h: 'Testing and acceptance', p: 'We test with realistic conversations, including awkward ones, and walk your team through it before customers see it.', t: 'About 1 week' },
    { h: 'Launch and support', p: 'It goes live. We adjust it during the first two weeks, then AI Operations keeps it accurate month to month.', t: 'Ongoing' }
  ]
};

/* Prices: founder's initial pricing, 3 Nov 2026 (USD). */
export const PACKAGES = [
  {
    id: 'assessment', code: 'A', name: 'AI Opportunity Assessment', price: 250, period: 'one-time', billedBy: 'Buildwise Group',
    summary: 'Find out what is worth automating before you spend more.',
    includes: [
      'A working session (up to 90 minutes) with you and your front desk',
      'Review of your enquiry channels, booking process and current tools',
      'Readiness check of your booking system, website and WhatsApp setup',
      'A written automation plan with priorities, risks and what stays human',
      'A fixed-price implementation quote, valid for 30 days'
    ],
    excludes: ['Any build or configuration', 'Access to your systems beyond what you choose to show us'],
    cta: 'Book an assessment', ctaPackage: 'AI Opportunity Assessment'
  },
  {
    id: 'implementation', code: 'B', name: 'AI Business Automation Implementation', price: 1250, period: 'one-time, standard scope', billedBy: 'Buildwise Group',
    summary: 'One AI employee, set up and launched for one location.',
    includes: [
      'One AI employee in a front-desk role on Staff, for one location',
      'Your services, prices, durations, hours and policies, from information you approve',
      'Booking, rescheduling and cancellation in Staff’s diary, or booking requests to your team',
      'Enquiry capture, owner screens and handover to your team’s WhatsApp',
      'Installation on one website (WordPress, Wix, Webflow, Shopify or plain HTML)',
      'Testing, an acceptance session and one team training session',
      'Two weeks of adjustments after launch'
    ],
    excludes: ['Integration with other booking software, CRMs or calendars', 'WhatsApp Business Platform setup and messaging', 'Phone numbers and voice calls', 'Extra locations, AI employees or websites', 'Writing new content beyond the information you provide'],
    cta: 'Start with an assessment', ctaPackage: 'AI Business Automation Implementation', featured: true
  },
  {
    id: 'staff', code: 'C', name: 'Staff AI Employee Subscription', price: 149, period: 'per month', billedBy: 'Staff subscription',
    summary: 'Your AI employee on the Staff platform.',
    includes: [
      'One AI employee and its public page or website installation',
      'Hosting, security updates, bot protection and usage limits',
      'Owner screens for enquiries and bookings',
      'Up to 200 minutes a month of AI voice or video conversation, once that channel is enabled for your business',
      'Written chat, enquiries and bookings are not counted as minutes'
    ],
    excludes: ['Minutes beyond 200 a month, which run only with your written approval at the rate in your order form', 'Third-party fees such as WhatsApp messages or phone numbers'],
    note: 'Subject to Staff’s verified production pricing and usage controls, confirmed in your order form before you are billed.'
  },
  {
    id: 'operations', code: 'D', name: 'Buildwise AI Operations', price: 250, period: 'per month', billedBy: 'Buildwise Group',
    summary: 'We keep your AI employee accurate, safe and improving.',
    includes: [
      'Monitoring of conversations, handovers and usage limits',
      'Updates to prices, services, hours and policies when they change',
      'A monthly review of enquiries, bookings and handovers, with recommendations',
      'Tuning answers and handover rules based on real conversations',
      'Support on WhatsApp during business hours (Monday to Friday, West Africa Time)'
    ],
    excludes: ['New integrations, AI employees, channels or locations (quoted separately)', 'Work on systems Buildwise did not set up']
  }
];
export const COMBINED = { price: 149 + 250, ids: ['staff', 'operations'] };

export const BOUNDARIES = {
  label: 'Who charges for what',
  heading: 'Four separate lines.<br class="br-md"> No surprises.',
  rows: [
    ['Buildwise implementation fees', 'The assessment and the implementation. One-time, fixed scope, invoiced by Buildwise Group.'],
    ['Staff product subscription', 'The AI employee on the Staff platform, with its usage limits. Monthly.'],
    ['Buildwise managed operations', 'Monitoring, updates, reviews and support from the Buildwise team. Monthly.'],
    ['Third-party usage and integrations', 'Fees charged by other providers, such as WhatsApp Business messaging, phone numbers, booking-software add-ons or extra AI minutes, and engineering to connect other systems. Passed through at cost or quoted in writing before any work.']
  ],
  notes: [
    'Usage is never unlimited. Each AI employee has daily and monthly limits, and extra minutes run only with your written approval.',
    'Prices are in US dollars and exclude any applicable taxes. Ask us about invoicing in naira.',
    'Integrations with other software, extra locations, extra AI employees and new channels are quoted separately after the assessment.'
  ]
};

export const FAQ = [
  ['What exactly is an AI employee?', 'Software that does one front-desk job, such as answering enquiries and taking bookings, under rules you approve. It has a written role, a fixed set of actions it may take and a handover to your team. It does not make decisions that need a person.'],
  ['Will it replace my receptionist?', 'No. It takes the repetitive first contact off your team’s hands, especially outside opening hours, so they can spend time with the customers in front of them. Anything sensitive or unusual still goes to a person.'],
  ['Will it tell a customer they are booked when they are not?', 'No. It says “booked” only when the booking system confirms the appointment with a reference. Otherwise it tells the customer the request has been received and your team will confirm.'],
  ['Does it work with the booking software we already use?', 'Sometimes. If your software has an API or official integration, we can scope a connection, quoted separately. If not, you can use Staff’s built-in diary, or keep your system and have the AI employee pass booking requests to your team.'],
  ['Can it answer phone calls or WhatsApp messages?', 'The standard implementation covers your website. Customers can be handed to your team’s WhatsApp at any time. AI voice, inbound phone calls and automated WhatsApp messages are early-access or integration work: we confirm in the assessment whether they are ready for your business and what they would cost.'],
  ['What do I get from the $250 assessment, and do I have to go ahead?', 'A working session, a review of your current process and tools, and a written plan with a fixed implementation quote. You are under no obligation to proceed.'],
  ['Why are Staff and Buildwise charged separately?', 'They are different things. Staff is the software subscription that runs your AI employee. Buildwise AI Operations is our team looking after it every month. Keeping them separate shows you exactly what you pay for.'],
  ['What happens if we use more than 200 minutes?', 'Nothing runs up by surprise. Usage limits stop calls at the limit. Extra minutes run only if you approve them in writing, at the rate in your order form. Written chat, enquiries and bookings are not counted as minutes.'],
  ['Can it give medical or treatment advice?', 'No. It answers practical questions from information you approve and passes medical, clinical and treatment-suitability questions to your practitioners.'],
  ['How is customer data handled?', 'Only what the job needs is collected. Owner screens are private and never indexed. Action logs record what was done, not what the customer said. Retention periods are agreed with you. See the security section of our proposal, available on request.']
];

export const ENQUIRE = {
  heading: ['Book your AI', 'Opportunity Assessment.'],
  intro: 'Tell us about your business and where time is lost today. We’ll reply to arrange the assessment session and confirm what to prepare.',
  include: [
    'How customers contact you today: website, WhatsApp, Instagram, phone',
    'How bookings are recorded: software, spreadsheet, notebook',
    'Roughly how many enquiries and appointments you handle each week',
    'Questions that must always go to a person'
  ]
};
