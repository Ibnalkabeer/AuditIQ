import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const reaDir = path.join(projectRoot, 'rea-bundle');
const publicDir = path.join(projectRoot, 'public');
const assetsDir = path.join(publicDir, 'assets');

fs.mkdirSync(assetsDir, { recursive: true });

let js = fs.readFileSync(path.join(reaDir, 'index-BCMi3Rmg.js'), 'utf8');

function replaceExact(target, replacement, label) {
  if (!js.includes(target)) {
    throw new Error(`Patch target not found for: ${label}`);
  }
  js = js.replaceAll(target, replacement);
  console.log(`[OK] Applied patch: ${label}`);
}

// 1. BUG-01: RadioGroup (gs) and CheckboxGroup (vb) cards must suppress browser focus outline on unselected cards
replaceExact(
  'className:`border rounded-xl p-5 cursor-pointer transition-all duration-150 relative ${T?"border-[#3450FF] bg-[#3450FF]/5 ring-1 ring-[#3450FF]":"border-[#6B7280]/15 bg-white hover:border-[#6B7280]/30 hover:bg-[#F6F7F9]/30"}`,role:"radio"',
  'className:`outline-none border rounded-xl p-5 cursor-pointer transition-all duration-150 relative ${T?"border-[#3450FF] bg-[#3450FF]/5 ring-1 ring-[#3450FF] auditiq-card-selected":"border-[#6B7280]/15 bg-white hover:border-[#6B7280]/30 hover:bg-[#F6F7F9]/30 auditiq-card-unselected"}`,role:"radio"',
  'BUG-01a: RadioGroup outline-none & explicit state classes'
);

replaceExact(
  'className:`border rounded-xl p-5 cursor-pointer transition-all duration-150 relative ${C?"border-[#3450FF] bg-[#3450FF]/5 ring-1 ring-[#3450FF]":"border-[#6B7280]/15 bg-white hover:border-[#6B7280]/30 hover:bg-[#F6F7F9]/30"}`,role:"checkbox"',
  'className:`outline-none border rounded-xl p-5 cursor-pointer transition-all duration-150 relative ${C?"border-[#3450FF] bg-[#3450FF]/5 ring-1 ring-[#3450FF] auditiq-card-selected":"border-[#6B7280]/15 bg-white hover:border-[#6B7280]/30 hover:bg-[#F6F7F9]/30 auditiq-card-unselected"}`,role:"checkbox"',
  'BUG-01b: CheckboxGroup outline-none & explicit state classes'
);

replaceExact(
  'focus:ring-2 focus:ring-[#3450FF] focus:border-transparent',
  'focus-visible:ring-2 focus-visible:ring-[#3450FF]',
  'BUG-01c: Replace focus:ring-2 with focus-visible:ring-2 across form controls'
);

// 2. BUG-02: Scroll-to-top on every view or step change in Ib
replaceExact(
  'Vp(O,w)},[d,v]);',
  'window.scrollTo({top:0,behavior:"instant"}),Vp(O,w)},[d,v]);',
  'BUG-02: Scroll-to-top on view and assessment step transitions'
);

// 3. BUG-03: Sticky footer bottom clearance in zb + step progress pills in hb
replaceExact(
  'className:"flex-1 max-w-3xl w-full mx-auto px-6 py-10 md:py-14 flex flex-col justify-start"',
  'className:"flex-1 max-w-3xl w-full mx-auto px-6 pt-8 pb-24 md:pt-12 md:pb-28 flex flex-col justify-start"',
  'BUG-03a: Reserve bottom clearance above sticky footer in Assessment view'
);

replaceExact(
  'className:"border-t border-[#6B7280]/10 bg-white px-6 py-4 mt-12 sticky bottom-0 z-30 shadow-sm"',
  'className:"border-t border-[#6B7280]/15 bg-white/95 backdrop-blur-md px-6 py-4 mt-8 sticky bottom-0 z-30 shadow-lg auditiq-sticky-footer"',
  'BUG-03b: Elevate sticky assessment footer with backdrop blur'
);

// 4. BUG-04: Preserve server-returned auditId in Tt and display fallback v.auditId in Cb / Mb
replaceExact(
  'Me.success&&Me.data?(R(Me.data),T("report"),Gu("report_generated",{event_category:"report",audit_id:Ve,',
  'Me.success&&Me.data?(O(Me.auditId||Me.data.auditId||Ve),R(Object.assign({},Me.data,{auditId:Me.auditId||Me.data.auditId||Ve})),T("report"),Gu("report_generated",{event_category:"report",audit_id:Me.auditId||Me.data.auditId||Ve,',
  'BUG-04a: Preserve deterministic server auditId on report generation'
);

replaceExact(
  'children:j||"AUD-SYS"',
  'children:j||v.auditId||"AUD-SYS"',
  'BUG-04b: Fallback to report.auditId in Report Header & Print Cover'
);

// 5. BUG-05: Safe localStorage schema hydration in Xp
replaceExact(
  'const Z=localStorage.getItem("msl_audit_answers");return Z?JSON.parse(Z):qu',
  'const Z=localStorage.getItem("msl_audit_answers");if(!Z)return qu;const P=Object.assign({},qu,JSON.parse(Z));return Array.isArray(P.manualWorkflows)||(P.manualWorkflows=[]),Array.isArray(P.painPointRanking)&&P.painPointRanking.length||(P.painPointRanking=qu.painPointRanking),P',
  'BUG-05: Merge default answers schema and validate arrays on localStorage hydration'
);

// 6. BUG-06 & SEC-04: ImplementationModal syncs defaultPlan prop, adds Zenith Bank (2284107550) kickoff rail, and uses noopener,noreferrer
replaceExact(
  'const[u,B]=W.useState(j),[N,T]=W.useState(""),[C,R]=W.useState(""),[ne,O]=W.useState(""),[w,H]=W.useState("");if(!d)return null;',
  'const[u,B]=W.useState(j),[N,T]=W.useState(""),[C,R]=W.useState(""),[ne,O]=W.useState(""),[w,H]=W.useState("");W.useEffect(()=>{B(j)},[j,d]);if(!d)return null;',
  'BUG-06a: Sync ImplementationModal selectedPlan when defaultPlan prop or isOpen changes'
);

replaceExact(
  'window.open(`https://wa.me/2347079731073?text=${et}`,"_blank"),v()',
  'window.open(`https://wa.me/2347079731073?text=${et}`,"_blank","noopener,noreferrer"),v()',
  'SEC-04: Add noopener,noreferrer to window.open in ImplementationModal'
);

replaceExact(
  'n.jsx("span",{children:"Direct MSL AI Systems Developers"})]})]',
  'n.jsx("span",{children:"Direct MSL AI Systems Developers"})]}),n.jsxs("div",{className:"bg-[#F6F7F9] border border-[#6B7280]/15 rounded-xl p-3.5 text-[11px] text-[#4B5563] space-y-1",children:[n.jsx("span",{className:"font-mono font-bold text-[10px] uppercase tracking-wider text-[#14161B] block",children:"Official Sprint Kickoff Payment Rail"}),n.jsx("p",{children:"Zenith Bank • Account: 2284107550 • Name: Alonigbeja Muhsin (Share transfer receipt on WhatsApp for instant sprint kickoff)."})]})]',
  'BUG-06b: Include official Zenith Bank (2284107550 — Alonigbeja Muhsin) kickoff rail in ImplementationModal'
);

replaceExact(
  'https://portfolio-msl.lovable.app/',
  'https://msl-portfolio-ivory.vercel.app/',
  'BUG-06c: Update portfolio links from legacy Lovable URL to live Vercel portfolio'
);

fs.writeFileSync(path.join(assetsDir, 'app.js'), js, 'utf8');
fs.copyFileSync(path.join(reaDir, 'index-DCYmKqxW.css'), path.join(assetsDir, 'styles.css'));
console.log('[OK] Built public/assets/app.js and public/assets/styles.css');
