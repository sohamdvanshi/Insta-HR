const fs = require('fs');
const content = `'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')

  const stats = [
    { value: '50,000+', label: 'Active Jobs' },
    { value: '2M+', label: 'Candidates' },
    { value: '10,000+', label: 'Companies' },
    { value: '95%', label: 'Placement Rate' },
  ]

  const industries = [
    { name: 'IT', icon: '💻' },
    { name: 'Finance', icon: '💰' },
    { name: 'Banking', icon: '🏦' },
    { name: 'Healthcare', icon: '🏥' },
    { name: 'Manufacturing', icon: '🏭' },
    { name: 'Pharma', icon: '💊' },
    { name: 'Civil', icon: '🏗️' },
    { name: 'Automation', icon: '⚙️' },
    { name: 'Mechanical', icon: '🔧' },
    { name: 'Logistics', icon: '🚚' },
    { name: 'Others', icon: '📋' },
  ]

  const features = [
    {
      emoji: '🤖',
      title: 'AI Resume Matching',
      desc: 'Our AI engine reads your resume and matches it with jobs automatically, giving you a match score and skill gap analysis.'
    },
    {
      emoji: '📚',
      title: 'Training & Certification',
      desc: 'Learn new skills through video courses and live classes, get certified and increase your chances of getting hired.'
    },
    {
      emoji: '🏢',
      title: 'Outsourcing Services',
      desc: 'Companies can request outsourced teams, track deployment, manage contracts and attendance on one platform.'
    },
    {
      emoji: '⚡',
      title: 'One-Click Apply',
      desc: 'Apply to multiple jobs instantly with your saved profile. Track all your applications in one dashboard.'
    },
    {
      emoji: '🎯',
      title: 'Smart Job Alerts',
      desc: 'Get notified via email, push or SMS when new jobs matching your skills and preferences are posted.'
    },
    {
      emoji: '📊',
      title: 'Employer Analytics',
      desc: 'Employers get powerful analytics — application funnel, match rates, candidate insights and hiring reports.'
    },
  ]

  const steps = [
    { step: '01', title: 'Create Your Profile', desc: 'Sign up and build your professional profile with skills, experience and resume in minutes.', color: 'blue' },
    { step: '02', title: 'Get AI Matched', desc: 'Our AI engine scans your profile and matches you with the most relevant job opportunities.', color: 'purple' },
    { step: '03', title: 'Apply Instantly', desc: 'One-click apply to multiple jobs. Track your application status in real time.', color: 'green' },
    { step: '04', title: 'Get Hired', desc: 'Attend interviews, receive offers and land your dream job faster than ever before.', color: 'orange' },
  ]

  return (
    <main className="pt-16">

      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">

          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            AI-Powered Job Matching Platform
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
            Find Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Dream Job
            </span>
            {' '}with AI
          </h1>

          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            InstaHire uses cutting-edge AI to match your skills with perfect opportunities.
            Train, get certified, and get hired faster than ever before.
          </p>

          {/* Search Box */}
          <div className="bg-white rounded-2xl shadow-2xl p-3 flex flex-col md:flex-row gap-3 max-w-3xl mx-auto mb-6">
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Job title, skills, company..."
              className="flex-1 px-4 py-3 outline-none text-gray-700 rounded-xl"
            />
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Location..."
              className="w-48 px-4 py-3 outline-none text-gray-700 border-l border-gray-100 rounded-xl"
            />
            <Link
              href={"/jobs?keyword=" + keyword + "&location=" + location}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Search Jobs
            </Link>
          </div>

          <p className="text-gray-400 text-sm mb-12">
            Popular: React Developer, Data Analyst, Civil Engineer, Finance Manager
          </p>

          {/* Quick Links */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
              Get Started Free
            </Link>
            <Link href="/jobs" className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-blue-500 hover:text-blue-600 transition-colors">
              Browse Jobs
            </Link>
            <Link href="/subscription" className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors">
              For Employers
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">{value}</div>
              <div className="text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">How It Works</h2>
          <p className="text-gray-500 text-center mb-12">Get hired in 4 simple steps</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map(({ step, title, desc, color }) => (
              <div key={step} className="text-center">
                <div className={"w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 " + (
                  color === 'blue' ? 'bg-blue-600' :
                  color === 'purple' ? 'bg-purple-600' :
                  color === 'green' ? 'bg-green-600' : 'bg-orange-500'
                )}>
                  {step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">Explore by Industry</h2>
          <p className="text-gray-500 text-center mb-10">Find jobs across all major sectors</p>
          <div className="flex flex-wrap justify-center gap-3">
            {industries.map(({ name, icon }) => (
              <Link
                key={name}
                href={"/jobs?industry=" + name}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-md transition-all"
              >
                <span>{icon}</span>
                <span>{name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">Why Choose InstaHire?</h2>
          <p className="text-gray-500 text-center mb-12">Everything you need to hire or get hired</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map(({ emoji, title, desc }) => (
              <div key={title} className="bg-white p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{emoji}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
                <p className="text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Employers Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">For Employers</h2>
                <p className="text-blue-100 mb-6">
                  Post jobs, screen candidates with AI, schedule interviews and hire the best talent
                  faster than ever. Choose from our flexible subscription plans.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'AI-powered resume screening',
                    'Ranked candidate shortlists',
                    'Skill gap analysis',
                    'Interview scheduling',
                    'Bulk email to candidates',
                    'Social media job sharing',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2 text-blue-100">
                      <span className="text-green-400 font-bold">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-4">
                  <Link href="/register" className="px-6 py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors">
                    Start Hiring
                  </Link>
                  <Link href="/subscription" className="px-6 py-3 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-colors">
                    View Plans
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: '85%', label: 'Faster Hiring' },
                  { value: '3x', label: 'Better Matches' },
                  { value: '60%', label: 'Cost Savings' },
                  { value: '99%', label: 'Satisfaction' },
                ].map(({ value, label }) => (
                  <div key={label} className="bg-white/10 rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold mb-1">{value}</div>
                    <div className="text-blue-200 text-sm">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Training Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Learn, Certify & Get Hired</h2>
          <p className="text-gray-500 mb-12">Upskill with our training programs and stand out from the crowd</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            {[
              { emoji: '🎥', title: 'Video Courses', desc: 'Learn at your own pace with expert-led video courses across all industries.' },
              { emoji: '🔴', title: 'Live Classes', desc: 'Join live sessions with industry experts and get your questions answered in real time.' },
              { emoji: '🏆', title: 'Certifications', desc: 'Earn industry-recognized certificates that boost your profile and hiring chances.' },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="bg-white p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{emoji}</div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
                <p className="text-gray-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
          <Link href="/training" className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
            Explore Training Programs
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Find Your Dream Job?</h2>
          <p className="text-blue-100 mb-8 text-lg">Join 2 million candidates already using InstaHire</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors">
              Create Free Account
            </Link>
            <Link href="/jobs" className="px-8 py-4 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-colors">
              Browse Jobs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg" />
                <span className="text-xl font-bold text-white">InstaHire</span>
              </div>
              <p className="text-sm text-gray-500">AI-powered job portal connecting candidates, employers and training providers.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">For Candidates</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/jobs" className="hover:text-white transition-colors">Browse Jobs</Link></li>
                <li><Link href="/training" className="hover:text-white transition-colors">Training</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Create Profile</Link></li>
                <li><Link href="/applications" className="hover:text-white transition-colors">My Applications</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">For Employers</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/post-job" className="hover:text-white transition-colors">Post a Job</Link></li>
                <li><Link href="/subscription" className="hover:text-white transition-colors">Pricing Plans</Link></li>
                <li><Link href="/employer" className="hover:text-white transition-colors">Employer Dashboard</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© 2026 InstaHire. All rights reserved. Built with AI for the future of hiring.</p>
          </div>
        </div>
      </footer>

    </main>
  )
}
`;
fs.writeFileSync('src/app/page.tsx', content);
console.log('Home page created successfully!');