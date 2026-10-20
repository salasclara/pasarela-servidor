'use strict';

// Fancy Engine V1 — isolated web-first workflow.
// Nothing is scheduled, deployed or posted by importing this module.
const CATEGORIES = new Set(['HOME', 'STYLE', 'BEAUTY', 'TECH']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASE_URL = 'https://www.fancybyroxette.com';
function assertString(value, name, max = 5000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new TypeError(name + ' must be a nonempty bounded string');
  return value.trim();
}
function normalizeDraft(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Draft required');
  const category = assertString(input.category, 'category', 20);
  if (!CATEGORIES.has(category)) throw new TypeError('Unsupported category');
  const slug = assertString(input.slug, 'slug', 120);
  if (!SLUG.test(slug)) throw new TypeError('Invalid slug');
  const title = assertString(input.title, 'title', 180);
  const summary = assertString(input.summary, 'summary', 450);
  const intro = assertString(input.intro, 'intro', 2500);
  if (!Array.isArray(input.sections) || input.sections.length < 1 || input.sections.length > 15)
    throw new TypeError('Sections required (1–15)');
  const sections = input.sections.map((section, i) => ({
    heading: assertString(section.heading, 'sections[' + i + '].heading', 150),
    body: assertString(section.body, 'sections[' + i + '].body', 3500)
  }));
  return { category, slug, title, summary, intro, sections };
}
function approveDraft(draft, approval) {
  const doc = normalizeDraft(draft);
  if (!approval || approval.productsVerified !== true || approval.imagesRightsReviewed !== true ||
      approval.affiliateDisclosureReviewed !== true)
    throw new Error('Editorial and commercial review incomplete');
  const reviewed_by = assertString(approval.reviewed_by, 'reviewed_by', 100);
  const approved_at = assertString(approval.approved_at, 'approved_at', 40);
  if (!Number.isFinite(Date.parse(approved_at))) throw new Error('Invalid approval date');
  return { ...doc, status: 'approved', reviewed_by, approved_at, productsVerified: true, imagesRightsReviewed: true, affiliateDisclosureReviewed: true };
}
function buildArticleUrl(article) {
  const doc = normalizeDraft(article);
  return BASE_URL + '/' + doc.category.toLowerCase() + '/' + doc.slug + '/';
}
function makeSocialJobs(article, publishedUrl, channels = ['facebook', 'instagram']) {
  if (article.status !== 'published') throw new Error('Only published articles can be distributed');
  if (article.distributionApproved !== true) throw new Error('Social distribution approval required');
  const expected = buildArticleUrl(article);
  if (publishedUrl !== expected) throw new Error('Published URL does not match canonical URL');
  if (!Number.isSafeInteger(article.revision) || article.revision < 1) throw new Error('Positive article revision required');
  return [...new Set(channels)].map(channel => {
    if (!['facebook', 'instagram'].includes(channel)) throw new Error('Unsupported channel');
    return { idempotencyKey: article.category + ':' + article.slug + ':' + channel + ':' + article.revision,
      channel, articleSlug: article.slug, articleUrl: expected, status: 'pending_review' };
  });
}
// Caller must provide an authenticated, server-side publishing adapter and independent URL verification.
// No live network calls, credentials or database operations occur in this module.
async function publishApprovedArticle(article, adapter) {
  if (!article || article.status !== 'approved' || !article.reviewed_by || !article.approved_at)
    throw new Error('Article must be approved');
  normalizeDraft(article);
  if (!adapter || typeof adapter.publish !== 'function' || typeof adapter.verifyPublicUrl !== 'function')
    throw new TypeError('Publishing and verification adapter required');
  const expectedUrl = buildArticleUrl(article);
  const published = await adapter.publish(article, expectedUrl);
  if (!published || published.url !== expectedUrl) throw new Error('Publisher did not confirm canonical URL');
  if (await adapter.verifyPublicUrl(expectedUrl) !== true)
    throw new Error('Published URL not confirmed publicly; do not distribute');
  return { ...article, status: 'published', publishedUrl: expectedUrl };
}
module.exports = { normalizeDraft, approveDraft, buildArticleUrl, publishApprovedArticle, makeSocialJobs };
