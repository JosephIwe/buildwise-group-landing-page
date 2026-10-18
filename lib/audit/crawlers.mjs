/*
 * Search and AI crawlers the audit reports on, grouped by what the operator
 * says the crawler is for. Reviewed October 2026 against each operator's own
 * documentation (docs). Operators add and rename crawlers, so keep this list
 * short, sourced and dated.
 *
 * purpose:
 *   search      – builds a search engine's index
 *   ai-search   – finds pages to show or cite in an AI assistant's search answers
 *   ai-user     – fetches a page when a person asks an AI assistant to
 *   ai-training – collects content that may be used to train AI models
 *   control     – a robots.txt token only: it changes how content may be used, and the
 *                 operator's regular crawler does the fetching
 */
export const REVIEWED = '2026-10';

export const PURPOSES = {
  search: 'Search engine indexing',
  'ai-search': 'AI search answers',
  'ai-user': 'Fetches when a user asks',
  'ai-training': 'AI model training',
  control: 'Usage control token'
};

export const CRAWLERS = [
  { token: 'Googlebot', operator: 'Google', purpose: 'search', note: 'Crawls for Google Search, including the AI features that appear in Search.', docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers' },
  { token: 'Bingbot', operator: 'Microsoft', purpose: 'search', note: 'Crawls for Bing Search.', docs: 'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0' },
  { token: 'Applebot', operator: 'Apple', purpose: 'search', note: 'Crawls for search features such as Spotlight, Siri and Safari.', docs: 'https://support.apple.com/en-us/119829' },
  { token: 'OAI-SearchBot', operator: 'OpenAI', purpose: 'ai-search', note: 'Finds pages to show in ChatGPT search results.', docs: 'https://platform.openai.com/docs/bots' },
  { token: 'Claude-SearchBot', operator: 'Anthropic', purpose: 'ai-search', note: 'Indexes pages to improve search results in Claude.', docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler' },
  { token: 'PerplexityBot', operator: 'Perplexity', purpose: 'ai-search', note: 'Indexes pages to show and link in Perplexity answers.', docs: 'https://docs.perplexity.ai/guides/bots' },
  { token: 'ChatGPT-User', operator: 'OpenAI', purpose: 'ai-user', note: 'Fetches a page when a ChatGPT user asks. Because a person triggers it, OpenAI documents it separately from automatic crawling.', docs: 'https://platform.openai.com/docs/bots' },
  { token: 'Claude-User', operator: 'Anthropic', purpose: 'ai-user', note: 'Fetches a page when a Claude user asks.', docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler' },
  { token: 'Perplexity-User', operator: 'Perplexity', purpose: 'ai-user', note: 'Fetches a page when a Perplexity user asks. Perplexity says it generally ignores robots.txt for these requests.', docs: 'https://docs.perplexity.ai/guides/bots' },
  { token: 'GPTBot', operator: 'OpenAI', purpose: 'ai-training', note: 'Collects content that may be used to train OpenAI models.', docs: 'https://platform.openai.com/docs/bots' },
  { token: 'ClaudeBot', operator: 'Anthropic', purpose: 'ai-training', note: 'Collects content that may be used to train Anthropic models.', docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler' },
  { token: 'CCBot', operator: 'Common Crawl', purpose: 'ai-training', note: 'Builds the open Common Crawl dataset, which is widely used to train AI models.', docs: 'https://commoncrawl.org/ccbot' },
  { token: 'Meta-ExternalAgent', operator: 'Meta', purpose: 'ai-training', note: 'Collects content Meta may use to train AI models or improve products.', docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/' },
  { token: 'Google-Extended', operator: 'Google', purpose: 'control', note: 'Controls whether Google may use content for Gemini apps and Vertex AI. Google says it does not affect Google Search.', docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers' },
  { token: 'Applebot-Extended', operator: 'Apple', purpose: 'control', note: 'Controls whether Apple may use content to train its AI models. It does not crawl and does not affect Apple search features.', docs: 'https://support.apple.com/en-us/119829' }
];
