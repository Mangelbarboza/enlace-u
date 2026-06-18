import { type FormEvent, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    searchParams.get('c'),
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const activeConversation = conversations.find(
    (conversation) => conversation.conversation_id === activeConversationId,
  )

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

  async function loadMessages(conversationId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      setErrorMessage('No se pudieron cargar los mensajes.')
      return
    }

    setMessages(data ?? [])
  }

  useEffect(() => {
    loadConversations()
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

    const intervalId = window.setInterval(() => {
      loadMessages(activeConversationId)
      loadConversations()
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
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

  return (
    <main>
      <header>
        <h1 className="text-2xl font-black text-slate-900">Chats</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mensajes directos entre estudiantes.
        </p>
      </header>

      {errorMessage && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="mt-5 grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border bg-white p-3 shadow-sm">
          <p className="mb-3 px-2 text-sm font-black text-slate-900">
            Conversaciones
          </p>

          {loading && (
            <p className="px-2 text-sm text-slate-500">Cargando chats...</p>
          )}

          {!loading && conversations.length === 0 && (
            <p className="px-2 text-sm text-slate-500">
              Todavía no tenés chats. Abrí uno desde una publicación.
            </p>
          )}

          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.conversation_id}
                onClick={() => setActiveConversationId(conversation.conversation_id)}
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
        </aside>

        <section className="flex min-h-[520px] flex-col rounded-3xl border bg-white shadow-sm">
          {activeConversation ? (
            <>
              <div className="border-b p-4">
                <p className="text-sm font-black text-slate-900">
                  {activeConversation.other_display_name}
                </p>
                <p className="text-xs text-slate-500">
                  {activeConversation.other_university || 'Universidad'}{' '}
                  {activeConversation.other_province
                    ? `• ${activeConversation.other_province}`
                    : ''}
                </p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
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
                        <p className="whitespace-pre-wrap">{message.content}</p>
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
                  disabled={sending}
                  className="rounded-2xl bg-slate-900 p-3 text-white disabled:opacity-60"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
              Seleccioná un chat o abrí uno desde una publicación.
            </div>
          )}
        </section>
      </section>
    </main>
  )
}