/*
 * BuildWise project enquiry form: validation and delivery through Web3Forms.
 *
 * Web3Forms emails each accepted submission to the inbox its access key was created
 * with. The key is a public form identifier (an alias for that inbox), not a secret:
 * Web3Forms' free plan is built for keys that sit in the browser, and the key can
 * only send mail to its own inbox. Create it at https://web3forms.com with the
 * address that should receive enquiries, then paste it into ACCESS_KEY.
 * While ACCESS_KEY is empty the form stays hidden and visitors see the email and
 * WhatsApp routes instead, so no enquiry can be lost to a form that is not connected.
 *
 * Works as a browser global (window.BWEnquiry) and as a CommonJS module for tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BWEnquiry = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  const ACCESS_KEY = '5abaf1c0-5ac4-4c1d-8d26-dac30dfa159b';
  const ENDPOINT = 'https://api.web3forms.com/submit';
  const SUBJECT = 'New Buildwise Project Enquiry';
  const TIMEOUT_MS = 20000;

  const LIMITS = { name: 100, email: 254, company: 120, phone: 24, message: 4000, messageMin: 20 };
  const PROJECT_TYPES = [
    'Application and cloud security review',
    'AI agents and AI employees',
    'AI product development',
    'SaaS or web application development',
    'Business automation and integrations',
    'Existing product improvement',
    'Other'
  ];
  const BUDGETS = ['Under $5,000', '$5,000 to $15,000', '$15,000 to $50,000', 'Over $50,000', 'Not sure yet'];
  const CONTACT_METHODS = ['Email', 'WhatsApp'];

  // One address, one @, a dotted domain; no spaces or angle brackets. Deliberately
  // stricter than the HTML spec so a typo such as "name@gmail" is caught.
  const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/;
  const PHONE = /^\+?[0-9][0-9 ()-]{5,22}$/;

  // Control characters (except tab and newline in the message) are dropped.
  const clean = (value, multiline) => {
    let s = String(value == null ? '' : value).normalize('NFC');
    s = multiline
      ? s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n')
      : s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
    return s.trim();
  };

  /* Returns { values, errors, valid }. errors maps a field name to its message. */
  function normalizeEnquiry(input) {
    const raw = input || {};
    const values = {
      name: clean(raw.name),
      email: clean(raw.email),
      company: clean(raw.company),
      projectType: clean(raw.projectType),
      budget: clean(raw.budget),
      message: clean(raw.message, true),
      contactMethod: clean(raw.contactMethod),
      phone: clean(raw.phone)
    };
    const errors = {};

    if (!values.name) errors.name = 'Enter your full name.';
    else if (values.name.length < 2) errors.name = 'Enter your full name.';
    else if (values.name.length > LIMITS.name) errors.name = `Keep your name under ${LIMITS.name} characters.`;

    if (!values.email) errors.email = 'Enter your work email address.';
    else if (values.email.length > LIMITS.email || !EMAIL.test(values.email)) errors.email = 'Enter a valid email address, like name@company.com.';

    if (values.company.length > LIMITS.company) errors.company = `Keep the company name under ${LIMITS.company} characters.`;

    if (!values.projectType) errors.projectType = 'Choose the type of project.';
    else if (!PROJECT_TYPES.includes(values.projectType)) errors.projectType = 'Choose one of the listed project types.';

    if (values.budget && !BUDGETS.includes(values.budget)) errors.budget = 'Choose one of the listed budget ranges.';

    if (!values.message) errors.message = 'Tell us about your project.';
    else if (values.message.length < LIMITS.messageMin) errors.message = `Add a little more detail (at least ${LIMITS.messageMin} characters).`;
    else if (values.message.length > LIMITS.message) errors.message = `Keep the description under ${LIMITS.message} characters.`;

    if (values.contactMethod && !CONTACT_METHODS.includes(values.contactMethod)) errors.contactMethod = 'Choose email or WhatsApp.';
    if (values.contactMethod !== 'WhatsApp') values.phone = '';
    else if (values.phone && !PHONE.test(values.phone)) errors.phone = 'Enter a phone number with its country code, like +44 7700 900123.';

    return { values, errors, valid: Object.keys(errors).length === 0 };
  }

  /* The JSON body Web3Forms receives. Every submitted field is listed in the email;
     `email` doubles as the reply-to address, and the sender stays Web3Forms' own. */
  function buildPayload(values, { accessKey = ACCESS_KEY, botcheck = false, page = '' } = {}) {
    const payload = {
      access_key: accessKey,
      subject: `${SUBJECT}: ${values.projectType}`,
      from_name: 'Buildwise website',
      replyto: values.email,
      name: values.name,
      email: values.email,
      company: values.company || 'Not given',
      project_type: values.projectType,
      budget: values.budget || 'Not given',
      preferred_contact: values.contactMethod || 'No preference',
      message: values.message,
      botcheck: Boolean(botcheck)
    };
    if (values.phone) payload.whatsapp_number = values.phone;
    if (page) payload.page = page;
    return payload;
  }

  /* Resolves to { ok: true } only when Web3Forms answers success: true.
     Otherwise { ok: false, reason } with reason one of: rejected, rate-limited, network, timeout. */
  async function submitEnquiry(payload, { fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null), timeoutMs = TIMEOUT_MS } = {}) {
    if (!fetchImpl) return { ok: false, reason: 'network' };
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (res.ok && data && data.success === true) return { ok: true };
      return { ok: false, reason: res.status === 429 ? 'rate-limited' : 'rejected' };
    } catch (e) {
      return { ok: false, reason: e && e.name === 'AbortError' ? 'timeout' : 'network' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const FAILURE_TEXT = {
    rejected: 'Your enquiry could not be sent. Your details are still here, so please try again, or message us on WhatsApp.',
    'rate-limited': 'Too many attempts in a short time. Please wait a minute and try again, or message us on WhatsApp.',
    network: 'Your enquiry could not be sent. Check your connection and try again, or message us on WhatsApp.',
    timeout: 'Sending took too long. Your details are still here, so please try again, or message us on WhatsApp.'
  };

  /* ---------- Browser wiring ---------- */
  function mount(doc, { accessKey = ACCESS_KEY, fetchImpl } = {}) {
    const form = doc.getElementById('enquiryForm');
    if (!form) return;
    const unavailable = doc.getElementById('enquiryUnavailable');
    const success = doc.getElementById('enquirySuccess');
    const status = doc.getElementById('enquiryStatus');
    const submit = doc.getElementById('enquirySubmit');
    const submitText = doc.getElementById('enquirySubmitText');
    const phoneRow = doc.getElementById('enqPhoneRow');
    const counter = doc.getElementById('enqMessageCount');

    if (!accessKey) {
      form.hidden = true;
      if (unavailable) unavailable.hidden = false;
      return;
    }
    form.hidden = false;
    if (unavailable) unavailable.hidden = true;
    form.noValidate = true;

    const fields = {
      name: form.elements.name,
      email: form.elements.email,
      company: form.elements.company,
      projectType: form.elements.project_type,
      budget: form.elements.budget,
      message: form.elements.message,
      phone: form.elements.whatsapp_number
    };
    const read = () => ({
      name: fields.name.value,
      email: fields.email.value,
      company: fields.company.value,
      projectType: fields.projectType.value,
      budget: fields.budget.value,
      message: fields.message.value,
      contactMethod: (form.querySelector('input[name="preferred_contact"]:checked') || {}).value || '',
      phone: fields.phone ? fields.phone.value : ''
    });

    const errorEl = name => doc.getElementById(`enq-${name}-error`);
    const setError = (name, message) => {
      const el = errorEl(name);
      const control = name === 'contactMethod' ? form.querySelector('.enq-choices') : fields[name];
      if (el) el.textContent = message || '';
      if (control) {
        if (message) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
      }
    };
    const order = ['name', 'email', 'company', 'projectType', 'budget', 'message', 'contactMethod', 'phone'];
    const showErrors = errors => order.forEach(name => setError(name, errors[name]));

    const syncPhone = () => {
      const wantsWhatsApp = read().contactMethod === 'WhatsApp';
      if (phoneRow) phoneRow.hidden = !wantsWhatsApp;
      if (!wantsWhatsApp) setError('phone', '');
    };
    form.querySelectorAll('input[name="preferred_contact"]').forEach(r => r.addEventListener('change', syncPhone));
    syncPhone();

    const syncCount = () => {
      if (!counter) return;
      const n = fields.message.value.length;
      counter.textContent = `${n} / ${LIMITS.message}`;
    };
    fields.message.addEventListener('input', syncCount);
    syncCount();

    // Once a field has been flagged, re-check it as the visitor fixes it.
    Object.entries(fields).forEach(([name, el]) => {
      if (!el) return;
      const recheck = () => {
        if (el.getAttribute('aria-invalid') !== 'true') return;
        setError(name, normalizeEnquiry(read()).errors[name]);
      };
      el.addEventListener('input', recheck);
      el.addEventListener('change', recheck);
    });

    const idleText = submitText.textContent;
    let sending = false;
    const setSending = on => {
      sending = on;
      submit.disabled = on;
      submit.setAttribute('aria-busy', String(on));
      form.classList.toggle('is-sending', on);
      submitText.textContent = on ? 'Sending enquiry…' : idleText;
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending) return;
      status.textContent = '';
      status.className = 'enq-status';
      const { values, errors, valid } = normalizeEnquiry(read());
      showErrors(errors);
      if (!valid) {
        const first = order.find(name => errors[name]);
        const target = first === 'contactMethod' ? form.querySelector('input[name="preferred_contact"]') : fields[first];
        status.textContent = Object.keys(errors).length === 1 ? 'Please fix the highlighted field.' : 'Please fix the highlighted fields.';
        status.classList.add('is-error');
        if (target) target.focus();
        return;
      }
      const payload = buildPayload(values, {
        accessKey,
        botcheck: form.elements.botcheck && form.elements.botcheck.checked,
        page: form.dataset.page || 'https://buildwisegroup.dev/#contact'
      });
      setSending(true);
      status.textContent = 'Sending your enquiry…';
      const result = await submitEnquiry(payload, fetchImpl ? { fetchImpl } : undefined);
      setSending(false);

      if (result.ok) {
        status.textContent = '';
        form.hidden = true;
        success.hidden = false;
        const heading = success.querySelector('h4, h3');
        if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
        form.reset();
        syncPhone();
        syncCount();
        return;
      }
      status.textContent = FAILURE_TEXT[result.reason] || FAILURE_TEXT.rejected;
      status.classList.add('is-error');
      submit.focus();
    });

    const again = doc.getElementById('enquiryAgain');
    if (again) again.addEventListener('click', () => {
      success.hidden = true;
      form.hidden = false;
      fields.name.focus();
    });
  }

  if (typeof document !== 'undefined') {
    const start = () => mount(document);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  return { ACCESS_KEY, ENDPOINT, SUBJECT, LIMITS, PROJECT_TYPES, BUDGETS, CONTACT_METHODS, FAILURE_TEXT, normalizeEnquiry, buildPayload, submitEnquiry, mount };
});
