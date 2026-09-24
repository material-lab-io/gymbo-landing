// gy-o0ent: ONE normaliser for every gate that MATCHES copy. Before this, canonical-terms and
// trial-eligibility each carried a private four-line normalise that decoded only &nbsp; &amp;
// &quot; &apos; and a numeric &#27;, and copy-blocks.decodeEntities left the named invisible
// entities (&shy; &zwj; &zwnj; &ZeroWidthSpace;) as literal text. So "AI-po&shy;wered", a raw
// soft hyphen, a zero-width space and the Cyrillic look-alikes all walked past both gates
// (measured on origin/main 65536cb7: 0 of 9 forms caught).
//
// Split of duties, deliberately: copy-blocks.decodeEntities DECODES faithfully (so the change
// detector still PINS the real character and sees an inserted invisible), and this module
// FOLDS for matching (strips invisibles, maps look-alikes), which a pin must never do.
import { decodeEntities } from "./copy-blocks.mjs";

// U+00AD soft hyphen, U+200B-U+200F zero-width space/non-joiner/joiner/LRM/RLM, U+2060 word
// joiner, U+FEFF BOM. Written as escapes so this file cannot itself hide one.
export const INVISIBLES = /[­​-‏⁠﻿]/g;
// Cyrillic letters that render as Latin ones. The site is English, so nothing legitimate is lost.
const HOMOGLYPHS = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", "ј": "j" };

export function matchable(value) {
  return decodeEntities(value)
    .normalize("NFKC")
    .replace(INVISIBLES, "")
    .replace(/[аеорсхуіј]/g, (c) => HOMOGLYPHS[c])
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ");
}
