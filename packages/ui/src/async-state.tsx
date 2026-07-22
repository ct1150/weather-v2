// @wnr/ui — shared async-state primitives and accessible presenters.
//
// Implements the complete async-state contract from design.md
// ("Design system, accessibility, and complete states"): every asynchronous
// surface exposes Skeleton, Loading, Empty, Partial, Stale, Error, Offline,
// and Ready behavior with reduced-motion support (UX-STATE-001 / UX-A11Y-001 /
// UX-DESIGN-001 / UX-IA-001).
//
// The shared discriminated union keeps partial, stale, unavailable, and retry
// semantics explicit so Server-Component ViewModels can cross the rendering
// boundary safely. Retry is a serializable descriptor, never an embedded
// callback (design.md "Design system, accessibility, and complete states").

import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/** A serializable retry action descriptor (never a callback). */
export interface RetryAction {
  readonly action: "retry";
  readonly disabled: boolean;
  readonly attempt: number;
}

/** A serializable user action descriptor (navigate / reset / retry). */
export interface UiAction {
  readonly kind: "navigate" | "reset_filter" | "retry";
  readonly label: string;
  readonly href?: string;
}

/**
 * The complete async-state union (UX-STATE-001). Exactly one `kind` branch
 * is present. `T` is the trusted ready payload.
 */
export type AsyncState<T> =
  | { readonly kind: "skeleton"; readonly label: string }
  | { readonly kind: "loading"; readonly label: string; readonly previous?: T }
  | {
      readonly kind: "empty";
      readonly reason: "no-match" | "unavailable";
      readonly action?: UiAction;
    }
  | {
      readonly kind: "partial";
      readonly data: T;
      readonly unavailableFields: ReadonlyArray<string>;
    }
  | { readonly kind: "stale"; readonly data: T; readonly updatedAt: string }
  | { readonly kind: "error"; readonly code: string; readonly retry?: RetryAction }
  | { readonly kind: "offline"; readonly retained?: T }
  | { readonly kind: "ready"; readonly data: T };

export type AsyncStateKind = AsyncState<unknown>["kind"];

/** Localizable copy for the presenters (UX-I18N-001-friendly). */
export interface AsyncStateLabels {
  readonly loading?: string;
  readonly emptyNoMatch?: string;
  readonly emptyUnavailable?: string;
  readonly error?: (code: string) => string;
  readonly retry?: string;
  readonly stalePrefix?: string;
  readonly offlineRetained?: string;
  readonly offline?: string;
}

const DEFAULT_LABELS: AsyncStateLabels = Object.freeze({
  loading: "Loading…",
  emptyNoMatch: "No matching results.",
  emptyUnavailable: "This data is currently unavailable.",
  error: (code: string): string => `Something went wrong. Please try again later. (ref: ${code})`,
  retry: "Retry",
  stalePrefix: "Updated",
  offlineRetained: "You are offline. Showing saved content.",
  offline: "You are offline.",
});

function assertNever(value: never): never {
  throw new Error(`Unhandled async-state kind: ${JSON.stringify(value)}`);
}

function renderAction(action: UiAction): ReactNode {
  if (action.kind === "navigate" && action.href !== undefined) {
    return createElement(
      "a",
      {
        href: action.href,
        className:
          "rounded-pill border border-border px-4 py-2 text-label text-primary hover:bg-surface-elevated focus-ring",
      },
      action.label,
    );
  }
  if (action.kind === "retry") {
    return createElement(
      "button",
      {
        type: "button",
        "data-action": "retry",
        className:
          "rounded-pill border border-border px-4 py-2 text-label text-primary hover:bg-surface-elevated focus-ring motion-reduce:transition-none",
      },
      action.label,
    );
  }
  // reset_filter and any non-navigating action render as a button control.
  return createElement(
    "button",
    {
      type: "button",
      className:
        "rounded-pill border border-border px-4 py-2 text-label text-primary hover:bg-surface-elevated focus-ring motion-reduce:transition-none",
    },
    action.label,
  );
}

export interface AsyncStateRegionProps<T> {
  readonly state: AsyncState<T>;
  /** Project the trusted payload into primary content. */
  readonly render: (data: T) => ReactNode;
  readonly labels?: AsyncStateLabels;
  /** Accessible landmark label for the region (UX-IA-001). */
  readonly regionLabel?: string;
}

/**
 * Render any {@link AsyncState} with the complete a11y/reduced-motion contract.
 * The region is a labelled `<section>` landmark so heading/keyboard order and
 * information architecture stay stable across responsive layouts (UX-IA-001).
 */
export function AsyncStateRegion<T>(props: AsyncStateRegionProps<T>): JSX.Element {
  const labels: AsyncStateLabels = { ...DEFAULT_LABELS, ...(props.labels ?? {}) };
  const { state, render } = props;

  let content: ReactNode;
  switch (state.kind) {
    case "skeleton":
      // Geometry approximates final content and reserves space so the transition
      // to content does not create avoidable layout shift (UX-STATE-001).
      content = createElement(
        "div",
        {
          role: "status",
          "aria-busy": "true",
          "data-state": "skeleton",
          className:
            "min-h-[6rem] animate-pulse rounded-lg border border-border bg-surface-elevated motion-reduce:animate-none",
        },
        createElement("span", { className: "sr-only" }, state.label),
      );
      break;

    case "loading": {
      // An accessible status message that does NOT conceal already usable
      // trustworthy content when a previous payload exists (UX-STATE-001).
      const status = createElement(
        "div",
        {
          role: "status",
          "aria-live": "polite",
          "data-state": "loading",
          className: "text-body text-muted",
        },
        state.label,
      );
      content =
        state.previous !== undefined
          ? createElement(
              Fragment,
              null,
              createElement(
                "div",
                {
                  "data-state": "loading-previous",
                  "aria-hidden": "true",
                  className: "opacity-60",
                },
                render(state.previous),
              ),
              status,
            )
          : status;
      break;
    }

    case "empty": {
      const message =
        state.reason === "no-match"
          ? (labels.emptyNoMatch ?? "No matching results.")
          : (labels.emptyUnavailable ?? "This data is currently unavailable.");
      content = createElement(
        "div",
        {
          role: "status",
          "data-state": "empty",
          "data-reason": state.reason,
          className: "text-body text-muted",
        },
        createElement("p", null, message),
        state.action !== undefined ? renderAction(state.action) : null,
      );
      break;
    }

    case "partial":
      // Partial data names unavailable fields instead of inventing values.
      content = createElement(
        Fragment,
        null,
        createElement(
          "div",
          { "data-state": "partial", className: "text-body" },
          render(state.data),
        ),
        createElement(
          "p",
          { className: "text-caption text-warning" },
          `Some fields unavailable: ${state.unavailableFields.join(", ")}`,
        ),
      );
      break;

    case "stale":
      // Stale data stays visibly time-qualified everywhere it appears.
      content = createElement(
        Fragment,
        null,
        createElement("div", { "data-state": "stale", className: "text-body" }, render(state.data)),
        createElement(
          "p",
          { className: "text-caption text-warning" },
          `${labels.stalePrefix ?? "Updated"} ${state.updatedAt}`,
        ),
      );
      break;

    case "error": {
      // Error messages use a stable code, never a stack, credential, internal
      // provider message, or sensitive implementation detail (UX-STATE-001).
      const message = labels.error ? labels.error(state.code) : state.code;
      content = createElement(
        "div",
        {
          role: "alert",
          "data-state": "error",
          "data-error-code": state.code,
          className: "text-body text-danger",
        },
        createElement("p", null, message),
        state.retry !== undefined
          ? createElement(
              "button",
              {
                type: "button",
                "data-action": "retry",
                "data-attempt": String(state.retry.attempt),
                disabled: state.retry.disabled,
                "aria-disabled": state.retry.disabled,
                className:
                  "mt-2 rounded-pill border border-border px-4 py-2 text-label text-primary hover:bg-surface-elevated focus-ring motion-reduce:transition-none",
              },
              labels.retry ?? "Retry",
            )
          : null,
      );
      break;
    }

    case "offline":
      content =
        state.retained !== undefined
          ? createElement(
              Fragment,
              null,
              createElement(
                "div",
                { "data-state": "offline", className: "text-body" },
                render(state.retained),
              ),
              createElement(
                "p",
                { className: "text-caption text-muted" },
                labels.offlineRetained ?? "You are offline. Showing saved content.",
              ),
            )
          : createElement(
              "div",
              {
                role: "status",
                "data-state": "offline",
                className: "text-body text-muted",
              },
              labels.offline ?? "You are offline.",
            );
      break;

    case "ready":
      content = createElement(
        "div",
        { "data-state": "ready", className: "text-body" },
        render(state.data),
      );
      break;

    default:
      assertNever(state);
  }

  return createElement(
    "section",
    {
      "aria-label": props.regionLabel ?? "Async content",
      "data-async-region": "true",
      className: "w-full",
    },
    content,
  );
}

/** Narrowing helper: true when the state carries trusted renderable data. */
export function hasRenderableData<T>(state: AsyncState<T>): boolean {
  switch (state.kind) {
    case "partial":
    case "stale":
    case "ready":
      return true;
    case "offline":
      return state.retained !== undefined;
    default:
      return false;
  }
}
