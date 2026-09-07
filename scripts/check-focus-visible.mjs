// gy-i665e — WCAG 2.4.11 / 1.4.11 focus-indicator measurement for the waitlist
// form, the site's only conversion control.
//
//   node scripts/check-focus-visible.mjs live  <label>   # measures getgymbo.com
//   node scripts/check-focus-visible.mjs local <label>   # measures ./dist
//
// Run it under xvfb-run: HEADED Chromium is required. Per gy-vfrha, headless
// does not reliably paint this class of styling, and a focus ring that fails to
// paint reads as "no indicator" — an instrument that cannot look reporting a
// finding (playbook rule 107).
//
// It presses Shift+Tab then Tab after focusing so the control is genuinely
// :focus-visible rather than merely :focus, and it PRINTS `:focus-visible=` so a
// reader can see the precondition was met. A run where that is false measured
// nothing.
//
// ⚠️ THIS IS NOT WIRED INTO CI. It is evidence tooling, not a gate — saying so
// here because a script sitting in scripts/ reads as protection it does not
// provide (playbook rule 58, built-but-unwired). Wiring is tracked separately.
//
// Known-good outputs, so a future reader can tell it still discriminates:
//   pre-fix  (live, f435e94): name/email "INDICATORS: NONE"; submit ring
//            rgb(245,158,11) = its own fill, 1.00:1 vs fill -> FAIL
//   post-fix (local):        inputs 16.11:1 vs fill / 17.32:1 vs section;
//            submit inner rgb(10,10,10) 9.22:1 vs fill, outer rgb(240,240,235)
//            17.32:1 vs section -> PASS
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const TARGET = process.argv[2];            // 'local' | 'live'
const LABEL  = process.argv[3] || TARGET;
const ROOT='/home/kanaba/gt/gymbo-landing/dist';
let srv=null, base;
if (TARGET==='local') {
  srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(ROOT,p);
   if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html'); if(!fs.existsSync(f))f=path.join(ROOT,'index.html');
   const t={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.txt':'text/plain','.json':'application/json'}[path.extname(f)]||'application/octet-stream';
   r.writeHead(200,{'Content-Type':t}); fs.createReadStream(f).pipe(r);});
  await new Promise(r=>srv.listen(4610,r)); base='http://localhost:4610/';
} else { base='https://getgymbo.com/'; }

const lin=c=>{c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
const L=([r,g,b])=>0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
const ratio=(a,b)=>{const la=L(a),lb=L(b);const[hi,lo]=la>lb?[la,lb]:[lb,la];return (hi+0.05)/(lo+0.05);};
const parse=s=>{const m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x.trim()));return{rgb:[p[0],p[1],p[2]],a:p.length>3?p[3]:1};};
const over=(f,b)=>f.rgb.map((c,i)=>c*f.a+b[i]*(1-f.a));

const b = await chromium.launch({ headless:false });   // HEADED (gy-vfrha)
const pg = await b.newPage({ viewport:{width:1280,height:900} });
await pg.goto(base,{waitUntil:'networkidle'});
const SECTION=[10,10,10];
const controls=[
  {name:'name input',  sel:'form input[name="name"]'},
  {name:'email input', sel:'form input[type="email"]'},
  {name:'submit',      sel:'form button[type="submit"]'},
];
console.log(`\n########## ${LABEL}  (${base})  headed=yes`);
for (const c of controls) {
  const el=pg.locator(c.sel).first();
  await el.scrollIntoViewIfNeeded();
  await el.evaluate(n=>n.focus());                       // programmatic focus
  await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Tab');  // make it :focus-visible
  await pg.waitForTimeout(350);
  const m = await el.evaluate(n=>{const cs=getComputedStyle(n);return{
    isFV: n.matches(':focus-visible'), fill: cs.backgroundColor,
    outlineStyle: cs.outlineStyle, outlineColor: cs.outlineColor, outlineWidth: cs.outlineWidth,
    outlineOffset: cs.outlineOffset, boxShadow: cs.boxShadow };});
  const fill = over(parse(m.fill), SECTION);
  const inds = [];
  if (m.outlineStyle!=='none' && parseFloat(m.outlineWidth)>0) {
    const oc=parse(m.outlineColor);
    if (oc && oc.a>0) inds.push({what:`outline ${m.outlineWidth} ${m.outlineColor}`, rgb: over(oc, SECTION)});
  }
  if (m.boxShadow && m.boxShadow!=='none') {
    for (const seg of m.boxShadow.split(/,(?![^(]*\))/)) {
      const sc=parse(seg); if (sc && sc.a>0) inds.push({what:`shadow-ring ${seg.trim().slice(0,60)}`, rgb: over(sc, SECTION)});
    }
  }
  console.log(`\n-- ${c.name}   :focus-visible=${m.isFV}   fill=rgb(${fill.map(Math.round)})`);
  console.log(`   outline: ${m.outlineStyle} ${m.outlineWidth} ${m.outlineColor} offset=${m.outlineOffset}`);
  console.log(`   box-shadow: ${m.boxShadow}`);
  if (!inds.length) { console.log(`   INDICATORS: NONE  -> FAIL (no visible focus indicator at all)`); }
  else {
    let bestFill=0,bestSec=0;
    for (const i of inds) {
      const rf=ratio(i.rgb,fill), rs=ratio(i.rgb,SECTION);
      bestFill=Math.max(bestFill,rf); bestSec=Math.max(bestSec,rs);
      console.log(`   ${i.what}\n     rgb(${i.rgb.map(Math.round)})  vs fill ${rf.toFixed(2)}:1   vs section ${rs.toFixed(2)}:1`);
    }
    console.log(`   VERDICT: best-vs-fill ${bestFill.toFixed(2)}:1, best-vs-section ${bestSec.toFixed(2)}:1 -> ${(bestFill>=3&&bestSec>=3)?'PASS':'FAIL'}`);
  }
  await el.screenshot({path:`evidence/gy-i665e-${LABEL}-${c.name.replace(/\W+/g,'-')}.png`}).catch(()=>{});
}
await b.close(); if(srv) srv.close();
