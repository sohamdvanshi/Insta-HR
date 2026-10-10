const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const src = path.resolve(__dirname, '../src'), namespaces = ['common', 'jobs', 'auth', 'dashboard', 'payroll', 'training', 'resume', 'subscription', 'admin', 'errors']
const catalogs = Object.fromEntries(['en', 'hi', 'mr'].map(lang => [lang, Object.fromEntries(namespaces.map(ns => [ns, JSON.parse(fs.readFileSync(path.join(src, 'locales', lang, ns + '.json')))]))]))
const cache = new Map()
function load(file) {
  if (!path.extname(file)) file = ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync)
  if (file.endsWith('.json')) return require(file)
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(file, mod)
  const nativeRequire = Module.createRequire(file)
  mod.require = name => name.startsWith('@/') ? load(path.join(src, name.slice(2))) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : nativeRequire(name)
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  mod._compile(output, file); return mod.exports
}
const i18n = load(path.join(src, 'i18n.ts')).default, { tr, trError, locale, validLanguage } = load(path.join(src, 'lib/localization.tsx'))
const normalize = v => v.trim().replace(/\s+/g, ' ')
const index = require('../src/locales/source-index.json')
const unchanged = new Set(['InstaHire', 'Insta-HR', 'Google', 'LinkedIn', 'GitHub', 'Facebook', 'WhatsApp', 'Twitter / X', 'YouTube', 'React, Node.js, PostgreSQL', 'React, Node.js, PostgreSQL, Python', 'John', 'Doe', 'you@example.com', 'Example: CERT-1234ABCD-5678EFGH', 'admin.user_access'])
const looksTechnical = value => /^[A-Z]{1,5}$|^e\.g\.|^(?:https?:|[A-Za-z0-9._-]+@)/.test(value)
function files(dir) { return fs.readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return fs.statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [] }) }

test('ten namespaces have identical nonempty EN/HI/MR keys and interpolation variables', () => {
  for (const ns of namespaces) for (const lang of ['hi', 'mr']) {
    assert.deepEqual(Object.keys(catalogs[lang][ns]).sort(), Object.keys(catalogs.en[ns]).sort(), `${lang}/${ns}`)
    for (const [key, en] of Object.entries(catalogs.en[ns])) {
      const value = catalogs[lang][ns][key]
      assert.equal(typeof value, 'string'); assert.ok(value.trim() || key === 's', `${lang}/${ns}:${key}`)
      const placeholders = v => [...v.matchAll(/{{(\w+)}}/g)].map(m => m[1]).sort()
      assert.deepEqual(placeholders(value), placeholders(en), `${lang}/${ns}:${key}`)
      assert.ok(!/TODO|TRANSLATE_ME/.test(value))
    }
  }
})

test('catalog index resolves known messages, plural forms and safe interpolation in all languages', async () => {
  for (const lang of ['en', 'hi', 'mr']) {
    await i18n.changeLanguage(lang)
    assert.ok(tr('Create trainer account'))
    assert.ok(!tr('Provide a reason between 5 and 500 characters').includes('Provide') || lang === 'en')
    assert.ok(!tr('Attendance saved.').includes('Attendance') || lang === 'en')
    assert.ok(tr('Job results', { count: 2 }).includes('2'))
    if (lang === 'en') assert.equal(tr('Job results', { count: 1 }), '1 job found')
    const content = '<img src=x onerror=alert(1)>'
    assert.ok(tr('Get {{value0}}', { value0: content }).includes(content))
    assert.equal(tr('Untranslated user-created title'), 'Untranslated user-created title')
    assert.equal(tr('constructor'), 'constructor')
    assert.equal(tr('__proto__'), '__proto__')
    assert.equal(tr(null), '')
    assert.equal(tr(false), '')
    assert.equal(tr(true), '')
    assert.equal(trError('unexpected database exception'), tr('Unable to complete request'))
    assert.equal(trError('User not found'), tr('User not found'))
    assert.equal(locale(), `${lang}-IN`)
  }
})

test('dynamic validation, payment and notification messages retain values and translate punctuation safely', async () => {
  await i18n.changeLanguage('mr')
  assert.equal(tr('Question 3 is required'), 'प्रश्न 3 आवश्यक आहे')
  assert.ok(tr('🎉 Payment successful! Your premium plan is now active.').includes('देयक'))
  assert.ok(tr('Class saved. Emails sent: 4. Failed: 2. Use Retry pending emails in Sessions.').includes('ईमेल'))
  assert.ok(tr('Class saved. Emails sent: 4. Failed: 2. Use Retry pending emails in Sessions.').includes('4'))
  assert.equal(tr('Question 3 is requiredX'), 'Question 3 is requiredX')
  assert.equal(tr(' Copy link '), ' दुवा कॉपी करा ')
  assert.equal(validLanguage('kn'), false); assert.equal(validLanguage(null), false); assert.equal(validLanguage('hi'), true)
})

test('HTML browser validation maps required, email, pattern, length, range and step errors', () => {
  const { validationMessage } = load(path.join(src, 'lib/formValidation.ts'))
  for (const [flag, expected] of [['valueMissing', 'This field is required'], ['typeMismatch', 'Please enter a valid email address'], ['badInput', 'Please enter a number'], ['patternMismatch', 'Please match the requested format'], ['tooShort', 'Please use at least {{count}} characters'], ['tooLong', 'Please use no more than {{count}} characters'], ['rangeUnderflow', 'Please enter a value of at least {{value0}}'], ['rangeOverflow', 'Please enter a value no greater than {{value0}}'], ['stepMismatch', 'Please enter a valid value']]) {
    assert.equal(validationMessage({ validity: { [flag]: true }, type: 'email', minLength: 8, maxLength: 12, min: '1', max: '10' }).key, expected)
  }
  assert.equal(validationMessage({ validity: {} }), null)
})

test('every legacy navbar key resolves for each language', () => {
  const sf = ts.createSourceFile('Navbar.tsx', fs.readFileSync(path.join(src, 'components/Navbar.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const keys = []; const walk = n => { if (ts.isCallExpression(n) && n.expression.getText(sf) === 't' && ts.isStringLiteral(n.arguments[0])) keys.push(n.arguments[0].text); ts.forEachChild(n, walk) }; walk(sf)
  for (const key of keys) for (const lang of ['en', 'hi', 'mr']) assert.ok(catalogs[lang].common[key], `${lang}/${key}`)
})

test('source copy uses translations, translated options keep explicit raw values, and CSS stays outside translation', () => {
  const problems = []
  for (const file of [...files(path.join(src, 'app')), ...files(path.join(src, 'components'))]) {
    if (!fs.readFileSync(file, 'utf8').includes('use client')) continue
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const report = value => { const v = normalize(value); if (/[A-Za-z]/.test(v) && !index[v] && !unchanged.has(v) && !looksTechnical(v)) problems.push(`${path.relative(src, file)}: ${v}`) }
    const walk = n => {
      if (ts.isJsxText(n)) report(n.text)
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'tr' && ts.isStringLiteral(n.arguments[0])) report(n.arguments[0].text)
      if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === 'option' && n.children.some(c => ts.isJsxExpression(c) && c.expression && c.expression.getText(sf).startsWith('tr('))) assert.ok(n.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.text === 'value'), file)
      if (ts.isJsxElement(n) && ['style', 'script'].includes(n.openingElement.tagName.getText(sf))) for (const child of n.children) if (ts.isJsxExpression(child) && child.expression) assert.ok(!child.expression.getText(sf).startsWith('tr('), file)
      ts.forEachChild(n, walk)
    }; walk(sf)
  }
  assert.deepEqual(problems, [])
})

test('Hindi/Marathi switcher and admin tools render translated HTML and preserve personal data', async () => {
  const Switcher = load(path.join(src, 'components/LanguageSwitcher.tsx')).default
  const { AdminFrame, RecordFields } = load(path.join(src, 'components/admin/AdminShell.tsx'))
  for (const lang of ['hi', 'mr']) {
    await i18n.changeLanguage(lang)
    const switcher = renderToStaticMarkup(React.createElement(Switcher))
    assert.ok(switcher.includes('हिंदी') && switcher.includes('मराठी'))
    assert.ok(switcher.includes(`value="${lang}" selected`))
    const admin = renderToStaticMarkup(React.createElement(AdminFrame, { title: 'Admin dashboard' }, React.createElement(RecordFields, { data: { firstName: 'Open', title: 'General', status: 'pending' } })))
    assert.ok(admin.includes('Open') && admin.includes('General'))
    assert.ok(!admin.includes('>First Name<'))
    assert.ok(admin.includes('प्रलंबित') || admin.includes('लंबित'))
    assert.ok(!admin.includes('>Admin dashboard<'))
  }
})


test('wage workspace renders localized import controls and preserves the read-only view', async () => {
  const Workspace = load(path.join(src, 'components/payroll/WageRegisterWorkspace.tsx')).default
  for (const lang of ['hi', 'mr']) {
    await i18n.changeLanguage(lang)
    const editable = renderToStaticMarkup(React.createElement(Workspace))
    assert.ok(!editable.includes('Workbook policy:') && !editable.includes('Import monthly attendance'))
    assert.ok(editable.includes(tr('Import monthly attendance')))
    assert.ok(editable.includes('P + PH') && editable.includes('12%') && editable.includes('0.75%'))
    const readonly = renderToStaticMarkup(React.createElement(Workspace, { readOnly: true }))
    assert.ok(!readonly.includes('type="file"'))
    assert.ok(readonly.includes(tr('Saved registers')))
    assert.ok(!tr('Updated 3 selected employees. Save to persist changes.').includes('Updated'))
    assert.ok(tr('Select {{value0}}', { value0: 'Open' }).includes('Open'))
  }
})
