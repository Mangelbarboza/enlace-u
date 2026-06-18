import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BellOff, LogOut, Save, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { COSTA_RICA_PROVINCES, type UserType } from '../lib/constants'

type ProfileData = {
  id: string
  display_name: string
  user_type: UserType
  university: string | null
  province: string | null
  bio: string | null
  career: string | null
  position: string | null
  entry_year: number | null
  end_year: number | null
  is_current: boolean
  instagram: string | null
  tiktok: string | null
  whatsapp: string | null
  show_academic_info: boolean
  show_contact_info: boolean
  show_bio: boolean
  notifications_muted: boolean
  university_locked_until: string | null
}

const currentYear = new Date().getFullYear()

function buildYearOptions() {
  const years: number[] = []

  for (let year = currentYear + 8; year >= 1980; year -= 1) {
    years.push(year)
  }

  return years
}

const years = buildYearOptions()

function formatDate(value: string | null) {
  if (!value) {
    return 'Sin fecha'
  }

  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export default function Profile() {
  const { user, signOut } = useAuth()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function loadProfile() {
    if (!user) {
      return
    }

    setLoadingProfile(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('profiles')
      .select(
        [
          'id',
          'display_name',
          'user_type',
          'university',
          'province',
          'bio',
          'career',
          'position',
          'entry_year',
          'end_year',
          'is_current',
          'instagram',
          'tiktok',
          'whatsapp',
          'show_academic_info',
          'show_contact_info',
          'show_bio',
          'notifications_muted',
          'university_locked_until',
        ].join(', '),
      )
      .eq('id', user.id)
      .single()

    if (error || !data) {
      const fallbackProfile: ProfileData = {
        id: user.id,
        display_name: user.user_metadata?.display_name || 'Estudiante',
        user_type: user.user_metadata?.user_type || 'student',
        university: user.user_metadata?.university || null,
        province:
          user.user_metadata?.province || user.user_metadata?.campus || null,
        bio: null,
        career: null,
        position: null,
        entry_year: null,
        end_year: null,
        is_current: true,
        instagram: null,
        tiktok: null,
        whatsapp: null,
        show_academic_info: false,
        show_contact_info: false,
        show_bio: true,
        notifications_muted: false,
        university_locked_until: null,
      }

      setProfile(fallbackProfile)
      setLoadingProfile(false)
      return
    }

    setProfile(data as unknown as ProfileData)
    setLoadingProfile(false)
  }

  useEffect(() => {
    loadProfile()
  }, [user?.id])

  function updateProfileField<K extends keyof ProfileData>(
    key: K,
    value: ProfileData[K],
  ) {
    setProfile((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        [key]: value,
      }
    })
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user || !profile) {
      return
    }

    setErrorMessage('')
    setSuccessMessage('')

    const cleanDisplayName = profile.display_name.trim()
    const cleanBio = profile.bio?.trim() || null

    if (!cleanDisplayName) {
      setErrorMessage('El nombre visible es obligatorio.')
      return
    }

    if (cleanDisplayName.length > 20) {
      setErrorMessage('El nombre visible no puede pasar de 20 caracteres.')
      return
    }

    if (cleanBio && cleanBio.length > 150) {
      setErrorMessage('La biografía no puede pasar de 150 caracteres.')
      return
    }

    setSaving(true)

    const payload = {
      id: user.id,
      display_name: cleanDisplayName,
      user_type: profile.user_type,
      university: profile.university,
      province: profile.province,
      bio: cleanBio,
      career: profile.user_type === 'student' ? profile.career?.trim() || null : null,
      position:
        profile.user_type === 'staff' ? profile.position?.trim() || null : null,
      entry_year: profile.entry_year,
      end_year: profile.is_current ? null : profile.end_year,
      is_current: profile.is_current,
      instagram: profile.instagram?.trim() || null,
      tiktok: profile.tiktok?.trim() || null,
      whatsapp: profile.whatsapp?.trim() || null,
      show_academic_info: profile.show_academic_info,
      show_contact_info: profile.show_contact_info,
      show_bio: profile.show_bio,
      notifications_muted: profile.notifications_muted,
    }

    const { error } = await supabase.from('profiles').upsert(payload)

    if (error) {
      setSaving(false)
      setErrorMessage('No se pudo guardar el perfil.')
      return
    }

    await supabase.auth.updateUser({
      data: {
        display_name: cleanDisplayName,
        user_type: profile.user_type,
        university: profile.university,
        province: profile.province,
      },
    })

    setSaving(false)
    setSuccessMessage('Perfil actualizado correctamente.')
    await loadProfile()
  }

  async function handleRequestAccountDeletion() {
    if (!user) {
      return
    }

    const confirmDelete = window.confirm(
      '¿Querés solicitar la eliminación de tu cuenta? Esta solicitud quedará pendiente de revisión.',
    )

    if (!confirmDelete) {
      return
    }

    setDeleting(true)
    setErrorMessage('')
    setSuccessMessage('')

    const { error } = await supabase.from('account_deletion_requests').insert({
      user_id: user.id,
      reason: 'Solicitud enviada desde ajustes de perfil',
    })

    setDeleting(false)

    if (error) {
      setErrorMessage(
        'No se pudo enviar la solicitud o ya tenés una solicitud pendiente.',
      )
      return
    }

    setSuccessMessage('Solicitud de eliminación enviada correctamente.')
  }

  if (loadingProfile) {
    return (
      <main>
        <h1 className="text-2xl font-black text-slate-900">Perfil</h1>
        <section className="mt-5 rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
          Cargando perfil...
        </section>
      </main>
    )
  }

  if (!profile) {
    return (
      <main>
        <h1 className="text-2xl font-black text-slate-900">Perfil</h1>
        <section className="mt-5 rounded-3xl border bg-white p-5 text-sm text-red-600 shadow-sm">
          No se pudo cargar el perfil.
        </section>
      </main>
    )
  }

  const isStudent = profile.user_type === 'student'

  return (
    <main>
      <header>
        <h1 className="text-2xl font-black text-slate-900">Perfil</h1>
        <p className="mt-1 text-sm text-slate-500">
          Información personal, carta pública y ajustes.
        </p>
      </header>

      {errorMessage && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="mt-5 space-y-5">
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">Datos principales</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nombre visible
              </label>
              <input
                value={profile.display_name}
                maxLength={20}
                onChange={(event) =>
                  updateProfileField('display_name', event.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Máximo 20 caracteres"
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {profile.display_name.length}/20
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">
                  Institución
                </p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {profile.university || 'Sin institución'}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  No se puede cambiar hasta el{' '}
                  {formatDate(profile.university_locked_until)}.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Provincia
                </label>
                <select
                  value={profile.province || ''}
                  onChange={(event) =>
                    updateProfileField('province', event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">Seleccionar provincia</option>
                  {COSTA_RICA_PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Biografía
              </label>
              <textarea
                value={profile.bio || ''}
                maxLength={150}
                onChange={(event) =>
                  updateProfileField('bio', event.target.value)
                }
                className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Contá algo breve sobre vos"
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {(profile.bio || '').length}/150
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">
            Información académica o laboral
          </h2>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateProfileField('user_type', 'student')}
                className={[
                  'rounded-2xl border px-4 py-3 text-sm font-bold',
                  profile.user_type === 'student'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600',
                ].join(' ')}
              >
                Estudiante
              </button>

              <button
                type="button"
                onClick={() => updateProfileField('user_type', 'staff')}
                className={[
                  'rounded-2xl border px-4 py-3 text-sm font-bold',
                  profile.user_type === 'staff'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600',
                ].join(' ')}
              >
                Funcionario
              </button>
            </div>

            {isStudent ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Carrera
                </label>
                <input
                  value={profile.career || ''}
                  onChange={(event) =>
                    updateProfileField('career', event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Escribí tu carrera"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Cargo
                </label>
                <input
                  value={profile.position || ''}
                  onChange={(event) =>
                    updateProfileField('position', event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Escribí tu cargo"
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Año de inicio
                </label>
                <select
                  value={profile.entry_year || ''}
                  onChange={(event) =>
                    updateProfileField(
                      'entry_year',
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">Seleccionar año</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Año de finalización
                </label>
                <select
                  value={profile.end_year || ''}
                  disabled={profile.is_current}
                  onChange={(event) =>
                    updateProfileField(
                      'end_year',
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Seleccionar año</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={profile.is_current}
                onChange={(event) =>
                  updateProfileField('is_current', event.target.checked)
                }
                className="h-4 w-4"
              />
              En curso
            </label>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">Contactos</h2>

          <div className="mt-4 space-y-3">
            <input
              value={profile.instagram || ''}
              onChange={(event) =>
                updateProfileField('instagram', event.target.value)
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              placeholder="Instagram"
            />

            <input
              value={profile.tiktok || ''}
              onChange={(event) =>
                updateProfileField('tiktok', event.target.value)
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              placeholder="TikTok"
            />

            <input
              value={profile.whatsapp || ''}
              onChange={(event) =>
                updateProfileField('whatsapp', event.target.value)
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              placeholder="WhatsApp"
            />
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">
            Privacidad de carta de perfil
          </h2>

          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>Mostrar biografía</span>
              <input
                type="checkbox"
                checked={profile.show_bio}
                onChange={(event) =>
                  updateProfileField('show_bio', event.target.checked)
                }
                className="h-4 w-4"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>Mostrar carrera/cargo y años</span>
              <input
                type="checkbox"
                checked={profile.show_academic_info}
                onChange={(event) =>
                  updateProfileField('show_academic_info', event.target.checked)
                }
                className="h-4 w-4"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>Mostrar contactos</span>
              <input
                type="checkbox"
                checked={profile.show_contact_info}
                onChange={(event) =>
                  updateProfileField('show_contact_info', event.target.checked)
                }
                className="h-4 w-4"
              />
            </label>

            <p className="text-xs leading-5 text-slate-400">
              Tu nombre visible e institución siempre se mostrarán en la carta de
              perfil.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">Ajustes</h2>

          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="flex items-center gap-2">
                <BellOff size={17} />
                Silenciar notificaciones
              </span>

              <input
                type="checkbox"
                checked={profile.notifications_muted}
                onChange={(event) =>
                  updateProfileField('notifications_muted', event.target.checked)
                }
                className="h-4 w-4"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              <Save size={17} />
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </button>

            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
            >
              <LogOut size={17} />
              Cerrar sesión
            </button>

            <button
              type="button"
              onClick={handleRequestAccountDeletion}
              disabled={deleting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 disabled:opacity-60"
            >
              <Trash2 size={17} />
              {deleting ? 'Enviando solicitud...' : 'Solicitar eliminar cuenta'}
            </button>
          </div>
        </section>
      </form>
    </main>
  )
}