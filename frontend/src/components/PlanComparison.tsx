'use client'
import { tr,useLocale,locale } from '@/lib/localization'
import type { PlanAttributeDefinition } from '@/lib/planAttributes'
export default function PlanComparison({plans,definitions}:{plans:{id:string;name:string;attributes:Record<string,unknown>}[];definitions:PlanAttributeDefinition[]}){
 useLocale()
 const keys=['jobPostingLimit','resumeViewLimit','aiScreening','featuredJobs','socialPromotion','dedicatedSupport','accountManager','apiAccess']
 const rows=keys.map(key=>definitions.find(d=>d.key===key)).filter((d):d is PlanAttributeDefinition=>Boolean(d))
 function value(plan:typeof plans[number],key:string){const v=plan.attributes[key];if(key==='aiScreening')return v?tr(String(plan.attributes.aiScreeningLevel)):'✗';if(typeof v==='boolean')return v?'✓':'✗';if(v===null)return tr('Unlimited');if(typeof v==='number')return new Intl.NumberFormat(locale()).format(v)+' / '+tr('month');return String(v??'—')}
 return <div className="mt-16 overflow-hidden rounded-2xl border bg-white"><h2 className="border-b p-6 text-xl font-bold">{tr('Full Feature Comparison')}</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-4 text-left">{tr('Feature')}</th>{plans.map(p=><th key={p.id} className="p-4 text-center">{p.name}</th>)}</tr></thead><tbody>{rows.map(d=><tr key={d.key} className="border-t"><th className="p-4 text-left font-medium">{tr(d.label)}</th>{plans.map(p=><td className="p-4 text-center" key={p.id}>{value(p,d.key)}</td>)}</tr>)}</tbody></table></div></div>
}
