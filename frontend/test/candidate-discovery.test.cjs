const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const src = path.resolve(__dirname, '../src');
function loadPage(file, mocks) {
  const mod = new Module(file); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  const nativeRequire = Module.createRequire(file);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
  return mod.exports.default;
}
function harness(page) {
  const states = [], refs = [], effects = [], requests = [], destinations = [];
  let stateIndex, refIndex, tree;
  const saved = { fetch: global.fetch, localStorage: global.localStorage };
  global.localStorage = { getItem: key => key === 'token' ? 'session-token' : JSON.stringify({ role: 'employer' }) };
  global.fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
  const router = { replace: path => destinations.push(path) };
  const Page = loadPage(path.join(src, page), {
    react: { ...React,
      useState: initial => { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]; },
      useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
      useEffect: fn => effects.push(fn)
    },
    '@/lib/storage': { readStoredUser: () => ({ role: 'employer' }) },
    '@/lib/api': { API_BASE: 'https://api.test/api/v1', BACKEND_BASE: 'https://api.test' },
    '@/lib/localization': { tr: value => String(value || ''), trError: value => String(value || ''), useLocale: () => ({ language: 'en' }) },
    'next/navigation': { useRouter: () => router }
  });
  const render = () => { stateIndex = 0; refIndex = 0; tree = Page(); return tree; };
  render(); const initialEffects = [...effects]; initialEffects.forEach(fn => fn());
  const walk = node => Array.isArray(node) ? node.flatMap(n => walk(n)) : node && typeof node === 'object' && node.props ? [node, ...walk(node.props.children)] : [];
  const nodes = () => walk(tree);
  const find = predicate => nodes().find(predicate);
  return { render, nodes, find, requests, destinations, states,
    resolve: async (index, data, extra = {}) => { requests[index].resolve({ ok: true, json: async () => ({ success: true, data, ...extra }) }); await new Promise(resolve => setImmediate(resolve)); render(); },
    restore: () => { global.fetch = saved.fetch; global.localStorage = saved.localStorage; }
  };
}
test('databank shows builder share links, resolves submitted relative upload URLs, and preserves each resume title', async () => {
  const h = harness('app/employer/candidates/page.tsx');
  try {
    assert.equal(h.requests[0].options.headers.Authorization, 'Bearer session-token');
    await h.resolve(0, [{ id: 'resume:r1', userId: 'candidate', firstName: 'Builder', title: 'Frontend CV', skills: ['React'], resumes: [{ id: 'builder:r1', resumeId: 'r1', title: 'Frontend CV' }] }, { id: 'application:a', userId: 'other', firstName: 'Applicant', resumes: [{ id: 'upload:a', url: '/uploads/a.pdf' }] }]);
    const links = h.nodes().filter(node => node.type === 'a').map(node => node.props.href);
    assert.ok(links.includes('/resume/share/r1')); assert.ok(links.includes('https://api.test/uploads/a.pdf'));
    assert.ok(h.nodes().some(node => node.props.children === 'Frontend CV'));
  } finally { h.restore(); }
});
test('clearing databank filters wins over an older filtered response', async () => {
  const h = harness('app/employer/candidates/page.tsx');
  try {
    await h.resolve(0, []);
    h.find(node => node.type === 'input' && node.props.placeholder === 'Skills (comma separated)').props.onChange({ target: { value: 'React, TypeScript' } }); h.render();
    h.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.ok(h.requests[1].url.includes('skills=React%2C+TypeScript'));
    h.find(node => node.type === 'button' && node.props.children === 'Clear Filters').props.onClick();
    assert.equal(h.requests[2].url, 'https://api.test/api/v1/employer/candidates');
    await h.resolve(2, [{ id: 'new', firstName: 'Latest' }]); await h.resolve(1, [{ id: 'old', firstName: 'Stale' }]);
    assert.deepEqual(h.states[0].map(row => row.id), ['new']);
  } finally { h.restore(); }
});
test('changing selected job discards an old AI response and renders matches for the new job', async () => {
  const h = harness('app/ai-match/page.tsx');
  try {
    await h.resolve(0, [{ id: 'job1', title: 'First' }, { id: 'job2', title: 'Second' }]);
    h.find(node => node.type === 'select').props.onChange({ target: { value: 'job1' } }); h.render();
    const oldRequest = h.find(node => node.type === 'button').props.onClick();
    h.find(node => node.type === 'select').props.onChange({ target: { value: 'job2' } }); h.render();
    const newRequest = h.find(node => node.type === 'button').props.onClick();
    assert.equal(h.requests[2].url, 'https://api.test/api/v1/candidates/ai-match/job2');
    await h.resolve(2, [{ candidateId: 'latest', name: 'Applicant', matchScore: 90, skillScore: 100, expScore: 100 }]); await newRequest;
    await h.resolve(1, [{ candidateId: 'stale' }]); await oldRequest; h.render();
    assert.deepEqual(h.states[2].map(row => row.candidateId), ['latest']);
    assert.ok(h.nodes().some(node => node.props.children === 'Applicant'));
  } finally { h.restore(); }
});

test('city and employment filters are sent together and grouped resumes render on one card', async () => {
  const h = harness('app/employer/candidates/page.tsx');
  try {
    await h.resolve(0, []);
    h.find(n => n.type === 'input' && n.props.placeholder === 'City / location').props.onChange({ target: { value: 'Pune' } }); h.render();
    h.find(n => n.type === 'select').props.onChange({ target: { value: 'part-time' } }); h.render();
    h.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    const params = new URL(h.requests[1].url).searchParams; assert.equal(params.get('location'), 'Pune'); assert.equal(params.get('jobType'), 'part-time');
    await h.resolve(1, [{ id: 'one', userId: 'one', firstName: 'Savf', currentLocation: 'Mumbai', appliedLocations: ['Pune'], jobTypes: ['part-time'], skills: ['React'], resumes: [{ id: 'a', resumeId: 'r1', title: 'CV one' }, { id: 'b', url: '/uploads/b.pdf', title: 'CV two' }] }]);
    assert.equal(h.nodes().filter(n => n.type === 'article').length, 1);
    assert.equal(h.nodes().filter(n => n.type === 'details').length, 1);
    assert.equal(h.nodes().filter(n => n.type === 'li').length, 2);
    assert.ok(h.nodes().some(n => n.props.children === 'Mumbai')); assert.ok(h.nodes().some(n => n.props.children === 'Pune'));
  } finally { h.restore(); }
});
test('offline matching displays candidates and an explicit basic-matching notice', async () => {
  const h = harness('app/ai-match/page.tsx');
  try {
    await h.resolve(0, [{ id: 'job', title: 'Developer' }]);
    h.find(n => n.type === 'select').props.onChange({ target: { value: 'job' } }); h.render();
    const pending = h.find(n => n.type === 'button').props.onClick();
    await h.resolve(1, [{ candidateId: 'one', name: 'Savf', matchScore: 80, skillScore: 100, expScore: 70 }], { matchingMode: 'basic', fallback: true }); await pending; h.render();
    assert.ok(h.nodes().some(n => n.props.children === 'Savf'));
    assert.ok(h.find(n => n.props.role === 'status').props.children.includes('Basic matching'));
  } finally { h.restore(); }
});
test('profile saves preferred cities and job types as arrays', async () => {
  const h = harness('app/profile/page.tsx');
  try {
    await h.resolve(0, { firstName: 'Savf', preferredLocations: ['Mumbai'], preferredJobTypes: [] });
    const cityLabel = h.find(n => n.type === 'label' && Array.isArray(n.props.children) && n.props.children[0] === 'Preferred cities (comma separated)');
    cityLabel.props.children[1].props.onChange({ target: { value: 'Mumbai, Pune' } }); h.render();
    const typeLabel = h.find(n => n.type === 'label' && Array.isArray(n.props.children) && n.props.children[1] === 'Part-time');
    typeLabel.props.children[0].props.onChange({ target: { checked: true } }); h.render();
    const pending = h.find(n => n.type === 'button' && n.props.children === 'Save Profile').props.onClick();
    const payload = JSON.parse(h.requests[1].options.body); assert.deepEqual(payload.preferredLocations, ['Mumbai', 'Pune']); assert.deepEqual(payload.preferredJobTypes, ['part-time']);
    await h.resolve(1, payload); await pending;
  } finally { h.restore(); }
});
