import React from 'react';

/**
 * Renders JSON-LD Schema markup safely into the page head/body.
 * Sanitizes "<" to avoid potential XSS / script escaping issues.
 */
export function JsonLd({
  schema,
}: {
  schema: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  );
}
