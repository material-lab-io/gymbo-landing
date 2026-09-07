#!/usr/bin/env node

// gy-p7edn — assert the CONTRACT that getgymbo.com's only alert path depends on.
//
// Nothing in this repository notifies anyone when prod-watch goes red. The
// alerting lives OUTSIDE it, in the Gas City `async-watchdog` cron order
// (custom-packs/gymbo-crew/orders/async-watchdog.toml), which addresses this
// workflow BY ITS DISPLAY NAME and tolerates a gap derived from its CRON:
//
//   SCHEDULED_FAILURE_WORKFLOWS = "...,Prod Watch@material-lab-io/gymbo-landing"
//   HEARTBEAT_WORKFLOWS         = "Prod Watch@material-lab-io/gymbo-landing:150"
//
// Both are plain strings in another repository. This repo can rename the
// workflow or slow its cron in one line, and nothing here would notice:
//
//   * RENAME  -> `gh run list --workflow "Prod Watch"` exits 1 and check6/check7
//     raise [WATCHDOG BLIND]. Fail-closed, but the surface is unwatched until a
//     human reads that page and edits the other repo.
//   * SLOWER CRON -> the 150-minute heartbeat tolerance is now shorter than one
//     scheduling interval, so check7 pages on every ordinary run. That gets
//     muted, and a muted heartbeat is the fail-open this whole bead is about.
//   * FASTER CRON -> the tolerance silently becomes several missed slots wide.
//
// So the assertion is deliberately narrow and exact: the two values the
// external watcher was configured against. Changing either is legitimate — it
// just is not a one-repo change, and this gate is what says so.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_NAME = 'Prod Watch';
const EXPECTED_CRON = '0 * * * *';
const WATCHER = 'custom-packs/gymbo-crew/orders/async-watchdog.toml (gascity repo)';

const workflowsDir = process.argv[2] ?? '.github/workflows';
const file = path.join(workflowsDir, 'prod-watch.yml');

let text;
try {
  text = await readFile(file, 'utf8');
} catch (error) {
  console.error(`::error::${file} is unreadable: ${error.message}. The external watcher in ${WATCHER} is configured against this workflow; if it was deleted or renamed, update SCHEDULED_FAILURE_WORKFLOWS and HEARTBEAT_WORKFLOWS in the same change.`);
  process.exit(1);
}

const lines = text.split(/\r?\n/);
const violations = [];

// Display name: the string `gh run list --workflow` is given, verbatim.
const nameLine = lines.find((line) => /^name:\s*/.test(line));
const name = nameLine ? nameLine.replace(/^name:\s*/, '').replace(/^["']|["']$/g, '').trim() : null;
if (name !== EXPECTED_NAME) {
  violations.push(
    `${file}: workflow display name is ${name === null ? '(absent)' : JSON.stringify(name)}, expected ${JSON.stringify(EXPECTED_NAME)}. ` +
    `check6/check7 address this surface by that exact string.`,
  );
}

// Cron: the cadence the 150-minute heartbeat tolerance was chosen against.
const crons = lines
  .map((line) => line.match(/^\s*-\s*cron:\s*(.*?)\s*(?:#.*)?$/))
  .filter(Boolean)
  .map((match) => match[1].trim().replace(/^["']|["']$/g, ''));
if (crons.length !== 1 || crons[0] !== EXPECTED_CRON) {
  violations.push(
    `${file}: schedule is ${crons.length ? JSON.stringify(crons) : '(none)'}, expected exactly one entry ${JSON.stringify(EXPECTED_CRON)}. ` +
    `HEARTBEAT_WORKFLOWS tolerates a 150-minute gap because this is hourly.`,
  );
}

if (violations.length > 0) {
  console.error('::error::prod-watch no longer matches the contract its EXTERNAL alerting is configured against.');
  for (const violation of violations) console.error(violation);
  console.error(`Update ${WATCHER} in the same change, or getgymbo.com goes unwatched (or the heartbeat becomes noise and gets muted).`);
  process.exit(1);
}

console.log(`OK: prod-watch.yml still matches the external watcher contract (name ${JSON.stringify(EXPECTED_NAME)}, cron ${JSON.stringify(EXPECTED_CRON)}).`);
