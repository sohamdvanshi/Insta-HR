'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'
import TrainerAccessGuard from '@/components/training/TrainerAccessGuard'

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <TrainerAccessGuard>{children}</TrainerAccessGuard>
    </GoogleOAuthProvider>
  )
}
