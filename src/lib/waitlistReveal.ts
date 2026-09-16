// gy-becxi — the reveal CONTRACT, deliberately in a leaf module of its own.
//
// 🔴 WHY THIS IS NOT IN forge-ui.tsx OR IN InlineWaitlist.tsx. The CTA
// primitives live in forge-ui.tsx and the reveal panel renders <WaitlistForm>,
// which imports `F` back from forge-ui. Putting the context in either file
// makes forge-ui -> InlineWaitlist -> WaitlistForm -> forge-ui a real import
// cycle. ESM tolerates that at runtime until it does not: scripts/prerender.mjs
// evaluates these modules in Node, and a cycle there surfaces as an undefined
// binding at module-init time, which is a build-green/page-blank failure.
// A context with no imports of its own cannot participate in a cycle.
import { createContext, useContext } from "react";

/** Provided by <InlineWaitlist>; absent everywhere else, and that is meaningful. */
export type WaitlistRevealApi = {
  /** True once the visitor has asked for the capture at THIS cluster. */
  revealed: boolean;
  /** Reveal the capture in place. Idempotent — a second tap must not re-focus. */
  reveal: () => void;
};

export const WaitlistRevealContext = createContext<WaitlistRevealApi | null>(null);

/**
 * Returns the enclosing cluster's reveal api, or null when there is none.
 *
 * 🔴 NULL IS A SUPPORTED ANSWER AND THE CALLER MUST HANDLE IT. A waitlist CTA
 * outside any <InlineWaitlist> keeps its pre-gy-becxi scroll behaviour, so this
 * change is purely additive and cannot break a call site it did not touch.
 * The cost of that safety is that FORGETTING to wrap a cluster is silent — it
 * degrades to the exact defect this bead exists to remove.
 *
 * 🔴 CORRECTED 2026-09-12. This comment previously read "tests/inline-
 * waitlist.test.mjs pins the wrapped set by reading the sources, so the silence
 * is bounded by a control rather than by anyone's memory." THAT FILE NEVER
 * EXISTED. The claim was written alongside the intent and the control was never
 * built, so the silence this comment described as bounded was unbounded — and
 * the gallery cluster was in fact wrapped in code but pinned by no test.
 * The control now exists, in tests/inline-waitlist.spec.ts ("pinned as a set"),
 * and it reads the SERVED MARKUP rather than the sources: a source grep would
 * pass on a wrapper that renders but fails to provide this context.
 */
export function useWaitlistReveal(): WaitlistRevealApi | null {
  return useContext(WaitlistRevealContext);
}
