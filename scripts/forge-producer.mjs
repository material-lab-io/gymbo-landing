/**
 * Shared resolver for the Forge producer (gy-1phkc).
 *
 * Three gates ask about the producer — sync-forge-tokens.mjs,
 * check-forge-pin-fresh.mjs and check-forge-tokens.mjs — and they MUST agree on
 * what "the producer" means, or they can disagree with each other and a green
 * from one stops meaning anything about the others. That is the shape of the
 * bug this bead exists for, so it is worth one shared module rather than three
 * copies of the same resolution logic.
 *
 * 🔴 THE INVARIANT: producer bytes are read AT THE PINNED SHA via `git show`,
 * never off the producer's working tree. A CI checkout sits at the default
 * branch, which is usually AHEAD of the pin; reading the worktree would mean the
 * token table came from one commit while src/forge/ was generated from another,
 * and every file's provenance header would be quietly wrong. Reading at the pin
 * makes the header true by construction.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const ROOT = new URL('..', import.meta.url).pathname;
export const VENDORED = join(ROOT, 'src/forge');
export const PIN = JSON.parse(readFileSync(join(VENDORED, 'forge.pin.json'), 'utf8'));
export const FILES = ['forge.css', 'forge.dark.css', 'forge.hc.css'];

/** A producer git checkout, or null when none is reachable. */
export function producerDir() {
  for (const c of [
    process.env.FORGE_PRODUCER_DIR,
    join(ROOT, '../gymbo'),
    join(ROOT, '../Gymbo-v1'),
  ]) {
    if (c && existsSync(join(c, '.git'))) return c;
  }
  return null;
}

/**
 * Read one producer file at the pinned commit. Returns null when it cannot be
 * read — callers must treat that as UNKNOWN, never as "unchanged".
 */
export function readAtPin(dir, file, sha = PIN.sha) {
  try {
    return execFileSync('git', ['-C', dir, 'show', `${sha}:${PIN.path}/${file}`], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

/** Parse `--g-*` declarations into name -> value. First declaration wins. */
export function tokensOf(css) {
  const m = new Map();
  if (!css) return m;
  for (const x of css.matchAll(/^\s*(--g-[a-z0-9-]+)\s*:\s*([^;]+);/gm))
    if (!m.has(x[1])) m.set(x[1], x[2].trim());
  return m;
}
