'use client';
import { AdminFrame } from '@/components/admin/AdminShell';
import WageRegisterWorkspace from '@/components/payroll/WageRegisterWorkspace';
export default function Page() { return <AdminFrame title="Employer wage registers" description="View employer wage registers and their approval status. Employers manage approvals."><WageRegisterWorkspace readOnly/></AdminFrame>; }
