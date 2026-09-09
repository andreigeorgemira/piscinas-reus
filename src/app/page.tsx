import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">Piscinas Reus</h1>
      <p className="text-slate-600">Sitio en construcción.</p>
      <Link href="/login" className="underline">
        Acceso
      </Link>
    </main>
  )
}
