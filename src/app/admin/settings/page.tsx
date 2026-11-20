import type { Metadata } from 'next'
import { PageHeader } from '@/app/admin/page-header'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getCompanySettings } from '@/lib/settings/queries'
import { SettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'Ajustes' }

/** The company's details, its VAT default and the footer of every quote. */
export default async function SettingsPage() {
  const supabase = await requireAdmin()
  const settings = await getCompanySettings(supabase)

  return (
    <>
      <PageHeader title="Ajustes" meta="Empresa, datos fiscales e IVA" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SettingsForm settings={settings} />
      </div>
    </>
  )
}
