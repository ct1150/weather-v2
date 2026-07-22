// apps/web — Next.js App Router application (UI + read APIs).
//
// Dependency boundary (Requirement 9.2): this app depends on domain, db, ui,
// i18n, seo, config, and analytics — but NEVER on @wnr/weather. Because the
// provider package is not importable here, a user-path provider call cannot
// compile. The Next.js runtime, App Router routes, and Cloudflare adapter are
// wired in task 23.1; this barrel keeps the scaffold building and typechecking.
export {};
