import type { StackCategory } from './detect.js';

export interface Signature {
  tool: string;
  category: StackCategory;
  regex: RegExp;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * A CMS is often reported out-of-band (a parsed `generator` meta, a crawler
 * field) rather than by a signature embedded in the body — so we map those
 * values straight to a tool.
 */
export const CMS_TOOL_MAP: Record<string, string> = {
  wordpress: 'wordpress',
  wix: 'wix',
  squarespace: 'squarespace',
  webflow: 'webflow',
  weebly: 'weebly',
  joomla: 'joomla',
  drupal: 'drupal',
  shopify: 'shopify',
  ghost: 'ghost',
};

/**
 * Host- and marker-based signatures. Host signatures (a request to a vendor's
 * CDN or API) are high confidence — you don't load `js.stripe.com` by accident.
 * Bare product-name mentions are medium: they show up in copy and blog posts as
 * often as in an actual integration.
 */
export const SIGNATURES: Signature[] = [
  // Analytics
  { tool: 'google-analytics', category: 'analytics', regex: /google-analytics\.com|googletagmanager\.com\/gtag|gtag\(\s*['"]config/i, confidence: 'high' },
  { tool: 'segment', category: 'analytics', regex: /cdn\.segment\.(?:com|io)\/analytics\.js/i, confidence: 'high' },
  { tool: 'plausible', category: 'analytics', regex: /plausible\.io\/js\/(?:script|plausible)/i, confidence: 'high' },
  { tool: 'matomo', category: 'analytics', regex: /matomo\.js|piwik\.js/i, confidence: 'high' },
  { tool: 'hotjar', category: 'analytics', regex: /static\.hotjar\.com|hjSetting/i, confidence: 'high' },
  { tool: 'mixpanel', category: 'analytics', regex: /cdn\.mxpanel\.com|api\.mixpanel\.com/i, confidence: 'high' },
  { tool: 'amplitude', category: 'analytics', regex: /cdn\.amplitude\.com|api\.amplitude\.com/i, confidence: 'high' },
  { tool: 'microsoft-clarity', category: 'analytics', regex: /clarity\.ms\/tag/i, confidence: 'high' },
  { tool: 'fathom', category: 'analytics', regex: /cdn\.usefathom\.com/i, confidence: 'high' },

  // Tag managers
  { tool: 'google-tag-manager', category: 'tag-manager', regex: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/i, confidence: 'high' },

  // Support / chat
  { tool: 'intercom', category: 'support', regex: /widget\.intercom\.io|intercomcdn\.com/i, confidence: 'high' },
  { tool: 'zendesk', category: 'support', regex: /static\.zdassets\.com|zendesk\.com\/embeddable/i, confidence: 'high' },
  { tool: 'crisp', category: 'support', regex: /client\.crisp\.chat/i, confidence: 'high' },
  { tool: 'drift', category: 'support', regex: /js\.driftt\.com/i, confidence: 'high' },
  { tool: 'tawk', category: 'support', regex: /embed\.tawk\.to/i, confidence: 'high' },

  // Marketing / CRM
  { tool: 'hubspot', category: 'marketing', regex: /js\.hs-scripts\.com|hs-analytics\.net/i, confidence: 'high' },
  { tool: 'mailchimp', category: 'marketing', regex: /list-manage\.com|chimpstatic\.com/i, confidence: 'high' },

  // Payments
  { tool: 'stripe', category: 'payments', regex: /js\.stripe\.com/i, confidence: 'high' },
  { tool: 'paypal', category: 'payments', regex: /paypal\.com\/sdk\/js|paypalobjects\.com/i, confidence: 'high' },
  { tool: 'braintree', category: 'payments', regex: /js\.braintreegateway\.com/i, confidence: 'high' },
  { tool: 'square', category: 'payments', regex: /(?:web|js)\.squarecdn\.com|squareup\.com\/v2/i, confidence: 'high' },

  // Forms
  { tool: 'typeform', category: 'forms', regex: /embed\.typeform\.com|typeform\.com\/to\//i, confidence: 'high' },
  { tool: 'jotform', category: 'forms', regex: /(?:form|cdn)\.jotform\.com/i, confidence: 'high' },
  { tool: 'google-forms', category: 'forms', regex: /docs\.google\.com\/forms/i, confidence: 'high' },

  // Video
  { tool: 'youtube', category: 'video', regex: /youtube(?:-nocookie)?\.com\/embed|youtu\.be\//i, confidence: 'high' },
  { tool: 'vimeo', category: 'video', regex: /player\.vimeo\.com\/video/i, confidence: 'high' },
  { tool: 'wistia', category: 'video', regex: /fast\.wistia\.(?:com|net)/i, confidence: 'high' },

  // Error monitoring
  { tool: 'sentry', category: 'error-monitoring', regex: /browser\.sentry-cdn\.com|@sentry\/browser|js\.sentry-cdn\.com/i, confidence: 'high' },
  { tool: 'bugsnag', category: 'error-monitoring', regex: /d2wy8f7a9ursnm\.cloudfront\.net\/.*bugsnag|bugsnag/i, confidence: 'medium' },

  // CDN / hosting (from response headers as much as body)
  { tool: 'cloudflare', category: 'cdn', regex: /\bcf-ray\b|__cf_bm|cloudflareinsights\.com/i, confidence: 'high' },
  { tool: 'vercel', category: 'cdn', regex: /\bx-vercel-id\b|\.vercel\.app|vercel-insights\.com/i, confidence: 'high' },
  { tool: 'netlify', category: 'cdn', regex: /\bx-nf-request-id\b|\.netlify\.app/i, confidence: 'high' },
  { tool: 'fastly', category: 'cdn', regex: /\bx-served-by:\s*cache|fastly/i, confidence: 'medium' },

  // E-commerce
  { tool: 'shopify', category: 'ecommerce', regex: /cdn\.shopify\.com|myshopify\.com/i, confidence: 'high' },
  { tool: 'woocommerce', category: 'ecommerce', regex: /woocommerce(?:\.min)?\.(?:js|css)|wc-blocks/i, confidence: 'high' },
  { tool: 'bigcommerce', category: 'ecommerce', regex: /bigcommerce\.com/i, confidence: 'medium' },

  // CMS / site builders
  { tool: 'wordpress', category: 'cms', regex: /wp-content|wp-includes|content=["']WordPress/i, confidence: 'high' },
  { tool: 'wix', category: 'cms', regex: /wix\.com|parastorage\.com/i, confidence: 'high' },
  { tool: 'squarespace', category: 'cms', regex: /squarespace(?:-cdn)?\.com/i, confidence: 'high' },
  { tool: 'webflow', category: 'cms', regex: /assets\.website-files\.com|webflow\.(?:io|com)/i, confidence: 'high' },
  { tool: 'weebly', category: 'cms', regex: /weebly\.com|editmysite\.com/i, confidence: 'high' },
  { tool: 'ghost', category: 'cms', regex: /content=["']Ghost|ghost\.io/i, confidence: 'medium' },

  // Booking / scheduling
  { tool: 'calendly', category: 'booking', regex: /calendly\.com\/[\w-]+/i, confidence: 'high' },
  { tool: 'acuity', category: 'booking', regex: /acuityscheduling\.com/i, confidence: 'high' },
  { tool: 'cal-com', category: 'booking', regex: /\bcal\.com\/[\w-]+|app\.cal\.com/i, confidence: 'high' },
  { tool: 'setmore', category: 'booking', regex: /setmore\.com/i, confidence: 'high' },
  { tool: 'simplybook', category: 'booking', regex: /simplybook\.(?:me|it)/i, confidence: 'high' },
  { tool: 'fresha', category: 'booking', regex: /fresha\.com/i, confidence: 'high' },

  // Practice management (EHR)
  { tool: 'simplepractice', category: 'ehr', regex: /simplepractice\.com/i, confidence: 'high' },
  { tool: 'therapynotes', category: 'ehr', regex: /therapynotes\.com/i, confidence: 'high' },
];
