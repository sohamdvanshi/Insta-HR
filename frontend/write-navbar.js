const fs = require('fs');
const content = `'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface NavUser {
  email: string
  role: string
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<NavUser | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const parsed: NavUser | null = userData ? JSON.parse(userData) : null
    setTimeout(() => setUser(parsed), 0)
  }, [pathname])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    window.location.href = '/'
  }

  const getDashboardLink = () => {
    if (!user) return '/dashboard'
    if (user.role === 'admin') return '/admin'
    if (user.role === 'employer') return '/employer'
    return '/dashboard'
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">

        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg" />
          <span className="text-xl font-bold text-gray-900">InstaHire</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <Link href="/jobs" className="hover:text-blue-600 transition-colors">Find Jobs</Link>
          <Link href="/training" className="hover:text-blue-600 transition-colors">Training</Link>
          {user?.role === 'employer' && (
            <Link href="/post-job" className="hover:text-blue-600 transition-colors">Post a Job</Link>
          )}
          {user?.role === 'employer' && (
            <Link href="/subscription" className="hover:text-blue-600 transition-colors">Upgrade Plan</Link>
          )}
          {user?.role === 'candidate' && (
            <Link href="/applications" className="hover:text-blue-600 transition-colors">My Applications</Link>
          )}
          {!user && (
            <Link href="/subscription" className="hover:text-blue-600 transition-colors">Pricing</Link>
          )}
          {!user && (
            <Link href="/register" className="hover:text-blue-600 transition-colors">For Employers</Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href={getDashboardLink()}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2">
          <div className="w-5 h-0.5 bg-gray-600 mb-1" />
          <div className="w-5 h-0.5 bg-gray-600 mb-1" />
          <div className="w-5 h-0.5 bg-gray-600" />
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4">
          <Link href="/jobs" className="text-gray-700 font-medium">Find Jobs</Link>
          <Link href="/training" className="text-gray-700 font-medium">Training</Link>
          {user?.role === 'employer' && (
            <Link href="/post-job" className="text-gray-700 font-medium">Post a Job</Link>
          )}
          {user?.role === 'employer' && (
            <Link href="/subscription" className="text-gray-700 font-medium">Upgrade Plan</Link>
          )}
          {user?.role === 'candidate' && (
            <Link href="/applications" className="text-gray-700 font-medium">My Applications</Link>
          )}
          {!user && (
            <Link href="/subscription" className="text-gray-700 font-medium">Pricing</Link>
          )}
          {!user && (
            <Link href="/register" className="text-gray-700 font-medium">For Employers</Link>
          )}
          {user ? (
            <>
              <Link href={getDashboardLink()} className="text-gray-700 font-medium">Dashboard</Link>
              <button onClick={logout} className="text-left text-red-500 font-medium">Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-700 font-medium">Login</Link>
              <Link href="/register" className="text-center px-4 py-2 text-white bg-blue-600 rounded-lg font-medium">Get Started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
`;
fs.writeFileSync('src/components/Navbar.tsx', content);
console.log('Navbar updated successfully!');