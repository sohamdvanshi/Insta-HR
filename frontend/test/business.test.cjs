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

const copy={tr:(v,params)=>String(v??'').replace(/{{(\w+)}}/g,(_,k)=>String(params?.[k]??'')),trError:String,useLocale:()=>({language:'en'}),locale:()=> 'en-IN'}
function harness(pathname, seed=[], other={}) {
 let cursor=0;const values=[...seed]
 const Page=loader({ react:{...React,useEffect:()=>{},useState:initial=>{const i=cursor++;if(values[i] === undefined)values[i]=initial;return [values[i],v=>values[i]=typeof v==='function'?v(values[i]):v]}},'@/lib/localization':copy,'next/navigation':{useRouter:()=>({push(){},replace(){}})},...other})(path.join(src,pathname)).default
 return props=>{cursor=0;return Page(props)}
}
const text=tree=> typeof tree==='string'||typeof tree==='number'?String(tree):!tree||typeof tree!=='object'?'':React.Children.toArray(tree.props?.children).map(text).join(' ')
test('superadmin review UI offers decisions only for submitted registers and never wage editing',()=>{
 const seed=[];seed[0]='token';seed[11]={id:'register',employerId:'employer',period:'2026-10',site:'Site',status:'submitted',version:3,rows:[],warnings:[],sourceName:'attendance.xlsx'}
 const render=harness('components/payroll/WageRegisterWorkspace.tsx',seed)
 let tree=render({readOnly:true});assert.ok(text(tree).includes('Approve and lock'));assert.ok(text(tree).includes('Return for corrections'));assert.ok(!text(tree).includes('Save wages'));assert.ok(!nodes(tree).some(n=>n.props.type==='file'))
 seed[11]={...seed[11],status:'approved'};tree=harness('components/payroll/WageRegisterWorkspace.tsx',seed)({readOnly:true});assert.ok(!text(tree).includes('Return for corrections'))
 seed[11]={...seed[11],status:'draft'};tree=harness('components/payroll/WageRegisterWorkspace.tsx',seed)({readOnly:false});assert.ok(text(tree).includes('Submit for review'));assert.ok(!text(tree).includes('Approve and lock'))
})
test('yearly selector displays annual price and 365 days, monthly restores the monthly terms',()=>{
 const seed=[];seed[0]='yearly';seed[1]=[{id:'standard',name:'Standard',price:1999,yearlyPrice:19999,durationDays:30,color:'blue',features:[],missing:[],disabled:false}];seed[3]=false;seed[6]=false
 const render=harness('app/subscription/page.tsx',seed)
 let tree=render();assert.ok(text(tree).includes('19,999'));assert.ok(text(tree).includes('/365 days'))
 const monthly=nodes(tree).find(n=>n.type==='button'&&text(n)==='Monthly');monthly.props.onClick();tree=render();assert.ok(text(tree).includes('1,999'));assert.ok(text(tree).includes('/30 days'));assert.ok(!text(tree).includes('19,999'))
})
test('superadmin overview renders admin counts and excludes candidate/employer overview cards',()=>{
 const render=harness('components/admin/AdminOverview.tsx',[{admins:1,activeAdmins:1,inactiveAdmins:0},'',[{id:'admin-id',email:'admin@example.test',isActive:true}]],{'@/components/admin/AdminShell':{},'./AdminShell':{useStaff:()=>({role:'super_admin'}),AdminFrame:()=>null,Notice:()=>null,label:String}})
 const tree=render();assert.ok(text(tree).includes('admin@example.test'));assert.ok(!nodes(tree).some(n=>['/admin/candidates','/admin/employers'].includes(n.props.href)))
})
test('saved Kannada and Tamil selections survive provider hydration and update document language',()=>{
 const saved={document:global.document,window:global.window,localStorage:global.localStorage};
 try { for(const lang of ['kn','ta']) {
  const effects=[],changed=[];global.document={documentElement:{},addEventListener(){},removeEventListener(){}};global.window={addEventListener(){},removeEventListener(){}};global.localStorage={getItem:()=>lang};
  const Page=loader({react:{...React,useEffect:fn=>effects.push(fn)},'next/navigation':{usePathname:()=>'/subscription'},'@/i18n':{__esModule:true,default:{changeLanguage:l=>changed.push(l),on(){},off(){}}},'@/lib/localization':{...copy,validLanguage:v=>['en','hi','mr','kn','ta'].includes(v)}})(path.join(src,'components/i18n-provider.tsx')).default
  Page({children:null});const cleanup=effects[1]();assert.deepEqual(changed,[lang]);assert.equal(global.document.documentElement.lang,lang);cleanup()
 } } finally { Object.assign(global,saved) }
})


test('trainers can reach home while admin routes still redirect to their workspace',()=>{
  for (const pathname of ['/', '/admin']) {
    const effects=[],redirects=[]
    const Page=loader({react:{...React,useEffect:fn=>effects.push(fn),useSyncExternalStore:()=> 'trainer'},'next/navigation':{usePathname:()=>pathname,useRouter:()=>({replace:path=>redirects.push(path)})},'@/lib/localization':copy})(path.join(src,'components/training/TrainerAccessGuard.tsx')).default
    const child=React.createElement('p',null,'Home content');const tree=Page({children:child});effects.forEach(fn=>fn())
    if(pathname==='/'){assert.equal(tree,child);assert.deepEqual(redirects,[])}else assert.deepEqual(redirects,['/trainer'])
  }
})

test('pricing cards show structured limits and flags and preserve authored custom attribute text',()=>{
 const seed=[];seed[0]='monthly';seed[1]=[{id:'standard',name:'Standard',price:10,yearlyPrice:100,durationDays:30,color:'blue',features:['Obsolete prose'],missing:[],disabled:false,attributes:{resumeLimit:3,featuredJobs:false,support:'Open'}}];seed[3]=false;seed[6]=false;seed[11]=[{key:'resumeLimit',label:'Number of resumes allowed',type:'integer',unit:'resumes',system:true},{key:'featuredJobs',label:'Featured jobs',type:'boolean',unit:'',system:true},{key:'support',label:'Custom support',type:'text',unit:'',system:false}];
 const tree=harness('app/subscription/page.tsx',seed)();
 assert.ok(text(tree).includes('Number of resumes allowed'));assert.match(text(tree),/3\s+resumes/);assert.ok(text(tree).includes('No'));assert.ok(text(tree).includes('Open'));assert.ok(!text(tree).includes('Obsolete prose'));
});

test('plan boolean controls are real switches that emit booleans',()=>{
 const {ValueInput}=loader({'@/lib/localization':copy})(path.join(src,'components/admin/PlanCatalog.tsx'));let updated;
 const control=nodes(ValueInput({definition:{key:'apiAccess',label:'API Access',type:'boolean',system:true},value:false,onChange:v=>updated=v})).find(n=>n.props.role==='switch');
 assert.equal(control.props.role,'switch');assert.equal(control.props.checked,false);control.props.onChange({target:{checked:true}});assert.equal(updated,true);
});
test('comparison table follows live limits, screening level and toggles instead of a static matrix',()=>{
 const Component=loader({'@/lib/localization':copy})(path.join(src,'components/PlanComparison.tsx')).default;
 const definitions=[{key:'jobPostingLimit',label:'Job Postings'},{key:'aiScreening',label:'AI Screening'},{key:'socialPromotion',label:'Social Promotion'}];
 const plans=[{id:'premium',name:'Revised plan',attributes:{jobPostingLimit:7,aiScreening:true,aiScreeningLevel:'advanced',socialPromotion:true}}];
 let html=text(Component({plans,definitions}));assert.ok(html.includes('Revised plan'));assert.match(html,/7\s*\/\s*month/);assert.ok(html.includes('advanced'));assert.ok(html.includes('✓'));assert.ok(!html.includes('3/month'));
 plans[0].attributes.aiScreening=false;plans[0].attributes.socialPromotion=false;html=text(Component({plans,definitions}));assert.ok(!html.includes('advanced'));assert.ok(html.includes('✗'));
});
test('invoice navigation is removed for every role',()=>{
 const {getNavigation}=loader()(path.join(src,'lib/navigation.ts'));
 for(const role of ['employer','admin','super_admin','candidate','trainer']){const n=getNavigation(role),links=[...n.primary,...n.groups.flatMap(g=>g.items),...n.account];assert.ok(!links.some(l=>/\/invoices$/.test(l.href)));}
});
test('approved wage rows offer creation, then download per individual; drafts cannot invoice',()=>{
 const seed=[];seed[0]='token';seed[11]={id:'register',period:'2026-10',site:'Site',status:'approved',version:4,warnings:[],rows:[{employeeId:'001',name:'Employee',days:[],rate:595,payableDays:26}],invoices:[]};
 let tree=harness('components/payroll/WageRegisterWorkspace.tsx',seed)({readOnly:false});let create=nodes(tree).find(n=>n.type==='button'&&text(n)==='Create invoice');assert.ok(create);assert.equal(create.props.disabled,false);
 seed[11].invoices=[{employeeId:'001',number:'WAGE-test',total:13554}];tree=harness('components/payroll/WageRegisterWorkspace.tsx',seed)({readOnly:false});assert.ok(nodes(tree).some(n=>n.type==='button'&&text(n)==='Download invoice'));assert.ok(!nodes(tree).some(n=>n.type==='button'&&text(n)==='Create invoice'));
 seed[11]={...seed[11],invoices:[],status:'draft'};tree=harness('components/payroll/WageRegisterWorkspace.tsx',seed)({readOnly:false});create=nodes(tree).find(n=>n.type==='button'&&text(n)==='Create invoice');assert.equal(create.props.disabled,true);
});
