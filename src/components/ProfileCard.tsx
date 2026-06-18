import { useEffect, useState } from 'react'
import { Briefcase, GraduationCap, Camera, Phone, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type PublicProfile = {
  id: string
  display_name: string
  user_type: 'student' | 'staff'
  university: string | null
  province: string | null
  bio: string | null
  career: string | null
  position: string | null
  entry_year: number | null
  end_year: number | null
  is_current: boolean | null
  instagram: string | null
  tiktok: string | null
  whatsapp: string | null
  show_academic_info: boolean
  show_contact_info: boolean
  show_bio: boolean
}

type ProfileCardProps = {
  userId: string | null
  open: boolean
  onClose: () => void
}

export default function ProfileCard({ userId, open, onClose }: ProfileCardProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function loadProfileCard() {
    if (!userId) {
      return
    }

    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase.rpc('get_public_profile_card', {
      profile_user_id: userId,
    })

    setLoading(false)

    if (error || !data || data.length === 0) {
      setErrorMessage('No se pudo cargar la carta de perfil.')
      setProfile(null)
      return
    }

    setProfile(data[0] as PublicProfile)
  }

  useEffect(() => {
    if (open && userId) {
      loadProfileCard()
    }
  }, [open, userId])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <section className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black text-slate-900">
              Carta de perfil
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Información que el usuario decidió mostrar.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 p-2 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Cargando perfil...
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        {profile && !loading && (
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl bg-slate-900 p-5 text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-900">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>

              <h2 className="mt-4 text-xl font-black">
                {profile.display_name}
              </h2>

              <p className="mt-1 text-sm text-slate-300">
                {profile.university || 'Sin institución'}
                {profile.province ? ` • ${profile.province}` : ''}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {profile.user_type === 'student' ? 'Estudiante' : 'Funcionario'}
              </p>
            </div>

            {profile.bio && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">
                  Biografía
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {profile.bio}
                </p>
              </div>
            )}

            {profile.show_academic_info && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                  {profile.user_type === 'student' ? (
                    <GraduationCap size={15} />
                  ) : (
                    <Briefcase size={15} />
                  )}
                  {profile.user_type === 'student'
                    ? 'Información académica'
                    : 'Información laboral'}
                </p>

                <p className="mt-2 text-sm font-bold text-slate-800">
                  {profile.user_type === 'student'
                    ? profile.career || 'Carrera no indicada'
                    : profile.position || 'Cargo no indicado'}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {profile.entry_year ? `Inicio: ${profile.entry_year}` : ''}
                  {profile.is_current
                    ? ' • En curso'
                    : profile.end_year
                      ? ` • Finalización: ${profile.end_year}`
                      : ''}
                </p>
              </div>
            )}

            {profile.show_contact_info && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">
                  Contacto
                </p>

                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {profile.instagram && (
                    <p className="flex items-center gap-2">
                      <Camera size={15} />
                      Instagram: {profile.instagram}
                    </p>
                  )}

                  {profile.tiktok && <p>TikTok: {profile.tiktok}</p>}

                  {profile.whatsapp && (
                    <p className="flex items-center gap-2">
                      <Phone size={15} />
                      WhatsApp: {profile.whatsapp}
                    </p>
                  )}

                  {!profile.instagram && !profile.tiktok && !profile.whatsapp && (
                    <p className="text-slate-400">
                      No hay contactos visibles.
                    </p>
                  )}
                </div>
              </div>
            )}

            {!profile.bio &&
              !profile.show_academic_info &&
              !profile.show_contact_info && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Este usuario aún no muestra información adicional.
                </div>
              )}
          </div>
        )}
      </section>
    </div>
  )
}