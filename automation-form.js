/*
 * AI Opportunity Assessment request form on /ai-automation.
 *
 * Delivered exactly like every other Buildwise enquiry: through Web3Forms with the same
 * public access key and transport as contact-form.js (window.BWEnquiry), so there is no
 * new key, endpoint or inbox. Validation runs here before anything is sent; nothing is
 * stored in the browser or put in the address bar.
 *
 * Works as a browser global (window.BWAutomationForm, needs contact-form.js loaded first)
 * and as a CommonJS module for tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./contact-form.js'));
  else root.BWAutomationForm = factory(root.BWEnquiry);
})(typeof self !== 'undefined' ? self : this, Enquiry => {
  'use strict';

  const PROJECT_TYPE = 'AI business automation';
  const LIMITS = { business: 120, name: 100, email: 254, phone: 24, details: 3000, detailsMin: 20 };
  const INDUSTRIES = [
    'Aesthetics clinic',
    'Dental clinic',
    'Medical or wellness clinic',
    'Salon, spa or barber',
    'Other appointment-based business',
    'Other service business'
  ];
  const LOCATIONS = ['1', '2 to 3', '4 to 10', 'More than 10'];
  const CHALLENGES = [
    'Enquiries go unanswered or get slow replies',
    'Booking and rescheduling take too much staff time',
    'No-shows and late cancellations',
    'Follow-ups after enquiries or visits are missed',
    'Repetitive admin and data entry',
    'Something else'
  ];
  const AUTOMATIONS = [
    'Answering customer enquiries',
    'Appointment booking and rescheduling',
    'Reminders and follow-ups',
    'Capturing and routing leads to the team',
    'Handing conversations to staff on WhatsApp',
    'Repetitive internal operations',
    'Not sure yet'
  ];
  const PACKAGES = ['AI Opportunity Assessment', 'AI Business Automation Implementation', 'Not sure yet'];

  /* Returns { values, errors, valid }. errors maps a field name to its message. */
  function normalizeRequest(input) {
    const raw = input || {};
    const values = {
      business: Enquiry.clean(raw.business),
      name: Enquiry.clean(raw.name),
      email: Enquiry.clean(raw.email),
      industry: Enquiry.clean(raw.industry),
      locations: Enquiry.clean(raw.locations),
      challenge: Enquiry.clean(raw.challenge),
      automations: [...new Set((Array.isArray(raw.automations) ? raw.automations : []).map(v => Enquiry.clean(v)))],
      details: Enquiry.clean(raw.details, true),
      phone: Enquiry.clean(raw.phone),
      package: Enquiry.clean(raw.package)
    };
    const errors = {};

    if (values.business.length < 2) errors.business = 'Enter your business name.';
    else if (values.business.length > LIMITS.business) errors.business = `Keep the business name under ${LIMITS.business} characters.`;

    if (values.name.length < 2) errors.name = 'Enter your full name.';
    else if (values.name.length > LIMITS.name) errors.name = `Keep your name under ${LIMITS.name} characters.`;

    if (!values.email) errors.email = 'Enter your business email address.';
    else if (values.email.length > LIMITS.email || !Enquiry.EMAIL.test(values.email)) errors.email = 'Enter a valid email address, like name@yourbusiness.com.';

    if (!INDUSTRIES.includes(values.industry)) errors.industry = 'Choose your industry.';
    if (!LOCATIONS.includes(values.locations)) errors.locations = 'Choose how many locations you have.';
    if (!CHALLENGES.includes(values.challenge)) errors.challenge = 'Choose your main operational challenge.';

    if (!values.automations.length) errors.automations = 'Choose at least one thing you would like to automate.';
    else if (values.automations.some(v => !AUTOMATIONS.includes(v))) errors.automations = 'Choose from the listed options.';

    if (!values.details) errors.details = 'Tell us a little about how this works today.';
    else if (values.details.length < LIMITS.detailsMin) errors.details = `Add a little more detail (at least ${LIMITS.detailsMin} characters).`;
    else if (values.details.length > LIMITS.details) errors.details = `Keep this under ${LIMITS.details} characters.`;

    if (values.phone && (values.phone.length > LIMITS.phone || !Enquiry.PHONE.test(values.phone))) errors.phone = 'Enter a phone number with its country code, for example +[country code] 000 000 0000.';
    if (values.package && !PACKAGES.includes(values.package)) errors.package = 'Choose one of the listed options.';

    return { values, errors, valid: Object.keys(errors).length === 0 };
  }

  /* The JSON body Web3Forms receives: the same shape and subject line as every other
     Buildwise enquiry, so it lands in the same inbox and filters. */
  function buildPayload(values, { accessKey = Enquiry.ACCESS_KEY, botcheck = false, page = '' } = {}) {
    const payload = {
      access_key: accessKey,
      subject: `${Enquiry.SUBJECT}: ${PROJECT_TYPE} (${values.industry})`,
      from_name: 'Buildwise website',
      replyto: values.email,
      name: values.name,
      email: values.email,
      company: values.business,
      project_type: PROJECT_TYPE,
      industry: values.industry,
      locations: values.locations,
      main_challenge: values.challenge,
      desired_automation: values.automations.join('; '),
      interested_in: values.package || 'Not given',
      message: values.details,
      botcheck: Boolean(botcheck)
    };
    if (values.phone) payload.whatsapp_number = values.phone;
    if (page) payload.page = page;
    return payload;
  }

  /* ---------- Browser wiring ---------- */
  function mount(doc, { accessKey = Enquiry.ACCESS_KEY, fetchImpl } = {}) {
    const form = doc.getElementById('automationForm');
    if (!form) return;
    const unavailable = doc.getElementById('automationUnavailable');
    const success = doc.getElementById('automationSuccess');
    const status = doc.getElementById('automationStatus');
    const submit = doc.getElementById('automationSubmit');
    const submitText = doc.getElementById('automationSubmitText');
    const counter = doc.getElementById('autoDetailsCount');

    if (!accessKey) {
      form.hidden = true;
      if (unavailable) unavailable.hidden = false;
      return;
    }
    form.hidden = false;
    if (unavailable) unavailable.hidden = true;
    form.noValidate = true;

    const el = form.elements;
    const fields = {
      business: el.business, name: el.name, email: el.email, industry: el.industry, locations: el.locations,
      challenge: el.main_challenge, details: el.message, phone: el.whatsapp_number, package: el.interested_in
    };
    const groupBox = form.querySelector('.auto-checks');
    const read = () => ({
      business: fields.business.value,
      name: fields.name.value,
      email: fields.email.value,
      industry: fields.industry.value,
      locations: fields.locations.value,
      challenge: fields.challenge.value,
      automations: [...form.querySelectorAll('input[name="desired_automation"]:checked')].map(i => i.value),
      details: fields.details.value,
      phone: fields.phone.value,
      package: fields.package.value
    });

    const order = ['business', 'name', 'email', 'industry', 'locations', 'challenge', 'automations', 'details', 'phone', 'package'];
    const setError = (name, message) => {
      const box = doc.getElementById(`auto-${name}-error`);
      const control = name === 'automations' ? groupBox : fields[name];
      if (box) box.textContent = message || '';
      if (control) {
        if (message) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
      }
    };
    const showErrors = errors => order.forEach(name => setError(name, errors[name]));

    // Package buttons preselect what the visitor is interested in.
    doc.addEventListener('click', event => {
      const link = event.target.closest && event.target.closest('a[data-package]');
      if (link && PACKAGES.includes(link.dataset.package)) fields.package.value = link.dataset.package;
    });

    const syncCount = () => { if (counter) counter.textContent = `${fields.details.value.length} / ${LIMITS.details}`; };
    fields.details.addEventListener('input', syncCount);
    syncCount();

    // Once a field has been flagged, re-check it as the visitor fixes it.
    const recheck = name => () => {
      const control = name === 'automations' ? groupBox : fields[name];
      if (!control || control.getAttribute('aria-invalid') !== 'true') return;
      setError(name, normalizeRequest(read()).errors[name]);
    };
    Object.entries(fields).forEach(([name, input]) => {
      input.addEventListener('input', recheck(name));
      input.addEventListener('change', recheck(name));
    });
    form.querySelectorAll('input[name="desired_automation"]').forEach(i => i.addEventListener('change', recheck('automations')));

    const idleText = submitText.textContent;
    let sending = false;
    const setSending = on => {
      sending = on;
      submit.disabled = on;
      submit.setAttribute('aria-busy', String(on));
      form.classList.toggle('is-sending', on);
      submitText.textContent = on ? 'Sending request…' : idleText;
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending) return;
      status.textContent = '';
      status.className = 'enq-status';
      const { values, errors, valid } = normalizeRequest(read());
      showErrors(errors);
      if (!valid) {
        const first = order.find(name => errors[name]);
        const target = first === 'automations' ? form.querySelector('input[name="desired_automation"]') : fields[first];
        status.textContent = Object.keys(errors).length === 1 ? 'Please fix the highlighted field.' : 'Please fix the highlighted fields.';
        status.classList.add('is-error');
        if (target) target.focus();
        return;
      }
      const payload = buildPayload(values, {
        accessKey,
        botcheck: el.botcheck && el.botcheck.checked,
        page: form.dataset.page || 'https://buildwisegroup.dev/ai-automation#enquire'
      });
      setSending(true);
      status.textContent = 'Sending your request…';
      const result = await Enquiry.submitEnquiry(payload, fetchImpl ? { fetchImpl } : undefined);
      setSending(false);

      if (result.ok) {
        status.textContent = '';
        form.hidden = true;
        success.hidden = false;
        // For analytics.js: a lead was delivered. Carries no personal details.
        try { doc.dispatchEvent(new CustomEvent('bw:enquiry-sent', { detail: { projectType: PROJECT_TYPE, page: payload.page || '' } })); } catch (e) { /* old browsers */ }
        const heading = success.querySelector('h4, h3');
        if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
        form.reset();
        syncCount();
        return;
      }
      status.textContent = Enquiry.FAILURE_TEXT[result.reason] || Enquiry.FAILURE_TEXT.rejected;
      status.classList.add('is-error');
      submit.focus();
    });

    const again = doc.getElementById('automationAgain');
    if (again) again.addEventListener('click', () => {
      success.hidden = true;
      form.hidden = false;
      fields.business.focus();
    });
  }

  if (typeof document !== 'undefined' && Enquiry) {
    const start = () => mount(document);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  return { PROJECT_TYPE, LIMITS, INDUSTRIES, LOCATIONS, CHALLENGES, AUTOMATIONS, PACKAGES, normalizeRequest, buildPayload, mount };
});
