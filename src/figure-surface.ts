// The surface the approved pillar demo art was COMPOSED on (gy-0ho2lx). Each public/demos poster is an opaque 1080x1920 frame with its page colour baked
// into every pixel (light #FAFAF7, dark #0A0A0A) and the clips are MP4 (no alpha), so a band behind a figure must be exactly that colour or the frame
// shows as a box. These are NOT Forge tokens on purpose: set B moved the page to #FFF and the dark band to #000, and the art did not move. They change
// only when the art is re-exported (then delete them and use F.beige / F.charcoal). tests/figure-surface.test.mjs reads the corner pixel of every poster
// and fails if either value stops matching, so this cannot drift silently.
export const FIGURE_SURFACE = { light: "#FAFAF7", dark: "#0A0A0A" } as const;
