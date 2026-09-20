#!/usr/bin/env bash
# gy-8g9ov AC1 — refuse a tracked symlink whose target ESCAPES the repository.
#
# WHY THIS EXISTS. gymbo-landing commit 02699b3f put `node_modules ->
# ../site/node_modules` (mode 120000) on main. It rode in on a PR whose message
# described a two-file change, so the third path was invisible to every reader.
# It survived three merges. Every fresh clone got a dangling symlink where
# node_modules belongs, because the target exists only inside one agent's
# workspace.
#
# 🔴 NOTHING IN CI COULD SEE IT, AND THAT IS THE ACTUAL FINDING. A tracked
# symlink pointing outside the repo produces no failing check, no lint error and
# no review signal. Deploys kept passing -- which is precisely WHY it survived.
# It fails later on somebody else's machine and presents as "the clone is
# broken", not as a commit anyone would think to look at.
#
# ROOT CAUSE, worth stating because it is not obvious: `node_modules/` in
# .gitignore, WITH A TRAILING SLASH, matches only a DIRECTORY. A symlink named
# node_modules is not a directory, so the pattern never applied. The repo looked
# protected and was not -- for exactly the case that arises whenever someone
# links a shared install into a git worktree to run a suite.
#
# WHAT THIS REFUSES, and what it deliberately does not: an IN-REPO symlink is
# legitimate and common, so it passes. Only a target that escapes the repository
# root fails, because that is the one that cannot survive a clone. A dangling
# in-repo link is a different (and louder) problem, not this one.
set -uo pipefail

REF="${1:-}"            # optional: a commit/tree to inspect instead of the index
ROOT="$(git rev-parse --show-toplevel)"
fail=0

if [ -n "$REF" ]; then
  LIST="$(git ls-tree -r "$REF" | awk '$1 == "120000" { $1=""; $2=""; $3=""; sub(/^[ \t]+/, ""); print }')"
  read_target() { git cat-file blob "$REF:$1"; }   # a symlink blob IS its target
else
  LIST="$(git ls-files -s | awk '$1 == "120000" { $1=""; $2=""; $3=""; sub(/^[ \t]+/, ""); print }')"
  read_target() { git cat-file blob ":$1"; }
fi

if [ -z "$LIST" ]; then
  echo "OK: no tracked symlinks at all."
  exit 0
fi

# Report every tracked symlink, not only the failing ones -- a sweep that prints
# only hits cannot be told apart from a sweep that did not run.
while IFS= read -r path; do
  [ -z "$path" ] && continue
  target="$(read_target "$path")"
  # Resolve the target RELATIVE TO THE LINK'S OWN DIRECTORY, which is how a
  # symlink actually resolves. Doing it from the repo root instead would clear
  # a link that really does escape.
  dir="$(dirname "$path")"
  resolved="$(cd "$ROOT/$dir" 2>/dev/null && realpath -m "$target" 2>/dev/null)"
  case "$resolved" in
    "$ROOT"|"$ROOT"/*)
      echo "ok      $path -> $target  (stays inside the repo)" ;;
    *)
      echo "🔴 FAIL $path -> $target"
      echo "        resolves to $resolved, OUTSIDE $ROOT."
      echo "        This cannot survive a clone: the target exists only on the machine"
      echo "        that committed it. Every other clone gets a dangling symlink here."
      echo "        If you linked a shared install into a worktree, unlink it and make"
      echo "        sure .gitignore covers the SLASHLESS form too -- 'name/' with a"
      echo "        trailing slash matches a directory only, never a symlink."
      fail=1 ;;
  esac
done <<< "$LIST"

[ "$fail" -eq 0 ] && echo "OK: every tracked symlink stays inside the repo."
exit "$fail"
