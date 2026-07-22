// apps/web/src/app/not-found.tsx
//
// Static 404 surface for the static export. Reached when a country/city slug
// does not exist in the baked seed (the route calls `notFound()`).

import "./globals.css";

export default function NotFound(): React.ReactNode {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2">
        We couldn’t find that destination. <a href="/">Back to recommendations</a>.
      </p>
    </main>
  );
}
