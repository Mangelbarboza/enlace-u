import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { COSTA_RICA_PROVINCES, UNIVERSITIES } from '../lib/constants'

type AuthMode = 'login' | 'register'

function getFriendlyAuthError(message: string) {
  const cleanMessage = message.toLowerCase()

  if (cleanMessage.includes('user already registered')) {
    return 'Ese correo ya está registrado. Iniciá sesión o usá otro correo.'
  }

  if (cleanMessage.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.'
  }

  if (cleanMessage.includes('password')) {
    return 'La contraseña no cumple los requisitos mínimos.'
  }

  if (cleanMessage.includes('email')) {
    return 'Revisá que el correo esté bien escrito.'
  }

  return message
}

export default function AuthPage() {
  const navigate = useNavigate()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [university, setUniversity] = useState('')
  const [province, setProvince] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const isRegister = mode === 'register'

  function resetMessages() {
    setErrorMessage('')
    setSuccessMessage('')
  }

  function validateForm() {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      return 'Escribí tu correo.'
    }

    if (!normalizedEmail.includes('@')) {
      return 'Escribí un correo válido.'
    }

    if (!password) {
      return 'Escribí tu contraseña.'
    }

    if (password.length < 8) {
      return 'La contraseña debe tener mínimo 8 caracteres.'
    }

    if (isRegister) {
      if (!displayName.trim()) {
        return 'Escribí tu nombre visible.'
      }

      if (!university) {
        return 'Seleccioná tu universidad.'
      }

      if (!province) {
        return 'Seleccioná la provincia donde está tu sede.'
      }

      if (password !== confirmPassword) {
        return 'Las contraseñas no coinciden.'
      }
    }

    return ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()

    const validationError = validateForm()

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setLoading(true)

    const normalizedEmail = email.trim().toLowerCase()

    if (isRegister) {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            university,
            province,
          },
        },
      })

      setLoading(false)

      if (error) {
        setErrorMessage(getFriendlyAuthError(error.message))
        return
      }

      if (!data.session) {
        setSuccessMessage(
          'Cuenta creada. Revisá tu correo para confirmar la cuenta antes de iniciar sesión.'
        )
        return
      }

      navigate('/', { replace: true })
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    setLoading(false)

    if (error) {
      setErrorMessage(getFriendlyAuthError(error.message))
      return
    }

    navigate('/', { replace: true })
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    resetMessages()
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white">
            EU
          </div>

          <h1 className="text-2xl font-black text-slate-900">Enlace U</h1>
          <p className="mt-1 text-sm text-slate-500">
            Un espacio para estudiantes de universidades públicas.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => changeMode('login')}
            className={[
              'rounded-xl px-4 py-2 text-sm font-semibold',
              mode === 'login'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500',
            ].join(' ')}
          >
            Iniciar sesión
          </button>

          <button
            type="button"
            onClick={() => changeMode('register')}
            className={[
              'rounded-xl px-4 py-2 text-sm font-semibold',
              mode === 'register'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500',
            ].join(' ')}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nombre visible
                </label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Ej: Ángel"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Universidad
                </label>
                <select
                  value={university}
                  onChange={(event) => setUniversity(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">Seleccionar universidad</option>
                  {UNIVERSITIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Provincia de la sede
                </label>
                <select
                  value={province}
                  onChange={(event) => setProvince(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">Seleccionar provincia</option>
                  {COSTA_RICA_PROVINCES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Correo
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              placeholder="tu_correo@ejemplo.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña
            </label>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none focus:border-slate-500"
                placeholder="Mínimo 8 caracteres"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                aria-label="Mostrar u ocultar contraseña"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Confirmar contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Repetí la contraseña"
                autoComplete="new-password"
              />
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? 'Procesando...'
              : isRegister
                ? 'Crear cuenta'
                : 'Entrar'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Al entrar aceptás usar la app con respeto y sin acosar a otros usuarios.
        </p>
      </section>
    </main>
  )
}