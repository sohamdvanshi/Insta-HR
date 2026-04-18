import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Providers from './providers'
import I18nProvider from '@/components/i18n-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'InstaHire - AI Powered Job Portal',
  description: 'Find your dream job with AI powered matching',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <I18nProvider>
          <Providers>
            <Navbar />
            {children}
          </Providers>
        </I18nProvider>
      </body>
    </html>
  )
}