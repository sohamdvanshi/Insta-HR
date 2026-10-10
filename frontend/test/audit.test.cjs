const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const src = path.resolve(__dirname, '../src');
function loader(mocks = {}, rewrite = source => source) {
  const cache = new Map();
  const load = file => {
    if (!path.extname(file)) file = ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
    if (file.endsWith('.json')) return require(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(file, mod);
    const nativeRequire = Module.createRequire(file);
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('@/') ? load(path.join(src, name.slice(2))) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : nativeRequire(name);
    mod._compile(ts.transpileModule(rewrite(fs.readFileSync(file, 'utf8')), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
    return mod.exports;
  };
  return load;
}
const copy = { tr: value => value == null || typeof value === 'boolean' ? '' : String(value), useLocale: () => ({ language: 'hi' }), locale: () => 'hi-IN' };
test('configured API and upload origins are normalized consistently', () => {
  const old = process.env.NEXT_PUBLIC_API_URL, oldBackend = process.env.NEXT_PUBLIC_BACKEND_URL;
  try {
    process.env.NEXT_PUBLIC_API_URL = 'https://example.test/api/v1///'; delete process.env.NEXT_PUBLIC_BACKEND_URL;
    let api = loader()(path.join(src, 'lib/api.ts')); assert.equal(api.API_BASE, 'https://example.test/api/v1'); assert.equal(api.BACKEND_BASE, 'https://example.test');
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://uploads.test///'; api = loader()(path.join(src, 'lib/api.ts')); assert.equal(api.BACKEND_BASE, 'https://uploads.test');
  } finally { if (old === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = old; if (oldBackend === undefined) delete process.env.NEXT_PUBLIC_BACKEND_URL; else process.env.NEXT_PUBLIC_BACKEND_URL = oldBackend; }
});
test('corrupt, null, primitive and array user storage safely becomes an empty user', () => {
  const saved = global.localStorage;
  try {
    const { readStoredUser } = loader()(path.join(src, 'lib/storage.ts'));
    for (const raw of ['invalid', 'null', '[]', '"candidate"', '123']) { global.localStorage = { getItem: () => raw }; assert.deepEqual(readStoredUser(), {}); }
    global.localStorage = { getItem: () => '{"role":"candidate"}' }; assert.equal(readStoredUser().role, 'candidate');
    global.localStorage = { getItem() { throw new Error('disabled'); } }; assert.deepEqual(readStoredUser(), {});
  } finally { global.localStorage = saved; }
});
test('new resume effect replay creates one record and navigates only for the active effect', async () => {
  let effects = [], calls = 0, destinations = []; const ref = { current: null };
  const savedFetch = global.fetch, savedStorage = global.localStorage;
  try {
    global.localStorage = { getItem: () => 'token' };
    global.fetch = async () => { calls++; return { ok: true, json: async () => ({ success: true, data: { id: 'new-resume' } }) }; };
    const Page = loader({ react: { ...React, useEffect: fn => effects.push(fn), useRef: () => ref }, 'next/navigation': { useRouter: () => ({ replace: value => destinations.push(value) }) }, '@/lib/localization': copy })(path.join(src, 'app/resume/new/page.tsx')).default;
    Page(); const cleanup = effects[0](); cleanup(); effects[0](); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1); assert.deepEqual(destinations, ['/resume/new-resume']);
  } finally { global.fetch = savedFetch; global.localStorage = savedStorage; }
});
test('changing job filters ignores an older response and keeps the latest results', async () => {
  let effects = [], state = 0, updates = [], requests = [];
  const savedFetch = global.fetch;
  try {
    global.fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
    const load = loader({ react: { ...React, useState: initial => { const index = state++; return [initial, value => updates.push([index, value])]; }, useMemo: fn => fn(), useEffect: fn => effects.push(fn) }, '@/lib/localization': copy, 'next/navigation': { useRouter: () => ({ replace() {} }), usePathname: () => '/jobs', useSearchParams: () => new URLSearchParams('keyword=python') } }, source => source.replace('function JobsPageContent()', 'export function JobsPageContent()'));
    const { JobsPageContent } = load(path.join(src, 'app/jobs/page.tsx')); JobsPageContent();
    const effect = effects.at(-1), cleanup = effect(); cleanup(); effect(); assert.equal(requests.length, 2);
    requests[1].resolve({ json: async () => ({ success: true, data: [{ id: 'latest' }], count: 1, totalPages: 1 }) }); await new Promise(resolve => setImmediate(resolve));
    requests[0].resolve({ json: async () => ({ success: true, data: [{ id: 'stale' }], count: 1, totalPages: 1 }) }); await new Promise(resolve => setImmediate(resolve));
    const resultUpdates = updates.filter(([index, value]) => index === 0 && Array.isArray(value)); assert.deepEqual(resultUpdates.map(([, value]) => value[0]?.id), ['latest']);
  } finally { global.fetch = savedFetch; }
});
test('navigation preserves a name that matches a translation key', () => {
  let state = 0;
  const Page = loader({ react: { ...React, useState: initial => [state++ === 2 ? { firstName: 'Open', email: 'open@example.com', role: 'candidate' } : initial, () => {}], useEffect: () => {}, useMemo: fn => fn(), useRef: () => ({ current: null }) }, '@/lib/localization': { ...copy, tr: value => value === 'Open' ? 'खोलें' : copy.tr(value) }, '@/components/LanguageSwitcher': () => React.createElement('select'), 'react-i18next': { useTranslation: () => ({ t: key => key }) }, 'next/navigation': { usePathname: () => '/dashboard' } })(path.join(src, 'components/Navbar.tsx')).default;
  const html = renderToStaticMarkup(React.createElement(Page)); assert.ok(html.includes('>Open</p>')); assert.ok(!html.includes('खोलें'));
});
test('resume skills, certifications and languages are rendered as authored content', () => {
  // Guard the exact regression: catalog collisions must never translate user resume list entries.
  for (const page of ['app/resume/[id]/page.tsx', 'app/resume/share/[id]/page.tsx']) {
    const text = fs.readFileSync(path.join(src, page), 'utf8'); assert.ok(!text.includes('{tr(item)}'), page);
    assert.ok(!text.includes('tr(item.location ?'), page); assert.ok(!text.includes('tr(item.fieldOfStudy ?'), page);
  }
});
test('portal requests have no hardcoded backend URLs outside the shared configuration', () => {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  for (const file of walk(src).filter(file => /\.(tsx|ts)$/.test(file) && file !== path.join(src, 'lib', 'api.ts'))) {
    assert.ok(!fs.readFileSync(file, 'utf8').includes('http://localhost:5000'), path.relative(src, file));
  }
});
