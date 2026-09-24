// gy-uu7mt: build canonical-log-verb-rulings.json, the offline-checkable snapshot that lets
// check-log-verb.mjs prove a registry ruling RESOLVES to a real bead comment. Needs `bd`
// (CI runners have none), so it runs where bd is available and its output is a reviewed diff.
//   node scripts/vendor-log-verb-rulings.mjs           rebuild the snapshot from the live beads
//   node scripts/vendor-log-verb-rulings.mjs --verify  re-check the committed snapshot against live bd
// It refuses (exit 1) a ruling whose comment does not exist, is on another bead, was not
// written by content or pm, or does not contain the quoted text. The snapshot stores the
// comment id, bead, author, time, a sha256 of the body and the verified quotes; never the body.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { REGISTRY_FILE, RULINGS_FILE, RULING_AUTHORS } from "./check-log-verb.mjs";

const ws = (s) => String(s).replace(/\s+/g, " ").trim();
const sha = (s) => createHash("sha256").update(s).digest("hex");
const args = process.argv.slice(2);
const verify = args.includes("--verify");

try {
  const registry = JSON.parse(readFileSync(REGISTRY_FILE, "utf8"));
  const wanted = new Map();   // comment id -> {bead, quotes:Set}
  for (const e of registry.entries) {
    const { bead, comment, quote } = e.ruling ?? {};
    if (!bead || !comment || !quote) throw new Error(`entry for ${e.route} "${String(e.sentence).slice(0, 50)}" has no {bead, comment, quote} ruling`);
    const w = wanted.get(comment) ?? { bead, quotes: new Set() };
    if (w.bead !== bead) throw new Error(`comment ${comment} cited under two beads (${w.bead}, ${bead})`);
    w.quotes.add(quote);
    wanted.set(comment, w);
  }
  const byBead = new Map();
  const commentsOf = (bead) => {
    if (!byBead.has(bead)) byBead.set(bead, JSON.parse(execFileSync("bd", ["comments", bead, "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })));
    return byBead.get(bead);
  };
  const rulings = {};
  const problems = [];
  for (const [id, { bead, quotes }] of [...wanted].sort()) {
    const c = commentsOf(bead).find((x) => x.id === id);
    if (!c) { problems.push(`${id}: no such comment on ${bead}`); continue; }
    if (!RULING_AUTHORS.includes(c.author)) problems.push(`${id}: written by ${c.author}, not ${RULING_AUTHORS.join(" or ")}`);
    for (const q of quotes) if (!ws(c.text).includes(ws(q))) problems.push(`${id}: quote not found in the comment: ${q.slice(0, 60)}`);
    rulings[id] = { bead, author: c.author, created_at: c.created_at, sha256: sha(c.text), quotes: [...quotes].sort() };
  }
  if (problems.length) { console.error(`FAIL: ${problems.length} unresolved ruling(s):\n  ${problems.join("\n  ")}`); process.exit(1); }
  const snapshot = { version: 1, note: "Built by scripts/vendor-log-verb-rulings.mjs from live bd. Do not hand-edit; re-run it and review the diff.", rulings };
  if (verify) {
    const committed = JSON.parse(readFileSync(RULINGS_FILE, "utf8"));
    if (JSON.stringify(committed.rulings) !== JSON.stringify(rulings)) { console.error("FAIL: the committed rulings snapshot differs from live bd (a comment changed or vanished, or the snapshot was hand-edited)."); process.exit(1); }
    console.log(`OK: ${Object.keys(rulings).length} ruling comment(s) re-verified against live bd (author, quote, sha256).`);
  } else {
    writeFileSync(RULINGS_FILE, JSON.stringify(snapshot, null, 1) + "\n");
    console.log(`wrote ${RULINGS_FILE}: ${Object.keys(rulings).length} ruling comment(s), every one verified against live bd.`);
  }
} catch (error) {
  console.error(`COULD NOT VERIFY rulings: ${error.message}`);
  process.exit(2);
}
