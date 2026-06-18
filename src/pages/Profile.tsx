import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, signOut } = useAuth()

  const displayName = user?.user_metadata?.display_name
  const university = user?.user_metadata?.university
  const province = user?.user_metadata?.province || user?.user_metadata?.campus

  return (
    <main>
      <h1 className="text-2xl font-black text-slate-900">Perfil</h1>
      <p className="mt-1 text-sm text-slate-500">
        Perfil, universidad, provincia y ajustes generales.
      </p>

      <section className="mt-5 rounded-3xl border bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Sesión activa</p>

        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-semibold">Correo:</span> {user?.email}
          </p>
          <p>
            <span className="font-semibold">Nombre:</span>{' '}
            {displayName || 'Sin nombre'}
          </p>
          <p>
            <span className="font-semibold">Universidad:</span>{' '}
            {university || 'Sin universidad'}
          </p>
          <p>
            <span className="font-semibold">Provincia:</span>{' '}
            {province || 'Sin provincia'}
          </p>
        </div>

        <button
          onClick={signOut}
          className="mt-5 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          Cerrar sesión
        </button>
      </section>
    </main>
  )
}