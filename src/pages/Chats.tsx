import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Check,
  RefreshCw,
  Send,
  UserRound,
  X,
} from 'lucide-react'
import { useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProfileCard from '../components/ProfileCard'

type Conversation = {
  conversation_id: string
  other_user_id: string
  other_display_name: string
  other_university: string | null
  other_province: string | null
  last_message: string | null
  last_message_at: string | null
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

type DMRequest = {
  id: string
  requester_id: string
  requester_display_name: string
  requester_university: string | null
  requester_province: string | null
  receiver_id: string
  receiver_display_name: string
  receiver_university: string | null
  receiver_province: string | null
  subject: string
  status: 'pending' | 'accepted' | 'declined'
  conversation_id: string | null
  source_post_id: string | null
  source_comment_id: string | null
  created_at: string
  responded_at: string | null
  direction: 'received' | 'sent'
}

function formatMessageDate(value: string) {
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function Chats() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [requests, setRequests] = useState<DMRequest[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    searchParams.get('c'),
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [profileCardUserId, setProfileCardUserId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const activeConversation = conversations.find(
    (conversation) => conversation.conversation_id === activeConversationId,
  )

  const receivedPendingRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.direction === 'received' && request.status === 'pending',
      ),
    [requests],
  )

  const sentRequests = useMemo(
    () => requests.filter((request) => request.direction === 'sent'),
    [requests],
  )

  async function loadRequests() {
    const { data, error } = await supabase.rpc('get_my_dm_requests')

    if (error) {
      setErrorMessage('No se pudieron cargar las solicitudes.')
      return
    }

    setRequests((data ?? []) as DMRequest[])
  }

  async function loadConversations() {
    const { data, error } = await supabase.rpc('get_my_direct_conversations')

    if (error) {
      setErrorMessage('No se pudieron cargar los chats.')
      setLoading(false)
      return
    }

    setConversations(data ?? [])
    setLoading(false)
  }

  async function loadAll(showAnimation = false) {
    if (showAnimation) {
      setRefreshing(true)

      if ('vibrate' in navigator) {
        navigator.vibrate(20)
      }
    }

    await Promise.all([loadConversations(), loadRequests()])

    if (showAnimation) {
      setRefreshing(false)
    }
  }

  async function loadMessages(conversationId: string) {
    setLoadingMessages(true)

    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(80)

    setLoadingMessages(false)

    if (error) {
      setErrorMessage('No se pudieron cargar los mensajes.')
      return
    }

    setMessages((data ?? []).reverse())
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    const conversationIdFromUrl = searchParams.get('c')

    if (conversationIdFromUrl) {
      setActiveConversationId(conversationIdFromUrl)
    }
  }, [searchParams])

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }

    loadMessages(activeConversationId)
  }, [activeConversationId])

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanMessage = messageInput.trim()

    if (!user || !activeConversationId || !cleanMessage) {
      return
    }

    if (cleanMessage.length > 500) {
      setErrorMessage('El mensaje no puede pasar de 500 caracteres.')
      return
    }

    setSending(true)

    const { error } = await supabase.from('messages').insert({
      conversation_id: activeConversationId,
      sender_id: user.id,
      content: cleanMessage,
    })

    setSending(false)

    if (error) {
      setErrorMessage('No se pudo enviar el mensaje.')
      return
    }

    setMessageInput('')
    await loadMessages(activeConversationId)
    await loadConversations()
  }

  async function handleRespondRequest(requestId: string, nextStatus: 'accepted' | 'declined') {
    setErrorMessage('')

    const { data, error } = await supabase.rpc('respond_direct_message_request', {
      request_id: requestId,
      next_status: nextStatus,
    })

    if (error) {
      setErrorMessage('No se pudo responder la solicitud.')
      return
    }

    await loadAll(true)

    if (nextStatus === 'accepted' && data) {
      setActiveConversationId(data as string)
      await loadMessages(data as string)
    }
  }

  async function handleManualRefresh() {
    await loadAll(true)

    if (activeConversationId) {
      await loadMessages(activeConversationId)
    }
  }

  function openProfile(userId: string) {
    setProfileCardUserId(userId)
  }

  return (
    <main className="flex h-[calc(100vh-6.5rem)] flex-col overflow-hidden md:h-[calc(100vh-4rem)]">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Chats</h1>
          <p className="mt-1 text-sm text-slate-500">
            Solicitudes y mensajes directos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
        >
          <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">
            {refreshing ? 'Actualizando' : 'Recargar'}
          </span>
        </button>
      </header>

      {errorMessage && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="mt-5 grid min-h-0 flex-1 gap-4 overflow-hidden md:grid-cols-[310px_1fr]">
        <aside className="flex min-h-0 flex-col rounded-3xl border bg-white shadow-sm">
          <div className="border-b p-4">
            <p className="text-sm font-black text-slate-900">
              Bandeja
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Solicitudes y conversaciones.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading && (
              <p className="px-2 text-sm text-slate-500">Cargando chats...</p>
            )}

            {!loading && receivedPendingRequests.length > 0 && (
              <section className="mb-5">
                <p className="mb-2 px-2 text-xs font-black uppercase text-slate-400">
                  Solicitudes recibidas
                </p>

                <div className="space-y-2">
                  {receivedPendingRequests.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-2xl bg-amber-50 p-3"
                    >
                      <button
                        type="button"
                        onClick={() => openProfile(request.requester_id)}
                        className="text-left"
                      >
                        <p className="text-sm font-black text-slate-900">
                          {request.requester_display_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {request.requester_university || 'Institución'}
                          {request.requester_province
                            ? ` • ${request.requester_province}`
                            : ''}
                        </p>
                      </button>

                      <p className="mt-2 text-sm leading-5 text-slate-700">
                        {request.subject}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleRespondRequest(request.id, 'declined')
                          }
                          className="flex items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600"
                        >
                          <X size={14} />
                          Rechazar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleRespondRequest(request.id, 'accepted')
                          }
                          className="flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                        >
                          <Check size={14} />
                          Aceptar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {!loading && conversations.length > 0 && (
              <section>
                <p className="mb-2 px-2 text-xs font-black uppercase text-slate-400">
                  Conversaciones
                </p>

                <div className="space-y-2">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.conversation_id}
                      type="button"
                      onClick={() =>
                        setActiveConversationId(conversation.conversation_id)
                      }
                      className={[
                        'w-full rounded-2xl px-3 py-3 text-left',
                        conversation.conversation_id === activeConversationId
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      <p className="text-sm font-bold">
                        {conversation.other_display_name}
                      </p>
                      <p className="mt-1 truncate text-xs opacity-70">
                        {conversation.last_message || 'Sin mensajes todavía'}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {!loading && sentRequests.length > 0 && (
              <section className="mt-5">
                <p className="mb-2 px-2 text-xs font-black uppercase text-slate-400">
                  Solicitudes enviadas
                </p>

                <div className="space-y-2">
                  {sentRequests.slice(0, 10).map((request) => (
                    <article
                      key={request.id}
                      className="rounded-2xl bg-slate-50 p-3"
                    >
                      <button
                        type="button"
                        onClick={() => openProfile(request.receiver_id)}
                        className="text-left"
                      >
                        <p className="text-sm font-bold text-slate-800">
                          {request.receiver_display_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Estado:{' '}
                          {request.status === 'pending'
                            ? 'Pendiente'
                            : request.status === 'accepted'
                              ? 'Aceptada'
                              : 'Rechazada'}
                        </p>
                      </button>

                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                        {request.subject}
                      </p>

                      {request.status === 'accepted' && request.conversation_id && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveConversationId(request.conversation_id)
                          }
                          className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700"
                        >
                          Abrir chat
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {!loading &&
              conversations.length === 0 &&
              receivedPendingRequests.length === 0 &&
              sentRequests.length === 0 && (
                <p className="px-2 text-sm text-slate-500">
                  Todavía no tenés chats ni solicitudes.
                </p>
              )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-3xl border bg-white shadow-sm">
          {activeConversation ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b p-4">
                <button
                  type="button"
                  onClick={() => openProfile(activeConversation.other_user_id)}
                  className="text-left"
                >
                  <p className="text-sm font-black text-slate-900">
                    {activeConversation.other_display_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {activeConversation.other_university || 'Institución'}{' '}
                    {activeConversation.other_province
                      ? `• ${activeConversation.other_province}`
                      : ''}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => openProfile(activeConversation.other_user_id)}
                  className="rounded-2xl bg-slate-100 p-3 text-slate-600"
                >
                  <UserRound size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {loadingMessages && (
                  <p className="text-sm text-slate-500">Cargando mensajes...</p>
                )}

                {!loadingMessages && messages.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Todavía no hay mensajes. Escribí el primero.
                  </p>
                )}

                {messages.map((message) => {
                  const isMine = message.sender_id === user?.id

                  return (
                    <div
                      key={message.id}
                      className={[
                        'flex',
                        isMine ? 'justify-end' : 'justify-start',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'max-w-[78%] rounded-3xl px-4 py-3 text-sm',
                          isMine
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700',
                        ].join(' ')}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        <p className="mt-1 text-[10px] opacity-60">
                          {formatMessageDate(message.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2 border-t p-3">
                <input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  maxLength={500}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Escribí un mensaje..."
                />

                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-2xl bg-slate-900 p-3 text-white disabled:opacity-60"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
              Seleccioná un chat o aceptá una solicitud.
            </div>
          )}
        </section>
      </section>

      <ProfileCard
        userId={profileCardUserId}
        open={Boolean(profileCardUserId)}
        onClose={() => setProfileCardUserId(null)}
      />
    </main>
  )
}