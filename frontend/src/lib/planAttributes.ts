export type PlanAttributeDefinition={key:string;label:string;type:string;unit:string;system:boolean;enforced:boolean}
export function attributeRows(values:Record<string,unknown>,definitions:PlanAttributeDefinition[]) {
 return definitions.filter(d=>!['amountPaise','yearlyAmountPaise','durationDays'].includes(d.key) && (d.key!=='aiScreeningLevel'||values.aiScreening===true)).map(d=>({...d,value:values[d.key]}))
}
