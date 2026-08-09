'use client';

import { useEffect, useRef, useState } from 'react';
import type { LandingPage } from '@/types';

export function CodeIAPage({ page }: { page: LandingPage }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(800);

  // VG40.4: Sanitize HTML — strip <form>, <input>, <button type="submit"> to prevent
  // duplicate forms. The native <CodForm> is the only functional order form.
  // Also substitute {{CTA_LINK_N}} placeholders with #order-form for smooth scroll.
  const sanitizedHtml = (page.htmlContent || '<p>Aucun contenu HTML.</p>')
    .replace(/<form[\s\S]*?<\/form>/gi, '<!-- form removed: native CodForm active -->')
    .replace(/<input[^>]*>/gi, '<!-- input removed: native CodForm active -->')
    .replace(/(<button[^>]*?)\s+type=["']submit["']([^>]*?>)/gi, '$1$2')
    .replace(/\{\{CTA_LINK_\d+\}\}/g, '#order-form');

  // Build the srcdoc content: inject Tailwind CDN + the sanitized IA code
  const srcDoc = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>*{margin:0;padding:0;box-sizing:border-box;}</style>
</head>
<body>
${sanitizedHtml}
<script>
  // Auto-resize: send height to parent via postMessage
  function sendHeight() {
    var h = document.body.scrollHeight;
    window.parent.postMessage({ type: 'lp-iframe-height', height: h }, '*');
  }
  window.addEventListener('load', sendHeight);
  // Re-measure after images load
  document.querySelectorAll('img').forEach(function(img) {
    img.addEventListener('load', sendHeight);
  });
  // Also re-measure periodically for the first 3 seconds (dynamic content)
  var count = 0;
  var interval = setInterval(function() {
    sendHeight();
    if (++count > 15) clearInterval(interval);
  }, 200);
</script>
</body>
</html>`;

  // Listen for height updates from the iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'lp-iframe-height' && typeof e.data.height === 'number') {
        setIframeHeight(e.data.height);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="lp-code-wrapper">
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        title={page.title}
        className="lp-code-iframe"
        style={{ height: `${iframeHeight}px` }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
