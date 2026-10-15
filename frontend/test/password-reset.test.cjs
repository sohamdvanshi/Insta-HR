const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
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
function harness(mode) {
  const state = [], effects = []; let cursor = 0;
  const Component = loader({
    react: { ...React, useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => state[i] = typeof value === 'function' ? value(state[i]) : value]; }, useEffect: effect => effects.push(effect) },
    '@/lib/localization': { tr: String, trError: String, useLocale: () => ({ language: 'en' }) }
  })(path.join(src, 'components/auth/PasswordRecovery.tsx')).default;
  const render = () => { cursor = 0; return Component({ mode }); };
  return { render, effects };
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)]; }
function input(tree, id) { return nodes(tree).find(n => n.props.id === id); }
const event = { preventDefault() {} };
test('login link reaches an existing forgot page; both recovery pages render localized accessible controls', async () => {
  assert.ok(fs.readFileSync(path.join(src, 'app/login/page.tsx'), 'utf8').includes("href='/forgot-password'"));
  const load = loader(), i18n = load(path.join(src, 'i18n.ts')).default;
  for (const language of ['en', 'hi', 'mr']) {
    await i18n.changeLanguage(language);
    const Page = load(path.join(src, 'app/forgot-password/page.tsx')).default;
    const markup = renderToStaticMarkup(React.createElement(Page));
    assert.ok(markup.includes('type="email"') && markup.includes('autoComplete="email"'));
    assert.ok(markup.includes('href="/login"') && markup.includes('recovery-title'));
    if (language !== 'en') assert.ok(!markup.includes('Forgot your password?'));
    const Reset = load(path.join(src, 'app/reset-password/page.tsx')).default;
    assert.ok(renderToStaticMarkup(React.createElement(Reset)).includes('role="status"'));
  }
});
test('forgot form normalizes email, calls configured backend and shows the generic delivery notice', async () => {
  const savedFetch = global.fetch; let call;
  try {
    global.fetch = async (url, options) => { call = { url, body: JSON.parse(options.body) }; return { ok: true, json: async () => ({ success: true, message: 'Check your inbox.' }) }; };
    const h = harness('forgot'); let tree = h.render();
    input(tree, 'recovery-email').props.onChange({ target: { value: ' PERSON@EXAMPLE.TEST ' } }); tree = h.render();
    await nodes(tree).find(n => n.type === 'form').props.onSubmit(event);
    assert.ok(call.url.endsWith('/auth/forgot-password')); assert.deepEqual(call.body, { email: 'person@example.test' });
    assert.ok(nodes(h.render()).some(n => n.props.role === 'status' && n.props.children === 'Check your inbox.'));
  } finally { global.fetch = savedFetch; }
});
test('reset form rejects mismatched passwords and posts the fragment token once; success clears secrets', async () => {
  const savedWindow = global.window, savedFetch = global.fetch; const calls = [], history = [];
  try {
    const token = 'a'.repeat(64);
    global.window = { location: { hash: '#token=' + token }, history: { replaceState: (...args) => history.push(args) } };
    global.fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ success: true, message: 'Password changed.' }) }; };
    const h = harness('reset'); h.render(); h.effects[0](); let tree = h.render();
    input(tree, 'new-password').props.onChange({ target: { value: 'new-password' } });
    input(tree, 'confirm-password').props.onChange({ target: { value: 'wrong-password' } }); tree = h.render();
    await nodes(tree).find(n => n.type === 'form').props.onSubmit(event); assert.equal(calls.length, 0);
    input(tree, 'confirm-password').props.onChange({ target: { value: 'new-password' } }); tree = h.render();
    await nodes(tree).find(n => n.type === 'form').props.onSubmit(event);
    assert.equal(calls.length, 1); assert.deepEqual(calls[0].body, { token, password: 'new-password' });
    assert.ok(calls[0].url.endsWith('/auth/reset-password'));
    assert.ok(!nodes(h.render()).some(n => n.type === 'form')); assert.equal(history[0][2], '/reset-password');
  } finally { global.window = savedWindow; global.fetch = savedFetch; }
});
test('missing token cannot submit a reset and offers a new reset link', () => {
  const saved = global.window;
  try {
    global.window = { location: { hash: '' } }; const h = harness('reset'); h.render(); h.effects[0]();
    const tree = h.render(); assert.ok(!nodes(tree).some(n => n.type === 'form'));
    assert.ok(nodes(tree).some(n => n.props.role === 'alert'));
    assert.ok(nodes(tree).some(n => n.props.href === '/forgot-password'));
  } finally { global.window = saved; }
});
