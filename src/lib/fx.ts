/**
 * gy-hzityw: the ONE place the USD->INR rate behind our competitor price copy lives.
 * Refreshing it is a one-line change here (plus the regenerated copy baseline); do not retype the rate
 * in a string. Rate: ECB reference, read 2026-10-29 (1 USD = 95.27 INR), rounded to 95 per content's
 * ruling. Pass the EXACT monthly USD rate read from the vendor page (TrueCoach Starter is 26.34, Standard
 * 57.99), not the rounded "$26" the copy shows: content's spec rounds the converted figure, not the dollars.
 * Converted figures round to the nearest 50 rupees and always read as approximate.
 */
export const USD_INR = 95;
export const FX_ASOF_DISPLAY = "29 Oct 2026";

/** USD per month -> rupees, nearest ₹50, comma-formatted ("2,200"). */
export function inrFromUsd(usd: number): string {
  return (Math.round((usd * USD_INR) / 50) * 50).toLocaleString("en-US");
}

/** The footnote tail that states the rate and its date. The only user-visible place the rate appears. */
export const FX_FOOTNOTE = `₹ at about ₹${USD_INR} to the US dollar, ECB reference rate, ${FX_ASOF_DISPLAY}, approximate`;
