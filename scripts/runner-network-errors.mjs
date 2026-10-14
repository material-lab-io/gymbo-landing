// Runner-side network faults (gy-18qle.1). These Chromium error names mean the
// machine running the check lost or changed its own network, not that
// getgymbo.com is broken. Keep this list small and explicit: every entry is a
// product failure we will stop reporting as one.
export const runnerNetworkErrors = ["net::ERR_NETWORK_CHANGED"];

export const isRunnerNetworkError = (text, extra = []) =>
  typeof text === "string" &&
  [...runnerNetworkErrors, ...extra].some((name) => text.includes(name));
