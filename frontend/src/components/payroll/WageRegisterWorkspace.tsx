'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
const fields = [ ['rate','Daily wage rate'], ['overtimeHours','Overtime hours'], ['specialBasic','Special Basic'], ['da','DA'], ['hra','HRA'], ['otherEarnings','Other earnings'], ['society','Society'], ['incomeTax','Income Tax'], ['insurance','Insurance'], ['otherDeductions','Other deductions'], ['recoveries','Recoveries'], ['employerContribution','Employer PF / welfare contribution'] ] as const;
type Day = { date: string; code: string };
type Employee = { employeeId: string; name: string; group: string; designation: string; location: string; days: Day[]; payableDays: number; presentDays: number; holidayDays: number; weeklyOffs: number; uan: string; transactionId: string; paymentDate: string; remarks: string } & Record<typeof fields[number][0], number | string>;
type Register = { id: string; employerId: string; period: string; site: string; status: string; version: number; rows: Employee[]; warnings: string[]; sourceName: string };
type Summary = Pick<Register,'id'|'employerId'|'period'|'site'|'status'>;
const input = 'w-full rounded border border-slate-300 bg-white p-2 text-slate-900 disabled:bg-slate-100';
const button = 'rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50';
const round = (n:number) => Math.round((n + Number.EPSILON)*100)/100;
function amounts(r:Employee) {
  const n = (k:typeof fields[number][0]) => Number(r[k] || 0);
  const basic=round(n('rate')*r.payableDays), overtime=round(n('rate')/4*n('overtimeHours'));
  const earnings=round(basic+overtime+n('specialBasic')+n('da')+n('hra')+n('otherEarnings'));
  const pf=round(Math.min(basic,15000)*0.12), esic=Math.round(earnings*0.0075);
  const deductions=round(pf+esic+n('society')+n('incomeTax')+n('insurance')+n('otherDeductions')+n('recoveries'));
  return { basic,overtime,earnings,pf,esic,deductions,net:round(earnings-deductions) };
}
const money = (n:number) => n.toLocaleString('en-IN',{style:'currency',currency:'INR'});
export default function WageRegisterWorkspace({ readOnly=false }: { readOnly?: boolean }) {
  const [token,setToken]=useState(''), [error,setError]=useState(''), [success,setSuccess]=useState(''), [busy,setBusy]=useState(false);
  const [period,setPeriod]=useState(''), [site,setSite]=useState(''), [file,setFile]=useState<File|null>(null), [preview,setPreview]=useState<{rows:Employee[];warnings:string[]}|null>(null);
  const [list,setList]=useState<Summary[]>([]), [page,setPage]=useState(1), [pages,setPages]=useState(1);
  const [register,setRegister]=useState<Register|null>(null), [dirty,setDirty]=useState(false), [selected,setSelected]=useState<string[]>([]), [editing,setEditing]=useState('');
  const [bulk,setBulk]=useState<Record<string,string>>({}), [group,setGroup]=useState(''), [filter,setFilter]=useState('');
  useEffect(()=>{ setToken(localStorage.getItem('token')||localStorage.getItem('accessToken')||''); },[]);
  async function request(path:string, method='GET', body?:unknown) {
    const form=body instanceof FormData;
    const res=await fetch(API+'/wage-registers'+path,{method,headers:{Authorization:`Bearer ${token}`,...(!form&&body?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:form?body:JSON.stringify(body)});
    const data=await res.json(); if(!res.ok) throw new Error(data.message||'Request failed'); return data;
  }
  async function perform(fn:()=>Promise<void>) { setBusy(true);setError('');setSuccess('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);} }
  async function refresh() { const d=await request(`?page=${page}${period?'&period='+period:''}`);setList(d.data);setPages(Math.max(1,d.pagination.pages)); }
  useEffect(()=>{if(token) void perform(refresh);},[token,page,period]); // eslint-disable-line react-hooks/exhaustive-deps
  function uploadBody() { if(!file) throw new Error('Choose an attendance .xlsx file');const f=new FormData();f.append('file',file);f.append('period',period);f.append('site',site);if(register)f.append('version',String(register.version));return f; }
  const writable=!readOnly&&register?.status==='draft';
  function edit(id:string,key:string,value:string) { setRegister(r=>r?{...r,rows:r.rows.map(e=>e.employeeId===id?{...e,[key]:value}:e)}:null);setDirty(true); }
  function applyGroup() {
    if(!selected.length){setError('Select at least one employee');return;}
    const changes=Object.fromEntries(Object.entries(bulk).filter(([,v])=>v!==''));
    if(!Object.keys(changes).length&&!group.trim()){setError('Enter a value or group name to apply');return;}
    setRegister(r=>r?{...r,rows:r.rows.map(e=>selected.includes(e.employeeId)?{...e,...changes,...(group.trim()?{group:group.trim()}:{})}:e)}:null);
    setDirty(true);setSuccess(`Updated ${selected.length} selected employees. Save to persist changes.`);
  }
  const current=register?.rows.find(r=>r.employeeId===editing);
  const shown=register?.rows.filter(r=>!filter||r.group===filter)||[];
  const total=register?.rows.reduce((t,r)=>{const a=amounts(r);return {earnings:t.earnings+a.earnings,deductions:t.deductions+a.deductions,net:t.net+a.net};},{earnings:0,deductions:0,net:0});
  async function download() {
    if(!register)return;
    const res=await fetch(`${API}/wage-registers/${register.id}/export`,{headers:{Authorization:`Bearer ${token}`}});
    if(!res.ok){const d=await res.json();throw new Error(d.message||'Export failed');}
    const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download=`wage-register-${register.period}.xlsx`;a.click();URL.revokeObjectURL(url);
  }
  return <div className="space-y-6 text-slate-900">
    <p className="rounded bg-blue-50 p-4">Workbook policy: payable days = P + PH (H is mapped to PH). Weekly offs and leave codes are excluded. Basic = daily rate × payable days; overtime = daily rate ÷ 4 × hours. PF = 12% of Basic capped at ₹15,000; ESIC = 0.75% of total earnings rounded to a rupee. Employer contributions are separate.</p>
    {error&&<p role="alert" className="rounded bg-red-50 p-4 text-red-800">{error}</p>}{success&&<p role="status" className="rounded bg-green-50 p-4">{success}</p>}
    {!token&&<p>Sign in to access wage registers. <Link href="/login" className="underline">Login</Link></p>}
    <label className="block max-w-xs">Payroll month / list filter<input className={input} type="month" disabled={busy} value={period} onChange={e=>{setPeriod(e.target.value);setPage(1);setPreview(null);}}/></label>
    {!readOnly&&<section className="rounded border bg-white p-4 space-y-3"><h2 className="text-xl font-semibold">Import monthly attendance</h2><p>Use the supplied attendance .xlsx template with employee IDs and date headers. Excel summary formulas are ignored. Imported employees need no portal account.</p>
      <label className="block">Site / establishment<input className={input} maxLength={100} disabled={busy} value={site} onChange={e=>{setSite(e.target.value);setPreview(null);}}/></label>
      <label className="block">Attendance workbook<input className={input} type="file" disabled={busy} accept=".xlsx" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);}}/></label>
      <button className={button} disabled={busy||!token||dirty} onClick={()=>void perform(async()=>setPreview((await request('/preview','POST',uploadBody())).data))}>Preview attendance</button>
      {preview&&<><ul>{preview.warnings.map(w=><li key={w}>{w}</li>)}</ul><div className="max-h-80 overflow-auto"><table className="w-full text-left"><thead><tr>{['Employee ID','Name','Present','Public holidays','Weekly offs','Payable','Blank days'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{preview.rows.map(r=><tr key={r.employeeId}><td>{r.employeeId}</td><td>{r.name}</td><td>{r.presentDays}</td><td>{r.holidayDays}</td><td>{r.weeklyOffs}</td><td>{r.payableDays}</td><td>{r.days.filter(d=>!d.code).length}</td></tr>)}</tbody></table></div>
      <button className={button} disabled={busy||dirty} onClick={()=>void perform(async()=>{const d=await request('','POST',uploadBody());setRegister(d.data);setPreview(null);setSelected([]);setEditing('');setDirty(false);await refresh();setSuccess('Draft imported. Enter wages before approval.');})}>Confirm import and create draft</button>
      {writable&&register.period===period&&register.site===site&&<button className={button+' ml-3'} disabled={busy||dirty} onClick={()=>void perform(async()=>{const d=await request('/'+register.id+'/attendance','POST',uploadBody());setRegister(d.data);setPreview(null);setSelected([]);setEditing('');setDirty(false);setSuccess('Attendance replaced. Wage settings retained for matching employee IDs; review all totals.');})}>Replace attendance in open draft</button>}
      <p className="text-sm">Replacing a draft keeps wage settings for matching employee IDs, removes employees absent from the new file and adds new employees with zero rates. Review before approval.</p></>}
    </section>}
    <section className="rounded border bg-white p-4"><h2 className="text-xl font-semibold">Saved registers</h2><ul className="divide-y">{list.map(r=><li key={r.id} className="flex flex-wrap items-center gap-3 py-3"><span>{r.period} · {r.site} · {r.status}{readOnly&&` · Employer ${r.employerId}`}</span><button className={button} disabled={busy||dirty} onClick={()=>void perform(async()=>{setRegister((await request('/'+r.id)).data);setSelected([]);setEditing('');setFilter('');setDirty(false);})}>Open</button></li>)}</ul>{!list.length&&<p>No registers found.</p>}<div className="flex gap-3 mt-3"><button disabled={busy||dirty||page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} / {pages}</span><button disabled={busy||dirty||page>=pages} onClick={()=>setPage(p=>p+1)}>Next</button></div></section>
    {register&&<section className="rounded border bg-white p-4 space-y-4"><h2 className="text-xl font-semibold">{register.site} · {register.period} · {register.status}</h2><p>Source: {register.sourceName}. {dirty?'Unsaved changes — save before export, approval or opening another register.':''}</p>
      <div className="flex flex-wrap gap-3">{writable&&<><button className={button} disabled={busy||!dirty} onClick={()=>void perform(async()=>{setRegister((await request('/'+register.id,'PUT',{version:register.version,rows:register.rows})).data);setDirty(false);setSuccess('Wages saved.');})}>Save wages</button><button className={button} disabled={busy||dirty} onClick={()=>void perform(async()=>{setRegister((await request('/'+register.id+'/approve','POST',{version:register.version})).data);await refresh();setSuccess('Register approved and locked.');})}>Approve and lock</button><button disabled={busy||!dirty} className="underline" onClick={()=>void perform(async()=>{setRegister((await request('/'+register.id)).data);setDirty(false);setSuccess('Unsaved edits discarded.');})}>Discard unsaved edits</button></>}
      <button className={button} disabled={busy||dirty} onClick={()=>void perform(download)}>Export Excel with formulas</button></div>
      {register.status==='draft'&&<p>Approval locks this register. Verify wages, attendance and deductions first. This does not transfer money or mark an employee paid.</p>}
      <label className="block max-w-xs">Filter wage group<select className={input} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All employees</option>{Array.from(new Set(register.rows.map(r=>r.group).filter(Boolean))).map(g=><option key={g}>{g}</option>)}</select></label>
      {writable&&<details className="rounded border p-3"><summary className="cursor-pointer font-semibold">Apply values to selected employees ({selected.length})</summary><p className="my-2">Blank fields keep each employee’s value. Enter 0 to clear an amount. Attendance and payable days remain individual.</p><div className="grid gap-3 sm:grid-cols-3"><label>Group name<input className={input} maxLength={200} value={group} onChange={e=>setGroup(e.target.value)}/></label>{fields.map(([k,label])=><label key={k}>{label}<input className={input} type="number" min="0" step="0.01" value={bulk[k]||''} onChange={e=>setBulk({...bulk,[k]:e.target.value})}/></label>)}</div><button className={button+' mt-3'} disabled={busy} onClick={applyGroup}>Apply to selected</button></details>}
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead><tr>{writable&&<th><input aria-label="Select visible employees" type="checkbox" checked={shown.length>0&&shown.every(r=>selected.includes(r.employeeId))} onChange={e=>setSelected(e.target.checked?Array.from(new Set([...selected,...shown.map(r=>r.employeeId)])):selected.filter(id=>!shown.some(r=>r.employeeId===id)))}/></th>}{['Employee','Group','Payable days','Rate','Basic','OT','Total earnings','PF','ESIC','Deductions','Net','Details'].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{shown.map(r=>{const a=amounts(r);return <tr key={r.employeeId} className="border-t">{writable&&<td><input aria-label={`Select ${r.name}`} type="checkbox" checked={selected.includes(r.employeeId)} onChange={e=>setSelected(e.target.checked?[...selected,r.employeeId]:selected.filter(id=>id!==r.employeeId))}/></td>}<td className="p-2">{r.name} ({r.employeeId})</td><td>{r.group||'—'}</td><td>{r.payableDays}</td><td>{money(Number(r.rate))}</td>{[a.basic,a.overtime,a.earnings,a.pf,a.esic,a.deductions,a.net].map((v,i)=><td className={'p-2 '+(i===6&&v<0?'text-red-700':'')} key={i}>{money(v)}</td>)}<td><button className="text-blue-700 underline" onClick={()=>setEditing(r.employeeId)}>View / edit</button></td></tr>;})}</tbody></table></div>
      {total&&<p className="font-semibold">All employees: Earnings {money(total.earnings)} · Deductions {money(total.deductions)} · Net {money(total.net)}</p>}
      {current&&<div className="rounded border bg-slate-50 p-4 space-y-3"><h3 className="font-semibold">{current.name} ({current.employeeId})</h3><p>Present {current.presentDays} + public holidays {current.holidayDays} = {current.payableDays} payable days; weekly offs {current.weeklyOffs} excluded.</p><div className="grid gap-3 sm:grid-cols-3">{fields.map(([k,label])=><label key={k}>{label}<input className={input} disabled={!writable||busy} type="number" min="0" step="0.01" value={current[k]} onChange={e=>edit(current.employeeId,k,e.target.value)}/></label>)}{[['uan','UAN (12 digits)'],['group','Wage group'],['transactionId','Bank transaction / receipt ID'],['paymentDate','Payment date'],['remarks','Remarks']].map(([k,label])=><label key={k}>{label}<input className={input} disabled={!writable||busy} type={k==='paymentDate'?'date':'text'} value={String(current[k as keyof Employee]||'')} onChange={e=>edit(current.employeeId,k,e.target.value)}/></label>)}</div><details><summary>Daily attendance</summary><div className="flex flex-wrap gap-2">{current.days.map(d=><span className="rounded border p-2" key={d.date}>{d.date}: {d.code||'BLANK'}</span>)}</div></details></div>}
    </section>}
  </div>;
}
