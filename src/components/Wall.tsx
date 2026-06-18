import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type WallMode = 'general' | 'university'

type PostComment = {
  id: string
  post_id: string
  user_id: string
  author_name: string
  university: string | null
  province: string | null
  content: string
  created_at: string
  likes_count: number
  liked_by_me: boolean
}

type Post = {
  id: string
  user_id: string
  author_name: string
  university: string | null
  province: string | null
  content: string
  created_at: string
  is_anonymous: boolean
  tags: string[]
  post_scope: 'general' | 'university'
  likes_count: number
  liked_by_me: boolean
  comments: PostComment[]
}

type WallProps = {
  mode: WallMode
}

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function normalizeTags(value: string) {
  return value
    .split(/[,\s#]+/)
    .map((tag) =>
      tag
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñ_-]/gi, ''),
    )
    .filter(Boolean)
    .slice(0, 8)
}

export default function Wall({ mode }: WallProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.user_metadata?.display_name || 'Estudiante'
  const university = user?.user_metadata?.university || null
  const province =
    user?.user_metadata?.province || user?.user_metadata?.campus || null

  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)

  const [loadingPosts, setLoadingPosts] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  const normalizedSearch = tagSearch.trim().toLowerCase().replace('#', '')

  const filteredPosts = useMemo(() => {
    if (!normalizedSearch) {
      return posts
    }

    return posts.filter((post) =>
      post.tags.some((tag) => tag.includes(normalizedSearch)),
    )
  }, [posts, normalizedSearch])

  const title = mode === 'general' ? 'General' : university || 'Muro U'

  const subtitle =
    mode === 'general'
      ? 'Muro general de todas las universidades.'
      : `Muro privado de ${university || 'tu universidad'}.`

  async function loadPosts() {
    setLoadingPosts(true)
    setErrorMessage('')

    let query = supabase
      .from('posts')
      .select(
        'id, user_id, author_name, university, province, content, created_at, is_anonymous, tags, post_scope',
      )
      .order('created_at', { ascending: false })
      .limit(100)

    if (mode === 'general') {
      query = query.eq('post_scope', 'general')
    }

    if (mode === 'university') {
      query = query.eq('post_scope', 'university').eq('university', university || '')
    }

    const { data, error } = await query

    if (error) {
      setLoadingPosts(false)
      setErrorMessage('No se pudieron cargar las publicaciones.')
      return
    }

    const basePosts = data ?? []
    const postIds = basePosts.map((post) => post.id)

    if (postIds.length === 0) {
      setPosts([])
      setLoadingPosts(false)
      return
    }

    const [postLikesResult, commentsResult] = await Promise.all([
      supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
      supabase
        .from('post_comments')
        .select(
          'id, post_id, user_id, author_name, university, province, content, created_at',
        )
        .in('post_id', postIds)
        .order('created_at', { ascending: true }),
    ])

    const postLikes = postLikesResult.data ?? []
    const comments = commentsResult.data ?? []
    const commentIds = comments.map((comment) => comment.id)

    const commentLikesResult =
      commentIds.length > 0
        ? await supabase
            .from('comment_likes')
            .select('comment_id, user_id')
            .in('comment_id', commentIds)
        : { data: [] as { comment_id: string; user_id: string }[] }

    const commentLikes = commentLikesResult.data ?? []

    const postLikeCounts = new Map<string, number>()
    const postsLikedByMe = new Set<string>()

    postLikes.forEach((like) => {
      postLikeCounts.set(
        like.post_id,
        (postLikeCounts.get(like.post_id) ?? 0) + 1,
      )

      if (like.user_id === user?.id) {
        postsLikedByMe.add(like.post_id)
      }
    })

    const commentLikeCounts = new Map<string, number>()
    const commentsLikedByMe = new Set<string>()

    commentLikes.forEach((like) => {
      commentLikeCounts.set(
        like.comment_id,
        (commentLikeCounts.get(like.comment_id) ?? 0) + 1,
      )

      if (like.user_id === user?.id) {
        commentsLikedByMe.add(like.comment_id)
      }
    })

    const commentsByPost = new Map<string, PostComment[]>()

    comments.forEach((comment) => {
      const enrichedComment: PostComment = {
        ...comment,
        likes_count: commentLikeCounts.get(comment.id) ?? 0,
        liked_by_me: commentsLikedByMe.has(comment.id),
      }

      const current = commentsByPost.get(comment.post_id) ?? []
      current.push(enrichedComment)
      commentsByPost.set(comment.post_id, current)
    })

    const enrichedPosts: Post[] = basePosts.map((post) => ({
      ...post,
      tags: post.tags ?? [],
      likes_count: postLikeCounts.get(post.id) ?? 0,
      liked_by_me: postsLikedByMe.has(post.id),
      comments: commentsByPost.get(post.id) ?? [],
    }))

    setPosts(enrichedPosts)
    setLoadingPosts(false)
  }

  useEffect(() => {
    loadPosts()
  }, [mode, university])

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const cleanContent = content.trim()
    const cleanTags = normalizeTags(tagsInput)

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
      province,
      content: cleanContent,
      is_anonymous: isAnonymous,
      tags: cleanTags,
      post_scope: mode,
    })

    setPublishing(false)

    if (error) {
      setErrorMessage('No se pudo publicar. Intentá de nuevo.')
      return
    }

    setContent('')
    setTagsInput('')
    setIsAnonymous(false)
    setIsComposerOpen(false)
    await loadPosts()
  }

  async function handleTogglePostLike(post: Post) {
    if (!user) {
      return
    }

    if (post.liked_by_me) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id)
    } else {
      await supabase.from('post_likes').insert({
        post_id: post.id,
        user_id: user.id,
      })
    }

    await loadPosts()
  }

  async function handleCreateComment(postId: string) {
    const cleanContent = commentInputs[postId]?.trim()

    if (!user || !cleanContent) {
      return
    }

    if (cleanContent.length > 500) {
      setErrorMessage('El comentario no puede pasar de 500 caracteres.')
      return
    }

    const { error } = await supabase.from('post_comments').insert({
      post_id: postId,
      user_id: user.id,
      author_name: displayName,
      university,
      province,
      content: cleanContent,
    })

    if (error) {
      setErrorMessage('No se pudo comentar.')
      return
    }

    setCommentInputs((current) => ({
      ...current,
      [postId]: '',
    }))

    await loadPosts()
  }

  async function handleToggleCommentLike(comment: PostComment) {
    if (!user) {
      return
    }

    if (comment.liked_by_me) {
      await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', comment.id)
        .eq('user_id', user.id)
    } else {
      await supabase.from('comment_likes').insert({
        comment_id: comment.id,
        user_id: user.id,
      })
    }

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

    setSelectedPost(null)
    await loadPosts()
  }

  async function handleReportPost(post: Post) {
    if (!user) {
      setErrorMessage('Necesitás iniciar sesión para reportar.')
      return
    }

    const { error } = await supabase.from('post_reports').insert({
      post_id: post.id,
      reporter_id: user.id,
      reason: 'Reporte desde muro',
    })

    if (error) {
      setErrorMessage('No se pudo enviar el reporte o ya habías reportado este post.')
      setSelectedPost(null)
      return
    }

    setSuccessMessage('Reporte enviado. Gracias por ayudar a cuidar la comunidad.')
    setSelectedPost(null)
  }

  async function handleStartDirectMessage(post: Post) {
    if (!user) {
      setErrorMessage('Necesitás iniciar sesión para enviar mensajes.')
      return
    }

    if (post.user_id === user.id) {
      setErrorMessage('No podés abrir un chat con vos mismo.')
      setSelectedPost(null)
      return
    }

    if (post.is_anonymous) {
      setErrorMessage('No podés enviar mensaje directo a un post anónimo.')
      setSelectedPost(null)
      return
    }

    const { data, error } = await supabase.rpc('start_direct_conversation', {
      other_user_id: post.user_id,
    })

    if (error || !data) {
      setErrorMessage('No se pudo abrir el chat.')
      setSelectedPost(null)
      return
    }

    setSelectedPost(null)
    navigate(`/chats?c=${data}`)
  }

  return (
    <main>
      <header>
        <h1 className="text-2xl font-black text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </header>

      <div className="mt-5 flex items-center gap-2 rounded-3xl border bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="text-slate-400" />
        <input
          value={tagSearch}
          onChange={(event) => setTagSearch(event.target.value)}
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Buscar hashtag"
        />

        {tagSearch && (
          <button
            type="button"
            onClick={() => setTagSearch('')}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <section className="mt-5 rounded-3xl border bg-white p-5 shadow-sm">
        {!isComposerOpen ? (
          <button
            type="button"
            onClick={() => setIsComposerOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-4 text-left text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <span>Crear nueva publicación</span>
            <span className="text-xl leading-none">+</span>
          </button>
        ) : (
          <form onSubmit={handleCreatePost}>
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
                    : `${university || 'Universidad'} ${province ? `• ${province}` : ''}`}
                </p>
              </div>
            </div>

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={500}
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              placeholder="Escribí tu publicación"
            />

            <input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
              placeholder="Hashtags"
            />

            <div className="mt-2 flex flex-wrap gap-2">
              {normalizeTags(tagsInput).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  #{tag}
                </span>
              ))}
            </div>

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
                <button
                  type="button"
                  onClick={() => {
                    setIsComposerOpen(false)
                    setContent('')
                    setTagsInput('')
                    setIsAnonymous(false)
                  }}
                  className="rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700"
                >
                  Cancelar
                </button>

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
        )}
      </section>

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

      <section className="mt-5 space-y-4">
        {loadingPosts && (
          <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
            Cargando publicaciones...
          </div>
        )}

        {!loadingPosts && filteredPosts.length === 0 && (
          <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
            No hay publicaciones para mostrar.
          </div>
        )}

        {filteredPosts.map((post) => {
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
                <button
                  type="button"
                  onClick={() => setSelectedPost(post)}
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <div
                    className={[
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black',
                      post.is_anonymous
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-700',
                    ].join(' ')}
                  >
                    {visibleInitial}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      {visibleName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {post.is_anonymous
                        ? `${mode === 'general' ? 'Muro general' : 'Muro U'} • ${formatPostDate(post.created_at)}`
                        : `${post.university || 'Universidad'} ${
                            post.province ? `• ${post.province}` : ''
                          } • ${formatPostDate(post.created_at)}`}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPost(post)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {post.content}
              </p>

              {post.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTagSearch(tag)}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-4 border-t pt-3 text-sm text-slate-500">
                <button
                  type="button"
                  onClick={() => handleTogglePostLike(post)}
                  className={[
                    'flex items-center gap-1 font-semibold',
                    post.liked_by_me ? 'text-red-500' : 'text-slate-500',
                  ].join(' ')}
                >
                  <Heart
                    size={17}
                    fill={post.liked_by_me ? 'currentColor' : 'none'}
                  />
                  {post.likes_count}
                </button>

                <span className="flex items-center gap-1">
                  <MessageCircle size={17} />
                  {post.comments.length}
                </span>

                {isOwnPost && (
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post.id)}
                    className="ml-auto flex items-center gap-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                    Borrar
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {post.comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-900">
                      {comment.author_name}
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {comment.content}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleToggleCommentLike(comment)}
                      className={[
                        'mt-2 flex items-center gap-1 text-xs font-semibold',
                        comment.liked_by_me ? 'text-red-500' : 'text-slate-500',
                      ].join(' ')}
                    >
                      <Heart
                        size={14}
                        fill={comment.liked_by_me ? 'currentColor' : 'none'}
                      />
                      {comment.likes_count}
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  value={commentInputs[post.id] ?? ''}
                  onChange={(event) =>
                    setCommentInputs((current) => ({
                      ...current,
                      [post.id]: event.target.value,
                    }))
                  }
                  maxLength={500}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-500"
                  placeholder="Escribí un comentario..."
                />

                <button
                  type="button"
                  onClick={() => handleCreateComment(post.id)}
                  className="rounded-2xl bg-slate-900 p-3 text-white"
                >
                  <Send size={17} />
                </button>
              </div>
            </article>
          )
        })}
      </section>

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-sm font-black text-slate-900">
              {selectedPost.is_anonymous
                ? 'Publicación anónima'
                : selectedPost.author_name}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Elegí una acción para esta publicación.
            </p>

            <div className="mt-4 space-y-2">
              {!selectedPost.is_anonymous && selectedPost.user_id !== user?.id && (
                <button
                  type="button"
                  onClick={() => handleStartDirectMessage(selectedPost)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                >
                  <MessageCircle size={18} />
                  Mensaje directo
                </button>
              )}

              <button
                type="button"
                onClick={() => handleReportPost(selectedPost)}
                className="flex w-full items-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
              >
                <Flag size={18} />
                Reportar
              </button>

              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}