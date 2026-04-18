'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface NavUser {
  email: string;
  role: string;
  firstName?: string;
  name?: string;
}

type NavItem = {
  label: string;
  href: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export default function Navbar() {
  const { t } = useTranslation();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [user, setUser] = useState<NavUser | null>(null);
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      const parsed: NavUser | null = userData ? JSON.parse(userData) : null;
      setUser(parsed);
    } catch {
      setUser(null);
    }

    setIsMobileOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  };

  const getDashboardLink = () => {
    if (!user) return '/dashboard';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'employer') return '/employer';
    return '/dashboard';
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isGroupActive = (items: NavItem[]) => {
    return items.some((item) => isActive(item.href));
  };

  const desktopLinkClass = (href: string) =>
    'transition-colors ' +
    (isActive(href)
      ? 'font-semibold text-blue-600'
      : 'text-gray-600 hover:text-blue-600');

  const mobileLinkClass = (href: string) =>
    'block rounded-lg px-2 py-1 font-medium transition-colors ' +
    (isActive(href)
      ? 'text-blue-600'
      : 'text-gray-700 hover:text-blue-600');

  const dropdownButtonClass = (active: boolean) =>
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
    (active
      ? 'bg-blue-50 text-blue-700'
      : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600');

  const publicLinks: NavItem[] = [
    { label: t('findJobs'), href: '/jobs' },
    { label: t('training'), href: '/training' },
    { label: t('verifyCertificate'), href: '/training/certificate/verify' },
  ];

  const guestLinks: NavItem[] = [
    { label: t('pricing'), href: '/subscription' },
    { label: t('forEmployers'), href: '/register' },
  ];

  const candidateLinks: NavItem[] = [
    { label: t('resumeBuilder'), href: '/resume' },
    { label: t('myLearning'), href: '/training/my-learning' },
    { label: t('myCertificates'), href: '/training/my-certificates' },
    { label: t('myApplications'), href: '/applications' },
    { label: t('savedJobs'), href: '/saved-jobs' },
  ];

  const employerGroups: NavGroup[] = [
    {
      label: t('hiring'),
      items: [
        { label: t('postJob'), href: '/post-job' },
        { label: t('resumeDatabank'), href: '/employer/candidates' },
        { label: t('emailCampaigns'), href: '/employer/campaigns' },
        { label: t('analytics'), href: '/employer/analytics' },
      ],
    },
    {
      label: t('operations'),
      items: [
        { label: t('manpowerRequests'), href: '/employer/manpower-requests' },
        { label: t('deployments'), href: '/employer/deployments' },
        { label: t('contracts'), href: '/employer/contracts' },
        { label: t('attendance'), href: '/employer/attendance' },
      ],
    },
    {
      label: t('finance'),
      items: [
        { label: t('payroll'), href: '/employer/payrolls' },
        { label: t('invoices'), href: '/employer/invoices' },
        { label: t('upgradePlan'), href: '/subscription' },
      ],
    },
  ];

  const adminGroups: NavGroup[] = [
    {
      label: t('admin'),
      items: [
        { label: t('dashboard'), href: '/admin' },
        { label: t('analytics'), href: '/admin/analytics' },
        { label: t('auditFraud'), href: '/admin/audit' },
      ],
    },
  ];

  const userMode = useMemo(() => {
    if (!user) return 'guest';
    if (user.role === 'candidate') return 'candidate';
    if (user.role === 'employer') return 'employer';
    if (user.role === 'admin') return 'admin';
    return 'guest';
  }, [user]);

  const toggleDropdown = (label: string) => {
    setOpenDropdown((prev) => (prev === label ? null : label));
  };

  const renderDesktopDropdown = (group: NavGroup) => {
    const active = isGroupActive(group.items);
    const isOpen = openDropdown === group.label;

    return (
      <div key={group.label} className="relative">
        <button
          type="button"
          onClick={() => toggleDropdown(group.label)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className={dropdownButtonClass(active)}
        >
          {group.label}
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'block rounded-xl px-4 py-3 text-sm transition-colors ' +
                  (isActive(item.href)
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600')
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMobileGroup = (group: NavGroup) => {
    const open = openDropdown === `mobile-${group.label}`;

    return (
      <div key={group.label} className="rounded-2xl border border-gray-100 bg-gray-50">
        <button
          type="button"
          onClick={() => toggleDropdown(`mobile-${group.label}`)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-800"
        >
          <span>{group.label}</span>
          <svg
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && (
          <div className="flex flex-col gap-2 px-4 pb-4">
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className={mobileLinkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white shadow-sm"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600" />
          <span className="text-xl font-bold text-gray-900">{t('appName')}</span>
        </Link>

        <div className="hidden items-center gap-4 text-sm font-medium md:flex">
          {publicLinks.map((link) => (
            <Link key={link.href} href={link.href} className={desktopLinkClass(link.href)}>
              {link.label}
            </Link>
          ))}

          {userMode === 'guest' &&
            guestLinks.map((link) => (
              <Link key={link.href} href={link.href} className={desktopLinkClass(link.href)}>
                {link.label}
              </Link>
            ))}

          {userMode === 'candidate' &&
            candidateLinks.map((link) => (
              <Link key={link.href} href={link.href} className={desktopLinkClass(link.href)}>
                {link.label}
              </Link>
            ))}

          {userMode === 'employer' && employerGroups.map(renderDesktopDropdown)}

          {userMode === 'admin' && adminGroups.map(renderDesktopDropdown)}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />

          {user ? (
            <>
              <div className="hidden text-right lg:block">
                <p className="text-sm font-semibold text-gray-900">
                  {user.firstName || user.name || user.email}
                </p>
                <p className="text-xs capitalize text-gray-500">{user.role}</p>
              </div>

              <Link
                href={getDashboardLink()}
                className={
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors ' +
                  (isActive('/admin') || isActive('/employer') || isActive('/dashboard')
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:text-blue-600')
                }
              >
                {t('dashboard')}
              </Link>

              <button
                onClick={logout}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                {t('logout')}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-blue-600"
              >
                {t('login')}
              </Link>

              <Link
                href="/register"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t('signup')}
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 md:hidden"
          aria-label="Toggle menu"
        >
          <div className="mb-1 h-0.5 w-5 bg-gray-600" />
          <div className="mb-1 h-0.5 w-5 bg-gray-600" />
          <div className="h-0.5 w-5 bg-gray-600" />
        </button>
      </div>

      {isMobileOpen && (
        <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <div className="pb-2">
              <LanguageSwitcher />
            </div>

            <div className="flex flex-col gap-3">
              {publicLinks.map((link) => (
                <Link key={link.href} href={link.href} className={mobileLinkClass(link.href)}>
                  {link.label}
                </Link>
              ))}
            </div>

            {userMode === 'guest' && (
              <div className="flex flex-col gap-3">
                {guestLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={mobileLinkClass(link.href)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {userMode === 'candidate' && (
              <div className="flex flex-col gap-3">
                {candidateLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={mobileLinkClass(link.href)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {userMode === 'employer' && employerGroups.map(renderMobileGroup)}

            {userMode === 'admin' && adminGroups.map(renderMobileGroup)}

            {user ? (
              <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                <Link href={getDashboardLink()} className={mobileLinkClass(getDashboardLink())}>
                  {t('dashboard')}
                </Link>

                <button onClick={logout} className="text-left font-medium text-red-500">
                  {t('logout')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                <Link href="/login" className={mobileLinkClass('/login')}>
                  {t('login')}
                </Link>

                <Link
                  href="/register"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-center font-medium text-white"
                >
                  {t('signup')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}