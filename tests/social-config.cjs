/* Reads the official social profiles from social-links.js the way a browser would,
 * so tests can check the site against the one configuration file. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSocial(source = fs.readFileSync(path.resolve(__dirname, '..', 'social-links.js'), 'utf8')) {
  const window = {};
  const document = { readyState: 'complete', querySelectorAll: () => [], addEventListener() {} };
  vm.runInNewContext(source, { window, document, URL });
  // Copy out of the sandbox so deepEqual compares plain arrays.
  return JSON.parse(JSON.stringify(window.BUILDWISE_SOCIAL));
}

module.exports = { loadSocial };
