import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * gy-w77x3 B5 -- ONE capture overlay open at a time, owned in ONE place.
 *
 * designer's FAIL at 971ade6a1: with the sticky panel open, the nav
 * "Request access" (visible the whole time) opened a SECOND form over the
 * first. That meant two forms and two identical submits, with the page covered.
 * Each InlineWaitlist owned its own `revealed`, and nothing coordinated them.
 *
 * The ruling is a shared owner, not two components watching each other: a
 * pair of effects that close "the other one" on change can each fire the
 * other and race. Here there is one value, so "both open" cannot be
 * represented. Opening an overlay REPLACES whichever one was open.
 *
 * Only the OVERLAY panels (nav, sticky) take part. Inline panels (hero,
 * gallery, pricing) scroll away with the page, cover nothing, and keep their
 * own local state.
 */
export type OverlayId = "nav" | "sticky";

export type WaitlistOverlayOwner = {
  open: OverlayId | null;
  setOpen: (next: OverlayId | null | ((cur: OverlayId | null) => OverlayId | null)) => void;
};

const WaitlistOverlayContext = createContext<WaitlistOverlayOwner | null>(null);

export function WaitlistOverlayProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OverlayId | null>(null);
  return <WaitlistOverlayContext.Provider value={{ open, setOpen }}>{children}</WaitlistOverlayContext.Provider>;
}

/** Null outside a provider; InlineWaitlist then falls back to its own state. */
export function useWaitlistOverlayOwner(): WaitlistOverlayOwner | null {
  return useContext(WaitlistOverlayContext);
}
