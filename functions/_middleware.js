// gy-4rlx9l / gy-xndr3x (Search Console, 26 Nov 2026): two indexing fixes that Pages' static files cannot do.
//  1 www.getgymbo.com served a second copy of every page. The www rule in public/_redirects never fired: Pages ignores
//    host rules there. 301 to the apex with the same path and query (308 for other methods, so a POST keeps its body).
//  2 /404 answered 200 (a soft 404 with no canonical). It now answers 404 with noindex; the page itself is unchanged.
// Everything else passes through untouched, including preview hosts (*.pages.dev). public/_routes.json keeps the heavy
// static directories out of this function.
const APEX = "getgymbo.com";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === `www.${APEX}`) {
    const { method } = context.request;
    const to = `https://${APEX}${url.pathname}${url.search}`;
    return new Response(null, { status: method === "GET" || method === "HEAD" ? 301 : 308, headers: { Location: to } });
  }
  if (url.pathname === "/404") {
    const res = await context.next();
    if (res.status !== 200) return res;
    const headers = new Headers(res.headers);
    headers.set("X-Robots-Tag", "noindex");
    return new Response(res.body, { status: 404, headers });
  }
  return context.next();
}
