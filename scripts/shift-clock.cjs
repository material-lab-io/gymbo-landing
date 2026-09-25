// gy-jbax2: shift the JS wall clock forward for EVERY node process of a build, to expose output
// that depends on the date. Load with NODE_OPTIONS="--require <this file>"; the offset is
// GYMBO_SHIFT_DAYS (default 400, more than a year so a year- or month-boundary fuse is caught,
// not only a day boundary). It overrides `new Date()` and `Date.now()`; it does NOT move the
// system clock, so a shell `date`, `git log` or `performance.now()` is not shifted (named limit).
const days = Number(process.env.GYMBO_SHIFT_DAYS || 400);
if (!Number.isFinite(days)) throw new Error(`GYMBO_SHIFT_DAYS is not a number: ${process.env.GYMBO_SHIFT_DAYS}`);
const OFFSET = days * 86400 * 1000;
const RealDate = Date;
class ShiftedDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + OFFSET); else super(...a); }
  static now() { return RealDate.now() + OFFSET; }
}
global.Date = ShiftedDate;
