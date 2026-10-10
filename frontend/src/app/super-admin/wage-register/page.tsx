'use client';
import { AdminFrame } from '@/components/admin/AdminShell';
import WageRegisterWorkspace from '@/components/payroll/WageRegisterWorkspace';
export default function Page() { return <AdminFrame title="Employer wage registers" description="Read-only attendance, earnings and deductions across employers."><WageRegisterWorkspace readOnly/></AdminFrame>; }
