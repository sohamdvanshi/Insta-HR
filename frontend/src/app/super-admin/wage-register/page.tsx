'use client';
import { AdminFrame } from '@/components/admin/AdminShell';
import WageRegisterWorkspace from '@/components/payroll/WageRegisterWorkspace';
export default function Page() { return <AdminFrame title="Employer wage registers" description="Review submitted wage registers, approve them or return them for corrections."><WageRegisterWorkspace readOnly/></AdminFrame>; }
