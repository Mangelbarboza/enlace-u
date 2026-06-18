import { type FormEvent, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Post = {
  id: string
  user_id: string
  author_name: string
  university: string | null
  campus: string | null
  content: string
  created_at: string
  is_anonymous: boolean
}

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function General() {
  const { user } = useAuth()

  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const displayName = user?.user_metadata?.display_name || 'Estudiante'
  const university = user?.user_metadata?.university || null
  const campus = user?.user_metadata?.campus || null

  async function loadPosts() {
    setLoadingPosts(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('posts')
      .select(
        'id, user_id, author_name, university, campus, content, created_at, is_anonymous',
      )
      .order('created_at', { ascending: false })
      .limit(50)

    setLoadingPosts(false)

    if (error) {
      setErrorMessage('No se pudieron cargar las publicaciones.')
      return
    }

    setPosts(data ?? [])
  }

  useEffect(() => {
    loadPosts()
  }, [])

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const cleanContent = content.trim()

    if (!user) {
      setErrorMessage('Necesitás iniciar sesión para publicar.')
      return
    }

    if (!cleanContent) {
      setErrorMessage('Escribí algo antes de publicar.')
      return
    }

    if (cleanContent.length > 500) {
      setErrorMessage('La publicación no puede pasar de 500 caracteres.')
      return
    }

    setPublishing(true)

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      author_name: displayName,
      university,
      campus,
      content: cleanContent,
      is_anonymous: isAnonymous,
    })

    setPublishing(false)

    if (error) {
      setErrorMessage('No se pudo publicar. Intentá de nuevo.')
      return
    }

    setContent('')
    setIsAnonymous(false)
    await loadPosts()
  }

  async function handleDeletePost(postId: string) {
    const confirmDelete = window.confirm('¿Querés borrar esta publicación?')

    if (!confirmDelete) {
      return
    }

    const { error } = await supabase.from('posts').delete().eq('id', postId)

    if (error) {
      setErrorMessage('No se pudo borrar la publicación.')
      return
    }

    setPosts((currentPosts) =>
      currentPosts.filter((post) => post.id !== postId),
    )
  }

  return (
    <main>
      <header>
        <h1 className="text-2xl font-black text-slate-900">General</h1>
        <p className="mt-1 text-sm text-slate-500">
          Muro general de todas las universidades.
        </p>
      </header>

      <form
        onSubmit={handleCreatePost}
        className="mt-5 rounded-3xl border bg-white p-5 shadow-sm"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
            {isAnonymous ? '?' : displayName.charAt(0).toUpperCase()}
          </div>

          <div>
            <p className="text-sm font-bold text-slate-900">
              {isAnonymous ? 'Publicar como anónimo' : displayName}
            </p>
            <p className="text-xs text-slate-500">
              {isAnonymous
                ? 'Tu nombre no se mostrará públicamente'
                : `${university || 'Universidad'} ${campus ? `• ${campus}` : ''}`}
            </p>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={500}
          className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
          placeholder="¿Qué querés compartir hoy?"
        />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
              className="h-4 w-4"
            />
            Publicar anónimo
          </label>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <p className="text-xs text-slate-400">{content.length}/500</p>

            <button
              type="submit"
              disabled={publishing}
              className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      </form>

      {errorMessage && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="mt-5 space-y-4">
        {loadingPosts && (
          <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
            Cargando publicaciones...
          </div>
        )}

        {!loadingPosts && posts.length === 0 && (
          <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
            Todavía no hay publicaciones. Sé el primero en escribir algo.
          </div>
        )}

        {posts.map((post) => {
          const isOwnPost = post.user_id === user?.id
          const visibleName = post.is_anonymous ? 'Anónimo' : post.author_name
          const visibleInitial = post.is_anonymous
            ? '?'
            : post.author_name.charAt(0).toUpperCase()

          return (
            <article
              key={post.id}
              className="rounded-3xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      'flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black',
                      post.is_anonymous
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-700',
                    ].join(' ')}
                  >
                    {visibleInitial}
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {visibleName}
                    </p>

                    <p className="text-xs text-slate-500">
                      {post.is_anonymous
                        ? `Muro general • ${formatPostDate(post.created_at)}`
                        : `${post.university || 'Universidad'} ${
                            post.campus ? `• ${post.campus}` : ''
                          } • ${formatPostDate(post.created_at)}`}
                    </p>
                  </div>
                </div>

                {isOwnPost && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                    aria-label="Borrar publicación"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {post.content}
              </p>
            </article>
          )
        })}
      </section>
    </main>
  )
}