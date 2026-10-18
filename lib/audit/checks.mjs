/*
 * Website audit: turns gathered facts into a report.
 *
 * Each finding is either
 *   confirmed – a measured fact that is a problem (the evidence says what was seen), or
 *   advisory  – a recommendation or judgement call, where good practice or context decides.
 * Anything the audit could not measure goes in notChecked instead of becoming a finding.
 * There is no overall score: severities describe individual findings only.
 */
import { metaValues, readJsonLd } from './html.mjs';
import { checkAccess, describeAccess } from './robots.mjs';
import { CRAWLERS, PURPOSES, REVIEWED } from './crawlers.mjs';

export const REPORT_VERSION = '1.0.0';
export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const CAT = { seo: 'Technical SEO', crawl: 'Crawler access', content: 'Content and clarity' };

// Organization, LocalBusiness and their common schema.org subtypes. Types ending in
// Business/Organization/Service/Store/Agency are caught by the suffix. A node with
// business details (address, telephone, opening hours) also counts, so a specialised
// subtype missing from this list is not reported as missing.
const ORG_TYPES = /^(Organization|Corporation|LocalBusiness|NGO|Airline|Consortium|Project|ResearchOrganization|EducationalOrganization|School|CollegeOrUniversity|GovernmentOrganization|MedicalOrganization|NewsMediaOrganization|OnlineBusiness|OnlineStore|Restaurant|CafeOrCoffeeShop|Bakery|BarOrPub|FoodEstablishment|LegalService|Attorney|Notary|Dentist|Physician|Pharmacy|Hospital|Clinic|MedicalClinic|Optician|Electrician|Plumber|HVACBusiness|RoofingContractor|GeneralContractor|HousePainter|Locksmith|MovingCompany|AccountingService|InsuranceAgency|BankOrCreditUnion|RealEstateAgent|Hotel|Motel|Hostel|BedAndBreakfast|Resort|Campground|AutoRepair|AutoDealer|BeautySalon|HairSalon|NailSalon|DaySpa|HealthClub|GymOrFitnessCenter|ExerciseGym|Library|Museum|Florist|Winery|Brewery|Distillery|ChildCare|Preschool|VeterinaryCare|Physiotherapy|Psychologist|ProfessionalService|LodgingBusiness|SportsOrganization|PerformingGroup|MusicGroup|WorkersUnion|FundingScheme|Cooperative)$|(Business|Organization|Service|Store|Agency|Contractor)$/;
const BUSINESS_PROPS = ['address', 'telephone', 'openingHours', 'openingHoursSpecification', 'priceRange', 'geo'];
const GENERIC_H1 = /^(welcome|welcome to (our|my) (site|website)|home|homepage|home page|hello|hi|untitled|index|main|menu|logo)\b[.!]?$/i;
const CONTACT_HREF = /(^|[\/#])(contact|contact-us|kontakt|enquir\w*|inquir\w*|booking|book-\w+|book)([\/.?#]|$)/i;
const CONTACT_WORDS = /\b(contact|get in touch|enquir|inquir|book (a|an|now)|call us|email us|kontakt|contacto|reach us)/i;

const host = url => { try { return new URL(url).hostname; } catch (e) { return ''; } };
const bare = h => h.replace(/^www\./, '');
const kb = bytes => `${Math.round(bytes / 1024)} KB`;
const quote = text => `“${text}”`;

export function buildReport(f) {
  const findings = [];
  const passed = [];
  const notChecked = [];
  const add = (category, type, severity, title, evidence, why, fix, limits) => findings.push({ category, type, severity, title, evidence: evidence.filter(Boolean), why, fix, limits: limits || '' });

  const page = f.page;
  const final = new URL(page.url);
  const h = f.html;

  /* ---------- Status, redirects, HTTPS ---------- */
  if (page.status >= 400) {
    const blockedBot = page.status === 401 || page.status === 403 || page.status === 429;
    add(CAT.seo, 'confirmed', 'Critical', `The page returns an error (HTTP ${page.status})`,
      [`GET ${page.url} returned ${page.status}`],
      'Search engines and AI crawlers drop pages that return errors, so this page cannot appear in results while it does.',
      'Make the page return 200 for public visitors. If it should be private, this is expected.',
      blockedBot ? 'Some sites block automated checks like this one but let verified search crawlers through. Check with Google Search Console’s URL Inspection tool.' : '');
  } else {
    passed.push(`The page returned HTTP ${page.status}.`);
  }

  const hops = page.chain.length;
  if (hops >= 2) {
    add(CAT.seo, 'confirmed', 'Low', `${hops} redirects before the page loads`,
      page.chain.map(c => `${c.url} → ${c.status} → ${c.location}`),
      'Each redirect adds a round trip for visitors and crawlers, and long chains can stop crawlers before they reach the page.',
      `Link and redirect straight to ${page.url}.`);
  }
  const temporary = page.chain.filter(c => c.status === 302 || c.status === 307);
  if (temporary.length) {
    add(CAT.seo, 'advisory', 'Low', 'A temporary redirect is used', temporary.map(c => `${c.url} → ${c.status} → ${c.location}`),
      'Temporary (302/307) redirects tell search engines the old address may come back, so they may keep it in results instead of the new one.',
      'If the move is permanent, use a 301 or 308 redirect.');
  }
  if (!hops) passed.push('No redirects before the page.');

  if (final.protocol === 'http:') {
    const httpsWorks = f.scheme.state === 'fetched' && f.scheme.status < 400 && /^https:/.test(f.scheme.finalUrl || '');
    if (httpsWorks) {
      add(CAT.seo, 'confirmed', 'High', 'The site does not redirect to HTTPS', [`${page.url} loads over plain HTTP`, `https://${final.host}/ also works (HTTP ${f.scheme.status})`],
        'Browsers mark HTTP pages as “Not secure”, and search engines prefer the HTTPS version of a page.',
        `Redirect every http:// address to its https:// equivalent with a 301.`);
    } else {
      add(CAT.seo, 'confirmed', 'High', 'HTTPS does not appear to be available', [`${page.url} loads over plain HTTP`, `https://${final.host}/ could not be loaded`],
        'Browsers mark HTTP pages as “Not secure”, which puts visitors off, and search engines prefer HTTPS.',
        'Install a TLS certificate (most hosts and CDNs provide one free) and redirect HTTP to HTTPS.',
        'The HTTPS check is a single request; a temporary fault would look the same.');
    }
  } else {
    passed.push('The page is served over HTTPS.');
    if (f.scheme.state === 'fetched') {
      if (/^https:/.test(f.scheme.finalUrl || '')) passed.push(`http://${final.host}/ redirects to HTTPS.`);
      else if (f.scheme.status < 400) {
        add(CAT.seo, 'confirmed', 'Medium', 'The HTTP address does not redirect to HTTPS', [`GET http://${final.host}/ returned ${f.scheme.status} without redirecting to https://`],
          'Visitors and links that use http:// get an unencrypted page, and search engines may see two copies of the site.',
          'Redirect every http:// address to its https:// equivalent with a 301.');
      }
    } else if (f.scheme.state !== 'unreachable') {
      notChecked.push({ title: 'Whether http:// redirects to https://', reason: 'That request could not be completed.' });
    }
  }

  /* ---------- Indexability ---------- */
  const robotsMeta = h ? [...metaValues(h, 'name', 'robots'), ...metaValues(h, 'name', 'googlebot')] : [];
  const header = page.headers['x-robots-tag'] || '';
  const noindexMeta = robotsMeta.filter(v => /\b(noindex|none)\b/i.test(v));
  if (noindexMeta.length) {
    add(CAT.seo, 'confirmed', 'Critical', 'The page tells search engines not to index it', noindexMeta.map(v => `<meta name="robots" content="${v}">`),
      'A noindex directive removes the page from search results, and AI search tools that rely on those indexes will not find it either.',
      'Remove noindex from pages you want found. It is often left over from a staging site.');
  }
  if (/\b(noindex|none)\b/i.test(header)) {
    add(CAT.seo, 'confirmed', 'Critical', 'The server sends a noindex header', [`X-Robots-Tag: ${header}`],
      'This HTTP header removes the page from search results even when the HTML looks fine.',
      'Remove noindex from the X-Robots-Tag header for public pages (check your server, CDN or hosting settings).');
  }
  const nofollow = robotsMeta.filter(v => /\bnofollow\b/i.test(v) && !/\bnone\b/i.test(v));
  if (nofollow.length) {
    add(CAT.seo, 'confirmed', 'Medium', 'The page tells crawlers not to follow its links', nofollow.map(v => `<meta name="robots" content="${v}">`),
      'Crawlers use links to discover your other pages; nofollow on the homepage hides them.',
      'Remove nofollow from the robots meta tag unless you have a specific reason.');
  }
  if (h && !noindexMeta.length && !/\b(noindex|none)\b/i.test(header)) passed.push('No noindex directive on the page.');

  if (!h) {
    notChecked.push({ title: 'Page content, headings, metadata and structured data', reason: page.status >= 400 ? 'The page returned an error, so there was no content to read.' : 'The page returned no HTML to read.' });
  } else {
    if (page.truncated) {
      add(CAT.seo, 'confirmed', 'Medium', `The HTML is larger than ${kb(f.limits.htmlBytes)}`, [`Only the first ${kb(f.limits.htmlBytes)} of ${page.url} was read`],
        'Very large HTML is slow to download and parse, and some crawlers stop reading after a limit.',
        'Move inline data, styles and scripts into separate files, and paginate long lists.',
        'Checks below are based on the part that was read.');
    } else if (page.bytes > 500000) {
      add(CAT.seo, 'confirmed', 'Low', `Large HTML document (${kb(page.bytes)})`, [`${page.url} is ${kb(page.bytes)} of HTML`],
        'Large pages take longer to load on mobile connections.', 'Move inline data, styles and scripts into separate files.');
    }
    contentChecks(f, h, final, add, passed, notChecked);
  }

  if (page.ms > 3000) {
    add(CAT.seo, 'advisory', 'Low', 'The server was slow to respond', [`The page took ${(page.ms / 1000).toFixed(1)} s to load from Cloudflare’s network`],
      'Slow responses frustrate visitors and can reduce how much crawlers fetch.', 'Check hosting, caching and server-side processing time.',
      'This is one measurement from a data centre, not what your visitors experience. Use PageSpeed Insights for field data.');
  }

  /* ---------- robots.txt and crawlers ---------- */
  const crawlers = robotsChecks(f, final, add, passed, notChecked);

  /* ---------- Sitemap ---------- */
  sitemapChecks(f, add, passed, notChecked);

  /* ---------- Links ---------- */
  if (h) linkChecks(f, add, passed, notChecked);

  /* ---------- Always outside this audit ---------- */
  notChecked.push(
    { title: 'Whether any search engine or AI system has crawled, indexed or cited the site', reason: 'robots.txt only states permission. Google Search Console and Bing Webmaster Tools show what is actually indexed.' },
    { title: 'Firewall, CDN or bot-management rules', reason: 'These can block crawlers even when robots.txt allows them (for example, a CDN setting that blocks AI bots). This audit cannot request pages as those crawlers.' },
    { title: 'Content added by JavaScript', reason: 'The audit reads the HTML your server sends and does not run scripts.' },
    { title: 'Other pages of the site', reason: `Only this page was read in full. Up to ${f.limits.linkChecks} internal links were checked for errors.` },
    { title: 'Page speed and Core Web Vitals', reason: 'These need real browsers and visitor data. PageSpeed Insights measures them.' },
    { title: 'Rankings, traffic and AI citations', reason: 'They depend on competition and many signals no single page check can measure.' }
  );

  findings.sort((a, b) => (a.type === b.type ? 0 : a.type === 'confirmed' ? -1 : 1) || SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
  const confirmed = findings.filter(x => x.type === 'confirmed');
  const advisory = findings.filter(x => x.type === 'advisory');

  return {
    version: REPORT_VERSION,
    auditedAt: f.auditedAt,
    input: f.input,
    requestedUrl: f.target,
    finalUrl: page.url,
    status: page.status,
    redirects: page.chain,
    responseMs: page.ms,
    htmlBytes: page.bytes,
    introduction: h ? introduction(h) : null,
    confirmed,
    advisory,
    crawlers,
    crawlerReviewed: REVIEWED,
    passed,
    notChecked,
    requests: f.log,
    counts: {
      confirmed: confirmed.length,
      advisory: advisory.length,
      bySeverity: Object.fromEntries(SEVERITIES.map(s => [s, confirmed.filter(x => x.severity === s).length]))
    },
    method: `Automated technical check of public data, run ${f.auditedAt.slice(0, 10)}. The audit requested the page, robots.txt, a sitemap and up to ${f.limits.linkChecks} internal links (${f.log.length} requests), read the HTML without running scripts and compared it against documented search and crawler behaviour. Confirmed findings are measured facts; recommendations are good practice that depends on your goals.`,
    disclaimer: 'This is an automated technical audit, not a guarantee of search rankings, AI citations or customers. Allowing a crawler in robots.txt does not mean it has visited the site or will show it in answers.'
  };
}

function introduction(h) {
  const description = metaValues(h, 'name', 'description')[0] || '';
  const h1 = h.headings.find(x => x.level === 1);
  return { title: h.titles[0] || '', h1: h1 ? h1.text : '', description: description.slice(0, 300), text: h.textSample.slice(0, 300) };
}

function contentChecks(f, h, final, add, passed, notChecked) {
  const page = f.page;
  // Title
  const titles = h.titles.filter(Boolean);
  if (!titles.length) {
    add(CAT.seo, 'confirmed', 'High', 'The page has no title', [h.titles.length ? 'The <title> element is empty' : 'No <title> element in the HTML'],
      'The title is the headline search engines and AI tools show for your page, and a strong signal of what it is about.',
      'Add a unique title that names what you offer and your brand, for example “Kitchen fitting in Leeds | Smith & Co”.');
  } else {
    passed.push(`Title found: ${quote(titles[0])}.`);
    if (h.titles.length > 1) add(CAT.seo, 'confirmed', 'Low', 'The page has more than one title', h.titles.map(t => `<title>${t}</title>`), 'Search engines use only one, and may not pick the one you want.', 'Keep a single <title> in the <head>.');
    if (titles[0].length > 65) add(CAT.seo, 'advisory', 'Low', 'The title may be cut short in results', [`${titles[0].length} characters: ${quote(titles[0])}`], 'Results show roughly the first 50–60 characters, so the end may be hidden.', 'Put the most important words first and aim for under 60 characters.', 'Truncation depends on pixel width, so this is approximate.');
    else if (titles[0].length < 15) add(CAT.seo, 'advisory', 'Low', 'The title is very short', [`${titles[0].length} characters: ${quote(titles[0])}`], 'A short title gives search engines and people little to go on.', 'Say what you do and for whom, plus your brand.');
  }

  // Description
  const descriptions = metaValues(h, 'name', 'description').filter(Boolean);
  if (!descriptions.length) {
    add(CAT.seo, 'confirmed', 'Low', 'No meta description', ['No <meta name="description"> with content'],
      'Search engines often show the description under your title. Without one they pick text from the page, which may not sell it well.',
      'Add a one or two sentence description of the page, around 120–160 characters.', 'Search engines may rewrite descriptions even when one is present.');
  } else {
    passed.push('Meta description found.');
    if (descriptions.length > 1) add(CAT.seo, 'confirmed', 'Low', 'More than one meta description', descriptions.map(d => quote(d.slice(0, 120))), 'Search engines may combine or ignore conflicting descriptions.', 'Keep a single meta description.');
    if (descriptions[0].length > 170) add(CAT.seo, 'advisory', 'Low', 'The meta description is long', [`${descriptions[0].length} characters`], 'Long descriptions are usually cut off in results.', 'Aim for around 120–160 characters with the key message first.');
  }

  // Canonical
  const canon = [...new Set(h.canonical.filter(Boolean))];
  if (!h.canonical.length) {
    add(CAT.seo, 'advisory', 'Low', 'No canonical URL', ['No <link rel="canonical"> on the page'],
      'A canonical tag tells search engines which address is the main one when a page is reachable at several (with tracking parameters, www and non-www).',
      `Add <link rel="canonical" href="${final.href}">, using the address you want in results.`);
  } else if (canon.length > 1) {
    add(CAT.seo, 'confirmed', 'Medium', 'Conflicting canonical URLs', canon.map(c => `<link rel="canonical" href="${c}">`),
      'When a page names several canonical URLs, search engines may ignore all of them.', 'Keep one canonical tag.');
  } else if (canon.length === 1) {
    const u = h.resolve(canon[0]);
    if (!u || !/^https?:$/.test(u.protocol)) {
      add(CAT.seo, 'confirmed', 'Medium', 'The canonical URL is not a valid web address', [`<link rel="canonical" href="${canon[0]}">`], 'Search engines ignore a canonical they cannot use.', 'Use the full https:// address of the page.');
    } else {
      u.hash = '';
      if (bare(u.hostname) !== bare(final.hostname)) {
        add(CAT.seo, 'confirmed', 'Medium', 'The canonical URL points to another site', [`Page: ${final.href}`, `Canonical: ${u.href}`],
          'Search engines may index the other site’s address instead of this one.', 'Point the canonical at this site, unless the other site is meant to be the main copy.', 'This is correct if the content officially lives on the other domain.');
      } else if (u.protocol === 'http:' && final.protocol === 'https:') {
        add(CAT.seo, 'confirmed', 'Low', 'The canonical URL uses http://', [`Canonical: ${u.href}`], 'It points search engines at the insecure version of the page.', 'Use the https:// address.');
      } else if (u.hostname !== final.hostname || u.pathname !== final.pathname) {
        add(CAT.seo, 'advisory', 'Low', 'The canonical URL is a different address', [`Page: ${final.href}`, `Canonical: ${u.href}`],
          'Search engines will usually index the canonical address instead of this one.', 'Check this is intended, for example a www to non-www choice.', 'This is often deliberate.');
      } else passed.push('The canonical URL matches the page.');
    }
  }

  // Mobile and language
  const viewport = metaValues(h, 'name', 'viewport');
  if (!viewport.length) {
    add(CAT.seo, 'confirmed', 'Medium', 'No mobile viewport setting', ['No <meta name="viewport"> on the page'],
      'Without it, phones show a shrunken desktop page. Google indexes the mobile version of sites.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and check the layout on a phone.');
  } else {
    passed.push('Mobile viewport is set.');
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport[0])) {
      add(CAT.content, 'confirmed', 'Low', 'Zooming is disabled on phones', [`<meta name="viewport" content="${viewport[0]}">`], 'People with low vision rely on pinch-to-zoom.', 'Remove user-scalable=no and maximum-scale=1.');
    }
  }
  if (!h.lang) add(CAT.seo, 'confirmed', 'Low', 'The page language is not declared', ['<html> has no lang attribute'], 'The language helps search engines, translation tools and screen readers.', 'Add a lang attribute, for example <html lang="en">.');

  // Headings
  const h1s = h.headings.filter(x => x.level === 1);
  if (!h1s.length) {
    add(CAT.content, 'confirmed', 'Medium', 'No main heading (H1)', ['No <h1> element in the HTML'],
      'The main heading is one of the clearest signals of what a page is about, for people, search engines and AI tools.', 'Add one <h1> that says plainly what you do.');
  } else if (!h1s[0].text) {
    add(CAT.content, 'confirmed', 'Medium', 'The main heading (H1) has no text', ['The first <h1> contains no text (it may be an image or logo)'],
      'Crawlers read text, so an image-only heading tells them nothing.', 'Put real text in the <h1>. If it holds a logo image, give it descriptive alt text or move the heading elsewhere.');
  } else {
    passed.push(`Main heading: ${quote(h1s[0].text)}.`);
    if (GENERIC_H1.test(h1s[0].text)) {
      add(CAT.content, 'advisory', 'Medium', 'The main heading does not say what you do', [`<h1>${h1s[0].text}</h1>`],
        'A newcomer, a search engine or an AI assistant should understand what you offer from the first heading.', 'Rewrite the H1 to name what you do and for whom, for example “Accountants for small construction firms”.');
    }
    if (h1s.length > 1) add(CAT.content, 'advisory', 'Low', `${h1s.length} H1 headings`, h1s.slice(0, 4).map(x => `<h1>${x.text || '(no text)'}</h1>`), 'Several H1s are valid HTML, but one clear main heading makes the page’s topic easier to read.', 'Keep one H1 for the main topic and use H2s for sections.');
  }

  // Text in the HTML
  if (h.words < 50) {
    add(CAT.content, 'advisory', 'High', 'Very little text in the HTML', [`About ${h.words} words of visible text in the HTML the server sent`, `${h.scripts} script elements`],
      'If content is added by JavaScript, Google can usually render it, but not every crawler runs scripts: independent tests have reported that several AI crawlers read only the HTML.',
      'Make sure the main content and navigation are in the HTML the server sends (server-side rendering or pre-rendering).',
      'The audit does not run JavaScript, so it cannot see content added after the page loads.');
  } else if (h.words < 150) {
    add(CAT.content, 'advisory', 'Medium', 'Little descriptive text on the page', [`About ${h.words} words of visible text`],
      'Search engines and AI tools understand a business from what its pages say. A few lines give them little to work with.', 'Explain what you do, who it is for, where you work and how to start, in plain words.',
      'Content added by JavaScript is not counted.');
  } else passed.push(h.words >= 5000 ? "More than 5,000 words of text in the HTML." : `About ${h.words} words of text in the HTML.`);

  // Structured data
  const blocks = readJsonLd(h.jsonLd);
  const broken = blocks.filter(b => !b.ok);
  broken.forEach(b => add(CAT.content, 'confirmed', 'Medium', 'Structured data cannot be read', [`A <script type="application/ld+json"> block is not valid JSON: ${quote(b.snippet)}`],
    'Search engines ignore structured data they cannot parse.', 'Fix the JSON (a missing comma or quote is common) and test it with the Schema.org validator or Google’s Rich Results Test.'));
  const nodes = blocks.filter(b => b.ok).flatMap(b => b.nodes);
  const types = [...new Set(blocks.filter(b => b.ok).flatMap(b => b.types))];
  const typeOf = n => [].concat(n['@type']).filter(t => typeof t === 'string').map(t => t.replace(/^https?:\/\/schema\.org\//, ''));
  const org = nodes.find(n => typeOf(n).some(t => ORG_TYPES.test(t))) || nodes.find(n => typeOf(n).length && n.name && BUSINESS_PROPS.some(k => n[k]));
  if (org) {
    passed.push(`Organisation structured data found (${typeOf(org).join(', ')}).`);
    const missing = ['name', 'url'].filter(k => !org[k]);
    if (missing.length) add(CAT.content, 'confirmed', 'Low', 'Organisation structured data is missing basic details', [`${typeOf(org).join(', ')} has no ${missing.join(' or ')}`], 'Name and URL are what tie the structured data to your business.', `Add ${missing.join(' and ')} to the ${typeOf(org)[0]} entry.`);
  } else if (types.length) {
    add(CAT.content, 'advisory', 'Low', 'No organisation structured data', [`Structured data found: ${types.slice(0, 6).join(', ')}`, 'None describes the organisation'],
      'Organization or LocalBusiness data states your name, logo, contact details and address in a form machines read reliably.', 'Add an Organization (or LocalBusiness) JSON-LD block with facts that also appear on the page.',
      'A specialised schema.org type this audit does not recognise may already cover this.');
  } else if (h.microdata || h.rdfa) {
    notChecked.push({ title: 'Microdata or RDFa structured data', reason: 'The page uses inline structured data markup, which this audit detects but does not validate.' });
  } else {
    add(CAT.content, 'advisory', 'Low', 'No structured data found', ['No JSON-LD, microdata or RDFa on the page'],
      'Structured data states key facts (who you are, contact details, address) in a form search engines and other tools read reliably. It is optional and does not guarantee rich results.',
      'Add an Organization (or LocalBusiness) JSON-LD block with facts that also appear on the page.');
  }

  // Contact route
  const anchors = h.anchors;
  const routes = [];
  if (anchors.some(a => /^mailto:/i.test(a.href))) routes.push('an email link');
  if (anchors.some(a => /^tel:/i.test(a.href))) routes.push('a phone link');
  if (anchors.some(a => CONTACT_WORDS.test(a.text) || CONTACT_HREF.test(a.href))) routes.push('a contact or booking link');
  if (nodes.some(n => n.telephone || n.email || n.address || n.contactPoint)) routes.push('contact details in structured data');
  if (routes.length) passed.push(`Contact route found: ${routes.join(', ')}.`);
  else {
    add(CAT.content, 'advisory', 'Medium', 'No contact route found on the page', ['No email link, phone link, contact or booking link, or contact details in structured data'],
      'Visitors and AI assistants answering “how do I contact them?” need a clear route.', 'Add a visible contact link, email or phone number, ideally in the header or footer.',
      'Contact forms and details added by JavaScript are not detected.');
  }

  // Social preview
  const og = p => metaValues(h, 'property', p)[0];
  if (!og('og:title') && !og('og:image')) {
    add(CAT.content, 'advisory', 'Low', 'No social sharing preview', ['No og:title or og:image tags'], 'When the page is shared in chat apps or social networks, the preview may be blank or pick a random image.', 'Add Open Graph tags (og:title, og:description, og:image) to the page.');
  } else passed.push('Social sharing preview tags found.');
}

function robotsChecks(f, final, add, passed, notChecked) {
  const r = f.robots;
  const paths = [final.pathname];
  const rows = CRAWLERS.map(c => ({ token: c.token, operator: c.operator, purpose: c.purpose, purposeLabel: PURPOSES[c.purpose], note: c.note, docs: c.docs, access: 'unknown', rule: '' }));
  const evidenceUrl = r.finalUrl || r.url;

  if (r.state === 'server-error') {
    add(CAT.crawl, 'confirmed', 'High', `robots.txt returns a server error (HTTP ${r.status})`, [`GET ${r.url} returned ${r.status}`],
      'RFC 9309 tells crawlers to treat the whole site as disallowed while robots.txt returns a server error, so crawling may stop.', 'Fix the server so /robots.txt returns 200 with your rules, or 404 if you have none.');
    rows.forEach(row => { row.access = 'blocked'; row.rule = 'Server error: crawlers should assume everything is disallowed'; });
    return rows;
  }
  if (r.state === 'missing') {
    add(CAT.crawl, 'advisory', 'Low', 'No robots.txt file', [`GET ${r.url} returned ${r.status}`],
      'Crawlers treat a missing robots.txt as permission to crawl everything, which is fine. A file lets you list your sitemap and set rules per crawler.',
      'Add a robots.txt with a Sitemap line, and rules for any crawler you want to limit.');
    rows.forEach(row => { row.access = 'allowed'; row.rule = 'No robots.txt, so nothing is disallowed'; });
    passed.push('No robots.txt, so no crawler is disallowed.');
    return rows;
  }
  if (r.state === 'html') {
    add(CAT.crawl, 'confirmed', 'Medium', 'robots.txt returns a web page instead of rules', [`GET ${evidenceUrl} returned HTML`],
      'Crawlers cannot read rules from an HTML page, so any rules you meant to set are not in effect. This often means the server answers every address with the homepage.',
      'Serve a plain-text robots.txt at /robots.txt, or make the address return 404.');
    rows.forEach(row => { row.access = 'allowed'; row.rule = 'No readable rules, so nothing is disallowed'; });
    return rows;
  }
  if (r.state !== 'ok') {
    const reasons = { timeout: 'The request timed out.', blocked: 'It redirected to an address the audit does not request.', redirects: 'It redirected too many times.', skipped: 'The audit reached its request limit.', unreachable: 'It could not be fetched.' };
    notChecked.push({ title: 'robots.txt and crawler rules', reason: reasons[r.state] || reasons.unreachable });
    return rows;
  }

  const parsed = r.parsed;
  passed.push(`robots.txt found (${parsed.groups.length} rule group${parsed.groups.length === 1 ? '' : 's'}).`);
  if (r.truncated) notChecked.push({ title: 'The end of robots.txt', reason: `Only the first ${kb(f.limits.robotsBytes)} was read.` });
  if (parsed.invalid) {
    add(CAT.crawl, 'confirmed', 'Low', `robots.txt has ${parsed.invalid} line${parsed.invalid === 1 ? '' : 's'} crawlers will ignore`, parsed.invalidSamples.map(s => `Line ${s.line}: ${s.text}`),
      'Lines that are not valid directives are skipped, so a rule you meant to set may not apply.', 'Check each line is “Field: value”, using User-agent, Allow, Disallow or Sitemap.');
  }
  if (parsed.orphanRules) {
    add(CAT.crawl, 'confirmed', 'Low', 'Some robots.txt rules are not under any User-agent', [`${parsed.orphanRules} Allow or Disallow line(s) before the first User-agent line`],
      'Crawlers ignore rules that do not belong to a group.', 'Put a User-agent line above every set of rules.');
  }

  // Internal pages to check rules against, besides this page.
  (f.links.checked || []).forEach(l => { try { const p = new URL(l.url).pathname; if (!paths.includes(p)) paths.push(p); } catch (e) { /* skip */ } });

  rows.forEach(row => {
    const access = checkAccess(parsed, row.token, final.pathname + final.search);
    row.access = access.allowed ? 'allowed' : 'blocked';
    row.rule = describeAccess(access);
    row.matchedBy = access.matchedBy;
  });

  const blocked = purpose => rows.filter(x => x.purpose === purpose && x.access === 'blocked');
  const evidence = list => list.map(x => `${x.token}: ${x.rule}`);
  const search = blocked('search');
  if (search.length) {
    const major = search.some(x => x.token === 'Googlebot' || x.token === 'Bingbot');
    add(CAT.crawl, 'confirmed', major ? 'Critical' : 'Medium', `robots.txt blocks ${search.map(x => x.token).join(', ')} from this page`, [`From ${evidenceUrl}`, ...evidence(search)],
      'Search engines that are disallowed cannot crawl the page, so it will not appear properly in their results, and AI answers built on those indexes will miss it.',
      'Remove or narrow the Disallow rule for these crawlers.');
  } else passed.push('Search engine crawlers are allowed to crawl this page.');

  const aiSearch = blocked('ai-search');
  if (aiSearch.length) {
    add(CAT.crawl, 'confirmed', 'High', `robots.txt blocks AI search crawlers (${aiSearch.map(x => x.token).join(', ')})`, [`From ${evidenceUrl}`, ...evidence(aiSearch)],
      'These crawlers find pages for AI assistants’ search answers. Blocking them can keep your pages out of those answers.',
      'If you want to appear in AI search answers, allow these crawlers. You can still block training crawlers separately.',
      'Allowing them does not guarantee your site will be shown or cited.');
  } else passed.push('AI search crawlers are allowed to crawl this page.');

  const aiUser = blocked('ai-user');
  if (aiUser.length) {
    add(CAT.crawl, 'advisory', 'Low', `robots.txt disallows user-triggered AI fetchers (${aiUser.map(x => x.token).join(', ')})`, [`From ${evidenceUrl}`, ...evidence(aiUser)],
      'These fetch a page when a person asks an assistant about it. Operators document different robots.txt handling for them, so the effect varies.',
      'Allow them if you want assistants to open your pages when people ask about you.');
  }

  // Linked pages blocked for Googlebot (often deliberate: carts, accounts).
  const blockedPaths = paths.slice(1).filter(p => !checkAccess(parsed, 'Googlebot', p).allowed);
  if (blockedPaths.length) {
    add(CAT.crawl, 'advisory', 'Low', 'Some linked pages are blocked for search crawlers', blockedPaths.map(p => `${p}: ${describeAccess(checkAccess(parsed, 'Googlebot', p))}`),
      'Blocked pages cannot be crawled, so their content will not be used in search results.', 'Check these are pages you mean to keep out of search (accounts, carts, admin).', 'Only the internal links checked by this audit were tested.');
  }
  return rows;
}

function sitemapChecks(f, add, passed, notChecked) {
  const s = f.sitemap;
  const fromRobots = s.source === 'robots';
  if (s.state === 'compressed') { notChecked.push({ title: 'The sitemap’s contents', reason: `${s.url} is compressed, which this audit does not unpack.` }); return; }
  if (s.state === 'missing') {
    if (fromRobots) add(CAT.seo, 'confirmed', 'Medium', 'The sitemap listed in robots.txt cannot be fetched', [`Sitemap: ${s.url} returned ${s.status}`], 'Search engines cannot use a sitemap they cannot fetch.', 'Fix the address in robots.txt or publish the sitemap there.');
    else add(CAT.seo, 'advisory', 'Low', 'No sitemap found', ['robots.txt lists no sitemap', `${s.url} returned ${s.status}`], 'A sitemap helps search engines find every page, especially new ones and pages with few links.', 'Publish an XML sitemap (most site builders and CMSs can generate one), list it in robots.txt and submit it in Google Search Console.', 'A sitemap at another address that is not listed in robots.txt would not be found by this check.');
    return;
  }
  if (s.state !== 'ok') { notChecked.push({ title: 'The sitemap', reason: s.state === 'timeout' ? 'The request timed out.' : 'It could not be fetched.' }); return; }
  const p = s.parsed;
  if (p.kind === 'html' || p.kind === 'not-xml' || p.kind === 'unknown-xml') {
    add(CAT.seo, 'confirmed', 'Medium', 'The sitemap is not a valid sitemap file', [`${s.url} ${p.kind === 'html' ? 'returned a web page' : 'has no <urlset> or <sitemapindex>'}`], 'Search engines cannot read pages from it.', 'Serve an XML sitemap with a <urlset> (or <sitemapindex>) root element.');
    return;
  }
  if (!fromRobots) add(CAT.seo, 'advisory', 'Low', 'The sitemap is not listed in robots.txt', [`Found at ${s.url}`, 'No Sitemap: line in robots.txt'], 'A Sitemap line lets every crawler find it, not only those you submit it to.', `Add “Sitemap: ${s.url}” to robots.txt.`);
  if (p.kind === 'sitemapindex') {
    passed.push(`Sitemap index found listing ${p.count} sitemap${p.count === 1 ? '' : 's'}.`);
    notChecked.push({ title: 'Child sitemaps', reason: 'The sitemap is an index. The sitemaps it lists were not fetched.' });
  } else if (!p.count) {
    add(CAT.seo, 'confirmed', 'Medium', 'The sitemap lists no pages', [`${s.url} contains no <loc> entries`], 'An empty sitemap gives search engines nothing to crawl.', 'Make sure the sitemap generator includes your public pages.');
  } else passed.push(`Sitemap found with ${s.truncated ? 'at least ' : ''}${p.count} URL${p.count === 1 ? '' : 's'}.`);
  if (p.invalid) add(CAT.seo, 'confirmed', 'Medium', 'The sitemap has invalid addresses', [`${p.invalid} <loc> entr${p.invalid === 1 ? 'y is' : 'ies are'} not full http(s) URLs`, ...p.invalidSamples.map(x => `Example: ${x}`)], 'Search engines skip entries that are not absolute URLs.', 'Use full addresses starting with https://.');
  if (p.offHost) add(CAT.seo, 'confirmed', 'Low', 'The sitemap lists pages on another host', [`${p.offHost} entr${p.offHost === 1 ? 'y points' : 'ies point'} away from ${host(f.page.url)}`], 'Search engines normally ignore sitemap entries for other hosts.', 'List only this site’s own pages, or use one sitemap per host.');
  if (s.truncated) notChecked.push({ title: 'The rest of the sitemap', reason: `Only the first ${kb(f.limits.sitemapBytes)} was read.` });
  else if (!p.closed && p.count) add(CAT.seo, 'confirmed', 'Low', 'The sitemap appears incomplete', [`${s.url} does not end with </${p.kind}>`], 'A cut-off XML file may be rejected.', 'Check the sitemap is generated completely.');
}

function linkChecks(f, add, passed, notChecked) {
  const l = f.links;
  if (!l.internal) {
    add(CAT.seo, 'confirmed', 'Medium', 'No internal links in the HTML', [`The HTML of ${f.page.url} has no links to other pages on ${host(f.page.url)}`],
      'Crawlers find pages by following links. Without them only the sitemap leads anywhere.', 'Add normal <a href> links to your main pages in the navigation and footer.',
      'Navigation built by JavaScript is not detected.');
    return;
  }
  const checked = l.checked.filter(c => c.status != null);
  const broken = checked.filter(c => c.status === 404 || c.status === 410 || c.status >= 500);
  const failed = l.checked.filter(c => c.status == null);
  if (broken.length) {
    add(CAT.seo, 'confirmed', 'Medium', `${broken.length} broken internal link${broken.length === 1 ? '' : 's'}`, broken.map(c => `${c.url} returned ${c.status}`),
      'Broken links waste crawl effort and lose visitors.', 'Fix or remove the links, or redirect the old addresses with a 301.', `Only the first ${f.limits.linkChecks} internal links were checked.`);
  } else if (checked.length) passed.push(`${checked.length} internal link${checked.length === 1 ? '' : 's'} checked without errors.`);
  if (failed.length) notChecked.push({ title: `${failed.length} internal link${failed.length === 1 ? '' : 's'}`, reason: 'The request timed out, was not made because of the audit’s request limit, or could not be completed.' });
}
