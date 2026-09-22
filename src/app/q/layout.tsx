import type { ReactNode } from 'react'
import { PublicProviders } from '@/components/ui/public-providers'

/**
 * The frame around the public quote link.
 *
 * Nothing of the admin's: no sidebar, no navigation, no way further into the
 * app. The page a client opens is one document and the two answers they can
 * give it, and every extra thing on screen is an invitation to wander into a
 * part of the tool that would only refuse them.
 */
export default function PublicQuoteLayout({ children }: { children: ReactNode }) {
  return <PublicProviders>{children}</PublicProviders>
}
