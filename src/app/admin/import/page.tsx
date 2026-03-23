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
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <a
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Admin
          </a>
          <span className="text-gray-700">/</span>
          <span className="text-sm font-medium text-gray-300">Importar preguntas CSV</span>
        </div>
      </div>
      <ImportForm />
    </div>
  )
}
