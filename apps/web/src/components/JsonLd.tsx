// apps/web/src/components/JsonLd.tsx
//
// Server-rendered JSON-LD injector (SEO-STRUCTURED-001). The schema is a
// plain object (built by the page from the baked view model) projected 1:1
// into a `<script type="application/ld+json">` tag. No client runtime is
// involved — the structured data is part of the static HTML.

import type { ReactElement } from "react";

export interface JsonLdProps {
  /** A schema.org node/object (e.g. TouristDestination / Place). */
  readonly schema: Record<string, unknown>;
}

export function JsonLd({ schema }: JsonLdProps): ReactElement {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default JsonLd;
