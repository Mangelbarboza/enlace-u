import type { FormEvent } from 'react'
import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type DirectMessageRequestModalProps = {
  open: boolean
  receiverUserId: string | null
  receiverName: string
  sourcePostId?: string | null
  sourceCommentId?: string | null
  onClose: () => void
  onSuccess?: () => void
}

export default function DirectMessageRequestModal({
  open,
  receiverUserId,
  receiverName,
  sourcePostId = null,
  sourceCommentId = null,
  onClose,
  onSuccess,
}: DirectMessageRequestModalProps) {
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  if (!open) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanSubject = subject.trim()

    setErrorMessage('')
    setSuccessMessage('')

    if (!receiverUserId) {
      setErrorMessage('No se encontró el usuario destino.')
      return
    }

    if (!cleanSubject) {
      setErrorMessage('Escribí el asunto de la solicitud.')
      return
    }

    if (cleanSubject.length > 180) {
      setErrorMessage('El asunto no puede pasar de 180 caracteres.')
      return
    }

    setSending(true)

    const { error } = await supabase.rpc('create_direct_message_request', {
      receiver_user_id: receiverUserId,
      request_subject: cleanSubject,
      source_post_id: sourcePostId,
      source_comment_id: sourceCommentId,
    })

    setSending(false)

    if (error) {
      setErrorMessage(
        'No se pudo enviar la solicitud. Puede que ya tengas una pendiente con esta persona.',
      )
      return
    }

    setSubject('')
    setSuccessMessage('Solicitud enviada. La otra persona debe aceptarla para abrir el chat.')
    onSuccess?.()
  }

  function handleClose() {
    setSubject('')
    setErrorMessage('')
    setSuccessMessage('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <section className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Solicitar mensaje
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Enviá una solicitud a {receiverName || 'este usuario'}. Si acepta,
              se abrirá el chat.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl bg-slate-100 p-2 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">
              Asunto
            </label>

            <textarea
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={180}
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              placeholder="Explicá brevemente por qué querés escribirle"
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {subject.length}/180
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
            >
              Cerrar
            </button>

            <button
              type="submit"
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              <Send size={16} />
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}