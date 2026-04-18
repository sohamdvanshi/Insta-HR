'use client'

import { useEffect, useRef, useState } from 'react'

interface ShareJobButtonProps {
  job: {
    id: string
    title: string
    location?: string
  }
}

export default function ShareJobButton({ job }: ShareJobButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState('')
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const jobUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/jobs/${job.id}`
      : ''

  const shareText = `Check out this job: ${job.title}${job.location ? ` in ${job.location}` : ''}`

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${jobUrl}`)}`
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const showToastMessage = (text: string) => {
    setToast(text)
    setTimeout(() => setToast(''), 2200)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: job.title,
          text: shareText,
          url: jobUrl,
        })
        return
      } catch {
        setShowMenu(true)
        return
      }
    }

    setShowMenu((prev) => !prev)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl)
      setCopied(true)
      setShowMenu(false)
      showToastMessage('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToastMessage('Failed to copy link')
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={handleShare}
        aria-haspopup="menu"
        aria-expanded={showMenu}
        aria-label="Share this job"
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 ${
          copied
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        {copied ? <CheckIcon /> : <ShareIcon />}
        <span>{copied ? 'Copied' : 'Share'}</span>
        <ChevronDownIcon open={showMenu} />
      </button>

      {showMenu && (
        <div className="absolute right-0 z-50 mt-3 w-72 origin-top-right animate-in rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl">
          <div className="absolute -top-2 right-5 h-4 w-4 rotate-45 border-l border-t border-gray-200 bg-white" />

          <div className="relative rounded-xl bg-white">
            <div className="border-b border-gray-100 px-3 py-3">
              <p className="text-sm font-semibold text-gray-900">Share this job</p>
              <p className="mt-1 line-clamp-1 text-xs text-gray-500">{job.title}</p>
            </div>

            <div className="py-2">
              <ShareLink
                href={whatsappUrl}
                label="WhatsApp"
                icon={<WhatsAppIcon />}
                hoverClass="hover:bg-green-50"
              />

              <ShareLink
                href={linkedinUrl}
                label="LinkedIn"
                icon={<LinkedInIcon />}
                hoverClass="hover:bg-blue-50"
              />

              <ShareLink
                href={facebookUrl}
                label="Facebook"
                icon={<FacebookIcon />}
                hoverClass="hover:bg-blue-50"
              />

              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <LinkIcon />
                <span>Copy link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute left-0 top-full z-50 mt-3 whitespace-nowrap rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <style jsx>{`
        .animate-in {
          animation: dropdownIn 0.18s ease-out;
        }

        @keyframes dropdownIn {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}

function ShareLink({
  href,
  label,
  icon,
  hoverClass,
}: {
  href: string
  label: string
  icon: React.ReactNode
  hoverClass: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors ${hoverClass}`}
    >
      {icon}
      <span>{label}</span>
    </a>
  )
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51 15.42 17.49" />
      <path d="M15.41 6.51 8.59 10.49" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 transition-transform duration-200"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-gray-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l1.92-1.92a5 5 0 0 0-7.07-7.07L11.3 5.64" />
      <path d="M14 11a5 5 0 0 0-7.54-.54L4.54 12.38a5 5 0 0 0 7.07 7.07l1.93-1.93" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        fill="#25D366"
        d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .17 5.33.17 11.89c0 2.1.55 4.15 1.6 5.96L0 24l6.34-1.66a11.83 11.83 0 0 0 5.72 1.46h.01c6.56 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.17-3.44-8.43ZM12.07 21.8h-.01a9.82 9.82 0 0 1-5-1.36l-.36-.21-3.76.99 1-3.66-.23-.38a9.8 9.8 0 0 1-1.51-5.27C2.2 6.5 6.66 2.03 12.07 2.03a9.8 9.8 0 0 1 6.97 2.89 9.77 9.77 0 0 1 2.88 6.97c0 5.41-4.45 9.91-9.85 9.91Zm5.43-7.38c-.3-.15-1.77-.88-2.05-.97-.27-.1-.47-.15-.66.15-.2.3-.76.97-.93 1.17-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.37-1.47-.88-.78-1.47-1.74-1.64-2.03-.17-.3-.02-.46.13-.61.13-.13.3-.34.44-.5.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.19-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.52.08-.79.37-.27.3-1.04 1.01-1.04 2.46s1.06 2.85 1.2 3.05c.15.2 2.07 3.16 5.02 4.43.7.3 1.26.48 1.69.61.71.22 1.36.19 1.87.11.57-.08 1.77-.72 2.02-1.41.25-.7.25-1.29.17-1.41-.08-.12-.27-.2-.57-.35Z"
      />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.05-1.86-3.05-1.86 0-2.15 1.45-2.15 2.95v5.67H9.32V9h3.42v1.56h.05c.48-.9 1.64-1.86 3.38-1.86 3.62 0 4.28 2.38 4.28 5.48v6.27ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.56V9h3.56v11.45ZM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.21 0 22.23 0Z"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.03 4.39 11.02 10.12 11.93v-8.44H7.08v-3.5h3.04V9.41c0-3.02 1.79-4.69 4.54-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.25h3.32l-.53 3.5h-2.79V24C19.61 23.09 24 18.1 24 12.07Z"
      />
    </svg>
  )
}