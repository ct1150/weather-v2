// Redirect shim for the `node:sqlite` built-in.
//
// Vite's SSR module runner (used by Vitest 2.x) mishandles the newer `node:sqlite`
// id: it strips the `node:` prefix and tries to load `sqlite` as a URL, which fails.
// Redirecting the import to this local shim lets Vite transform a normal file, while the
// built-in is loaded at runtime via `require("node:sqlite")` (a native Node resolution that
// Vite never inspects). `node:module` is a long-standing builtin Vite externalizes correctly.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sqlite = require("node:sqlite");

export const DatabaseSync = sqlite.DatabaseSync;
