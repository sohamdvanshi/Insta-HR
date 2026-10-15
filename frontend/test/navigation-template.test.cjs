const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const src = path.resolve(__dirname, '../src');
function loader(mocks = {}) {
  const cache = new Map();
  const load = file => {
    if (!path.extname(file)) file = ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
    if (file.endsWith('.json')) return require(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(file, mod);
    const nativeRequire = Module.createRequire(file);
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('@/') ? load(path.join(src, name.slice(2))) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : nativeRequire(name);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
    return mod.exports;
  }; return load;
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
test('all roles have working route targets and only appropriate private work tools', () => {
  const { getNavigation, isNavActive } = loader()(path.join(src, 'lib/navigation.ts'));
  for (const role of [undefined, 'candidate', 'employer', 'admin', 'super_admin', 'trainer']) {
    const nav = getNavigation(role), links = [...nav.primary, ...nav.groups.flatMap(g => g.items), ...nav.account];
    assert.ok(nav.primary.length <= 2);
    for (const item of links) assert.ok(fs.existsSync(path.join(src, 'app', item.href, 'page.tsx')), role + ': ' + item.href);
    if (role === 'trainer') assert.ok(links.every(item => item.href.startsWith('/trainer') || item.href === '/training/certificate/verify'));
    if (role === 'candidate') assert.ok(links.every(item => !item.href.startsWith('/admin') && !item.href.startsWith('/employer')));
    if (role === 'admin') assert.ok(!links.some(item => item.href.startsWith('/super-admin')));
  }
  const employer = getNavigation('employer');
  assert.ok(employer.groups.find(g => g.id === 'finance').items.some(i => i.href === '/employer/wage-register'));
  assert.ok(getNavigation('super_admin').groups.find(g => g.id === 'finance').items.some(i => i.href === '/super-admin/wage-register'));
  assert.equal(isNavActive('/employer/wage-register', employer.primary[0]), false);
  assert.equal(isNavActive('/trainer/courses/123/quiz', { href: '/trainer/courses' }), true);
});
test('each configured menu label resolves in English, Hindi and Marathi', async () => {
  const load = loader(), { getNavigation } = load(path.join(src, 'lib/navigation.ts'));
  const i18n = load(path.join(src, 'i18n.ts')).default, { tr } = load(path.join(src, 'lib/localization.tsx'));
  const index = JSON.parse(fs.readFileSync(path.join(src, 'locales/source-index.json')));
  for (const role of [undefined, 'candidate', 'employer', 'admin', 'super_admin', 'trainer']) {
    const nav = getNavigation(role), labels = [...nav.primary, ...nav.groups, ...nav.groups.flatMap(g => g.items), ...nav.account].map(i => i.label);
    for (const label of labels) assert.ok(index[label] || index[label.toLowerCase()], label);
    for (const lang of ['hi', 'mr']) { await i18n.changeLanguage(lang); for (const label of labels) assert.ok(tr(label).length > 0); }
  }
});
test('desktop and mobile disclosures open and Escape closes menus and returns focus to a visible trigger', () => {
  const saved = global.document; let stateCursor, refCursor, effects, focused = false;
  const states = [false, null, { role: 'employer', email: 'open@example.test', name: 'Open' }], refs = [], listeners = {};
  try {
    global.document = { addEventListener: (name, fn) => listeners[name] = fn, removeEventListener: name => delete listeners[name] };
    const Page = loader({ react: { ...React,
      useState: initial => { const i = stateCursor++; if (!(i in states)) states[i] = initial; return [states[i], value => states[i] = typeof value === 'function' ? value(states[i]) : value]; },
      useRef: initial => { const i = refCursor++; return refs[i] ||= { current: initial }; }, useEffect: fn => effects.push(fn)
    }, '@/lib/localization': { tr: String, useLocale: () => ({ language: 'en' }) }, '@/components/LanguageSwitcher': () => null, 'next/navigation': { usePathname: () => '/employer/wage-register' } })(path.join(src, 'components/Navbar.tsx')).default;
    const render = () => { stateCursor = refCursor = 0; effects = []; return Page(); };
    let tree = render(); let trigger = nodes(tree).find(n => n.props['aria-controls'] === 'nav-finance');
    trigger.props.ref({ focus: () => focused = true }); trigger.props.onClick(); tree = render();
    assert.ok(nodes(tree).some(n => n.props.href === '/employer/wage-register'));
    const cleanup = effects[1](); listeners.keydown({ key: 'Escape' }); assert.equal(states[1], null); assert.ok(focused); cleanup();
    tree = render(); nodes(tree).find(n => n.props['aria-controls'] === 'mobile-navigation').props.onClick(); tree = render();
    const mobile = nodes(tree).find(n => n.props['aria-controls'] === 'mobile-navigation'); mobile.props.ref({ focus: () => focused = true });
    nodes(tree).find(n => n.props['aria-controls'] === 'nav-mobile-finance').props.onClick(); tree = render();
    assert.ok(nodes(tree).some(n => n.props.id === 'nav-mobile-finance'));
    const cleanupMobile = effects[1](); focused = false; listeners.keydown({ key: 'Escape' });
    assert.equal(states[0], false); assert.equal(states[1], null); assert.ok(focused); cleanupMobile();
  } finally { global.document = saved; }
});
test('employer template button sends authenticated selected month and downloads the named workbook; staff view hides it', async () => {
  const old = { fetch: global.fetch, document: global.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, timeout: global.setTimeout };
  let request, downloaded, revoked; let cursor = 0;
  try {
    global.fetch = async (url, options) => { request = { url, options }; return { ok: true, blob: async () => new Blob(['xlsx']) }; };
    URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = url => revoked = url;
    global.setTimeout = fn => { fn(); return 1; };
    global.document = { body: { appendChild() {} }, createElement: () => ({ click() { downloaded = this.download; }, remove() {} }) };
    const Workspace = loader({ react: { ...React, useState: initial => [cursor++ === 0 ? 'test-token' : cursor === 5 ? '2024-02' : initial, () => {}], useEffect: () => {} }, '@/lib/localization': { tr: String, trError: String, locale: () => 'en-IN', useLocale: () => ({ language: 'en' }) } })(path.join(src, 'components/payroll/WageRegisterWorkspace.tsx')).default;
    let tree = Workspace({ readOnly: false });
    nodes(tree).find(n => n.props.children === 'Download attendance template').props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(request.url.endsWith('/wage-registers/template?period=2024-02'));
    assert.equal(request.options.headers.Authorization, 'Bearer test-token');
    assert.equal(downloaded, 'attendance-template-2024-02.xlsx'); assert.equal(revoked, 'blob:test');
    cursor = 0; tree = Workspace({ readOnly: true }); assert.ok(!nodes(tree).some(n => n.props.children === 'Download attendance template'));
  } finally { global.fetch = old.fetch; global.document = old.document; URL.createObjectURL = old.create; URL.revokeObjectURL = old.revoke; global.setTimeout = old.timeout; }
});
