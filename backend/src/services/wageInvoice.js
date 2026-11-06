const { randomUUID }=require('crypto');
const { normalizeRows }=require('./wageCalculation');
function snapshot(register,employeeId){
 const employee=normalizeRows(register.rows).find(row=>row.employeeId===employeeId);
 if(!employee)throw Object.assign(new Error('Employee not found in register'),{status:404});
 if(employee.net<0)throw Object.assign(new Error('Net payable cannot be negative'),{status:400});
 const number='WAGE-'+randomUUID();
 return {number,employeeId:employee.employeeId,registerId:register.id,registerVersion:register.version,date:new Date().toISOString(),seller:register.site,buyer:employee.name,currency:'INR',subtotal:employee.net,tax:0,total:employee.net,employee,period:register.period,site:register.site,description:`Wages for ${register.period} at ${register.site}\nEmployee ID: ${employee.employeeId}\nDesignation: ${employee.designation || '-'}\nPayable days: ${employee.payableDays}\nDaily wage rate: INR ${Number(employee.rate).toFixed(2)}\nGross earnings: INR ${employee.earnings.toFixed(2)}\nTotal deductions: INR ${employee.deductions.toFixed(2)}\nNet payable: INR ${employee.net.toFixed(2)}`,terms:'Amount is the approved net payable. Creating this invoice does not record payment or transfer funds.'};
}
module.exports={snapshot};
