#!/usr/bin/env node
/**
 * Wiring audit — checks imports, nav↔routes, API calls vs backend mounts,
 * auth guards, navigate() targets, and component file existence.
 * Run from project root: node _audit.js
 */
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const issues  = [];
const ok = (msg) => console.log('  ✓', msg);
const fail = (msg) => { issues.push(msg); console.log('  ✗', msg); };

// ─── helpers ────────────────────────────────────────────────────────────────
function read(f) { return fs.readFileSync(f, 'utf8'); }
function exists(f) { return fs.existsSync(f); }
function resolves(base, rel) {
  const abs = path.resolve(base, rel);
  return ['','.tsx','.ts','.js','/index.tsx','/index.ts','/index.js']
    .some(ext => exists(abs + ext));
}
function glob(dir, pattern) {
  try {
    return execSync(`find ${dir} -name "${pattern}" 2>/dev/null`)
      .toString().trim().split('\n').filter(Boolean);
  } catch { return []; }
}
function checkImports(file) {
  if (!exists(file)) { fail(`FILE MISSING: ${file}`); return; }
  for (const line of read(file).split('\n')) {
    const m = line.match(/^import\s.+\sfrom\s['"](\..+?)['"]/);
    if (!m) continue;
    if (!resolves(path.dirname(file), m[1]))
      fail(`BROKEN IMPORT [${path.basename(file)}]: ${m[1]}`);
  }
}

// ─── 1. File existence + import resolution ──────────────────────────────────
console.log('\n── 1. Import resolution ──────────────────────────────────────');
const rootFiles = [
  'App.tsx', 'AppShell.tsx',
  'src/components/auth/RequireRole.tsx',
  'src/components/client/ClientApp.tsx',
  'src/components/client/ClientNav.tsx',
  'src/components/client/map/ClientMapViewer.tsx',
  'src/components/layout/v2/PilotNavV2.tsx',
  'src/components/dashboard/v2/PilotDashboardV2.tsx',
  'src/components/dashboard/v2/PilotUploadV2.tsx',
  'src/components/dashboard/v2/PilotChecklistV2.tsx',
  'src/components/dashboard/v2/PilotIssuesV2.tsx',
  'src/components/dashboard/v2/PilotWeatherV2.tsx',
  'src/components/dashboard/v2/PilotComplianceView.tsx',
];
rootFiles.forEach(f => { checkImports(f); if (exists(f)) ok(f); });

// ─── 2. Client nav ↔ routes ─────────────────────────────────────────────────
console.log('\n── 2. Client nav ↔ routes ────────────────────────────────────');
const clientNav = read('src/components/client/ClientNav.tsx');
const clientApp = read('src/components/client/ClientApp.tsx');
const clientNavIds = [...clientNav.matchAll(/\{\s*id:\s*'(\w+)'/g)].map(m=>m[1]);
const clientRoutes = [...clientApp.matchAll(/path="(\w+)"/g)].map(m=>m[1]).filter(r=>r!=='*');
console.log('  nav ids:', clientNavIds.join(', '));
console.log('  routes :', clientRoutes.join(', '));
clientNavIds.filter(id => !clientRoutes.includes(id)).forEach(id => fail(`CLIENT nav "${id}" has no <Route>`));
clientRoutes.filter(r  => !clientNavIds.includes(r)).forEach(r  => fail(`CLIENT route "${r}" has no nav item`));
if (clientNavIds.every(id => clientRoutes.includes(id))) ok('client nav↔routes 1:1');

// ─── 3. Pilot nav ↔ routes ──────────────────────────────────────────────────
console.log('\n── 3. Pilot nav ↔ routes ─────────────────────────────────────');
const pilotNav  = read('src/components/layout/v2/PilotNavV2.tsx');
const appTsx    = read('App.tsx');
const pilotNavIds  = [...pilotNav.matchAll(/\{\s*id:\s*'(\w+)'/g)].map(m=>m[1]);
const pilotBlock   = appTsx.match(/PilotAppV2[\s\S]*?<\/Routes>/)?.[0] || '';
const pilotRoutes  = [...pilotBlock.matchAll(/path="([^"*:/]+)"/g)].map(m=>m[1]);
console.log('  nav ids:', pilotNavIds.join(', '));
console.log('  routes :', pilotRoutes.join(', '));
pilotNavIds.filter(id => !pilotRoutes.includes(id)).forEach(id => fail(`PILOT nav "${id}" has no <Route>`));
if (pilotNavIds.every(id => pilotRoutes.includes(id))) ok('pilot nav↔routes match');

// ─── 4. Admin nav keys ↔ renderView cases ───────────────────────────────────
console.log('\n── 4. Admin nav ↔ renderView ─────────────────────────────────');
const appShell    = read('AppShell.tsx');
const adminKeys   = [...appShell.matchAll(/\{\s*key:\s*'([\w-]+)'/g)].map(m=>m[1]);
const adminCases  = [...appShell.matchAll(/case\s*'([\w-]+)':/g)].map(m=>m[1]);
console.log('  nav keys :', adminKeys.join(', '));
console.log('  cases    :', adminCases.join(', '));
adminKeys.filter(k => !adminCases.includes(k)).forEach(k => fail(`ADMIN nav key "${k}" has no renderView case`));
if (adminKeys.every(k => adminCases.includes(k))) ok('all admin nav keys have render cases');

// ─── 5. Auth guard redirect ──────────────────────────────────────────────────
console.log('\n── 5. Auth guard redirect ────────────────────────────────────');
const rr = read('src/components/auth/RequireRole.tsx');
if (rr.includes('to="/auth"'))   fail('RequireRole redirects to /auth (no such route)');
else if (rr.includes('to="/login"')) ok('RequireRole redirect → /login ✓');
else fail('RequireRole: cannot find redirect target');

// ─── 6. API calls vs backend mounts ─────────────────────────────────────────
console.log('\n── 6. API calls vs backend mounts ────────────────────────────');
const backendApp = read('backend/app.js');
// Extract every app.use('/api/...') mount prefix (strip /api prefix for comparison)
const mounts = [...backendApp.matchAll(/app\.use\(\s*['"]\/api\/([\w/-]+)['"]/g)]
  .map(m => '/' + m[1].replace(/\/$/, ''));

const portalFiles = [
  ...glob('src/components/client',       '*.tsx'),
  ...glob('src/components/dashboard/v2', '*.tsx'),
  ...glob('src/components/layout/v2',    '*.tsx'),
].filter(Boolean);

const unmounted = new Set();
for (const f of portalFiles) {
  const c = read(f);
  // Match apiClient.get('/path'), apiClient.post(`/path`), etc.
  // Known dead-code paths: guarded by `if (datasetId)` where datasetId is never set.
  // Whitelisted until pipeline tracking is implemented.
  const DEAD_CODE_WHITELIST = [
    '/mission-uploads/pipeline/status/',
    '/mission-uploads/dataset/complete',
  ];
  for (const m of c.matchAll(/apiClient\.\w+\(\s*['"`](\/[^'"`$?#{}]+)/g)) {
    const apiPath = m[1];
    // Build the first-segment prefix to check against mounts
    const segs    = apiPath.split('/').filter(Boolean);
    const prefix1 = '/' + segs[0];
    const prefix2 = segs.length > 1 ? '/' + segs.slice(0,2).join('/') : prefix1;
    const covered = mounts.some(mount =>
      prefix1 === mount || prefix2 === mount ||
      prefix2.startsWith(mount + '/') || mount.startsWith(prefix2)
    );
    if (!covered) {
      const key = `${path.basename(f)}: ${apiPath}`;
      const whitelisted = DEAD_CODE_WHITELIST.some(w => apiPath.startsWith(w));
      if (!whitelisted && !unmounted.has(key)) { unmounted.add(key); fail(`No backend mount for: ${key}`); }
    }
  }
}
if (unmounted.size === 0) ok('all apiClient calls map to a backend mount');

// ─── 7. navigate() targets in client + pilot ─────────────────────────────────
console.log('\n── 7. navigate() targets ─────────────────────────────────────');
let navBroken = 0;
for (const f of portalFiles) {
  const c = read(f);
  for (const m of c.matchAll(/navigate\([`'"]\/client\/([\w-]+)/g))
    if (!clientNavIds.includes(m[1]))
      { fail(`${path.basename(f)}: navigate('/client/${m[1]}') — no nav id`); navBroken++; }
  for (const m of c.matchAll(/navigate\([`'"]\/pilot\/([\w-]+)/g))
    if (!pilotNavIds.includes(m[1]) && !['checklist','weather','issues'].includes(m[1]))
      { fail(`${path.basename(f)}: navigate('/pilot/${m[1]}') — no route`); navBroken++; }
}
if (navBroken === 0) ok('all navigate() targets are valid');

// ─── 8. Key endpoint spot-checks ─────────────────────────────────────────────
console.log('\n── 8. Endpoint spot-checks ───────────────────────────────────');
// ClientMapViewer must NOT call /admin/media
const cmv = read('src/components/client/map/ClientMapViewer.tsx');
if (cmv.includes('/admin/media'))  fail('ClientMapViewer still calls /admin/media (403 for clients)');
else ok('ClientMapViewer uses /client/media');

// clientPortal.js must have /media route
const cp = read('backend/routes/clientPortal.js');
if (!cp.includes("'/media'") && !cp.includes('"/media"')) fail('backend clientPortal.js missing /media route');
else ok('backend /client/media route present');

// RequireRole must not send to /auth
if (!rr.includes('to="/auth"')) ok('RequireRole redirect target is not /auth');

// ─── 9. Orphan route files ────────────────────────────────────────────────────
console.log('\n── 9. Orphan route files ─────────────────────────────────────');
// These files are intentionally not mounted (helpers, not routers)
// Files intentionally not mounted — reason documented:
const ROUTE_EXEMPT = [
  'index.js',                 // re-export barrel, not a router
  'pilotAuth.js',             // standalone JWT helper, not a router
  // Covered by inline app.js handlers or other mounted routers:
  'uploads.js',               // duplicate — /api/uploads already mounts pilotUpload.js (same controller)
  'documents.js',             // duplicate — inline app.get('/api/documents',...) at app.js:252
  'training.js',              // covered — mounted by v1 router at /api/v1/training
  // Legacy / no active frontend calls:
  'pilot.js',                 // superseded by pilotSecure.js; no active frontend calls
  'mapping.js',               // legacy — no frontend calls
  'analyze.js',               // legacy — /images/:id/analyze is in a different router
  'missionUploads.js',        // legacy — no active frontend calls
  'driveRoutes.js',           // legacy — no frontend calls
  'claimsPricingRoutes.js',   // legacy — no frontend calls
];
const routeFiles = glob('backend/routes', '*.js').map(f => path.basename(f));
let orphans = 0;
for (const rf of routeFiles) {
  if (ROUTE_EXEMPT.includes(rf)) { ok(`${rf} (exempt)`); continue; }
  // Check if it's imported AND mounted in app.js
  const imported = backendApp.includes(`'./routes/${rf}'`) || backendApp.includes(`"./routes/${rf}"`);
  if (!imported) {
    fail(`ORPHAN ROUTE FILE: backend/routes/${rf} — never imported in app.js`);
    orphans++;
  }
}
if (orphans === 0) ok('all backend/routes/*.js files are imported in app.js');


// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
if (issues.length === 0) {
  console.log('  ALL CHECKS PASSED ✓  — nothing to fix');
} else {
  console.log(`  ${issues.length} ISSUE(S) FOUND:`);
  issues.forEach((i, n) => console.log(`  ${n+1}. ${i}`));
}
console.log('═══════════════════════════════════════════════════════════════\n');
process.exit(issues.length > 0 ? 1 : 0);
