import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ImportForm from './_components/ImportForm'

export default async function ImportPage() {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    redirect('/admin')
  }

  return (
    <div>
      <div className="bg-surface-card border-b border-wire">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <a
            href="/admin"
            className="text-sm text-ink-dim hover:text-ink-muted transition-colors"
          >
            ← Admin
          </a>
          <span className="text-wire-muted">/</span>
          <span className="text-sm font-medium text-ink-muted">Importar preguntas CSV</span>
        </div>
      </div>
      <ImportForm />
    </div>
  )
}
