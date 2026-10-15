export type NavItem = { label: string; href: string; exact?: boolean }
export type NavGroup = { id: string; label: string; items: NavItem[] }
export type Navigation = { home: string; primary: NavItem[]; groups: NavGroup[]; account: NavItem[] }
const item = (label: string, href: string, exact = false): NavItem => ({ label, href, exact })
const group = (id: string, label: string, items: NavItem[]): NavGroup => ({ id, label, items })
export function getNavigation(role?: string): Navigation {
  const verification = item('Verify Certificate', '/training/certificate/verify')
  if (role === 'candidate') return {
    home: '/dashboard', primary: [item('Dashboard', '/dashboard', true), item('Find Jobs', '/jobs')],
    groups: [group('career', 'Career', [item('Resume Builder', '/resume'), item('My Applications', '/applications'), item('Saved Jobs', '/saved-jobs'), item('Referrals', '/referrals')]), group('learning', 'Learning', [item('Training', '/training', true), item('My Learning', '/training/my-learning'), item('My classes', '/training/classes'), item('My Certificates', '/training/my-certificates'), verification])],
    account: [item('Profile', '/profile'), item('Upgrade Plan', '/subscription')]
  }
  if (role === 'employer') return {
    home: '/employer', primary: [item('Dashboard', '/employer', true), item('Post Job', '/post-job')],
    groups: [
      group('hiring', 'Hiring', [item('Resume Databank', '/employer/candidates'), item('AI Screening', '/ai-screening'), item('AI Match', '/ai-match'), item('Email Campaigns', '/employer/campaigns'), item('Referral Tracking', '/employer/referrals'), item('Analytics', '/employer/analytics')]),
      group('operations', 'Operations', [item('Manpower Requests', '/employer/manpower-requests'), item('Deployments', '/employer/deployments'), item('Contracts', '/employer/contracts'), item('Attendance', '/employer/attendance')]),
      group('finance', 'Finance', [item('Wage registers', '/employer/wage-register'), item('Payroll', '/employer/payrolls'), item('Invoices', '/employer/invoices')]),
      group('resources', 'Resources', [item('Find Jobs', '/jobs'), item('Training', '/training'), verification])
    ], account: [item('Company profile', '/employer/profile'), item('Upgrade Plan', '/subscription')]
  }
  if (role === 'admin' || role === 'super_admin') {
    const superAdmin = role === 'super_admin', root = superAdmin ? '/super-admin' : '/admin'
    return { home: root, primary: [item('Dashboard', root, true)], groups: [
      group('people', 'People', [item('Candidates', `${root}/candidates`), item('Employers', `${root}/employers`), item('Users', `${root}/users`)]),
      group('hiring', 'Hiring', [item('Jobs', '/admin/jobs'), item('Applications', `${root}/applications`), item('Analytics', '/admin/analytics')]),
      group('finance', 'Finance', [item('Payments', `${root}/payments`), item('Invoices', `${root}/invoices`), ...(superAdmin ? [item('Wage registers', '/super-admin/wage-register')] : [])]),
      group('training', 'Training', [item('Courses', '/admin/courses'), item('Training & Classes', '/admin/training'), verification]),
      group('system', superAdmin ? 'System Control' : 'Team tools', [item('Internal Communication', `${root}/communication`), item('Audit Logs', `${root}/audit-logs`), item('Audit & Fraud', '/admin/audit'), item('Support', '/admin/support'), ...(superAdmin ? [item('Staff & Roles', '/super-admin/staff'), item('Plans & Perks', '/super-admin/plans'), item('Feature Flags', '/super-admin/feature-flags'), item('Infrastructure', '/super-admin/infrastructure')] : [])])
    ], account: [] }
  }
  if (role === 'trainer') return { home: '/trainer', primary: [item('Dashboard', '/trainer', true)], groups: [group('training', 'Training', [item('Courses', '/trainer/courses'), item('Batches, classes & attendance', '/trainer', true), verification])], account: [] }
  return { home: '/', primary: [item('Find Jobs', '/jobs'), item('Training', '/training')], groups: [group('resources', 'Resources', [verification, item('Pricing', '/subscription'), item('For Employers', '/register')])], account: [] }
}
export function isNavActive(pathname: string, item: NavItem) {
  return pathname === item.href || (!item.exact && item.href !== '/' && pathname.startsWith(item.href + '/'))
}
