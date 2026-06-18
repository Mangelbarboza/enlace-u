import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProfileCard from './ProfileCard'
import PostDetailModal from './PostDetailModal'
import DirectMessageRequestModal from './DirectMessageRequestModal'

type WallMode = 'general' | 'university'

type PollOption = {
  id: string
  poll_id: string
  option_text: string
  position: number
  votes_count: number
}

type PostPoll = {
  id: string
  post_id: string
  question: string
  options: PollOption[]
  total_votes: number
  my_vote_option_id: string | null
}

export type PostComment = {
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

export type Post = {
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
  poll: PostPoll | null
}

type WallProps = {
  mode: WallMode
}

type DMRequestTarget = {
  userId: string
  displayName: string
  sourcePostId?: string | null
  sourceCommentId?: string | null
}

const PAGE_SIZE = 15

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

function getCacheKey(mode: WallMode, university: string | null) {
  return `enlace-u-wall-${mode}-${university || 'all'}-v4`
}

function savePostsToCache(key: string, posts: Post[]) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        saved_at: new Date().toISOString(),
        posts,
      }),
    )
  } catch {
    // Cache opcional.
  }
}

function readPostsFromCache(key: string) {
  try {
    const rawValue = localStorage.getItem(key)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue) as {
      saved_at: string
      posts: Post[]
    }

    if (!Array.isArray(parsedValue.posts)) {
      return null
    }

    return parsedValue.posts
  } catch {
    return null
  }
}

export default function Wall({ mode }: WallProps) {
  const { user } = useAuth()

  const displayName = user?.user_metadata?.display_name || 'Estudiante'
  const university = user?.user_metadata?.university || null
  const province =
    user?.user_metadata?.province || user?.user_metadata?.campus || null

  const cacheKey = getCacheKey(mode, university)

  const [posts, setPosts] = useState<Post[]>([])
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE)

  const [content, setContent] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)

  const [includePoll, setIncludePoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])

  const [loadingPosts, setLoadingPosts] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [detailPost, setDetailPost] = useState<Post | null>(null)
  const [profileCardUserId, setProfileCardUserId] = useState<string | null>(null)
  const [dmRequestTarget, setDmRequestTarget] = useState<DMRequestTarget | null>(
    null,
  )
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

  const visiblePosts = filteredPosts.slice(0, visibleLimit)
  const canShowMore = filteredPosts.length >= visibleLimit

  const title = mode === 'general' ? 'General' : university || 'Muro U'

  const subtitle =
    mode === 'general'
      ? 'Muro general de todas las instituciones.'
      : `Muro privado de ${university || 'tu institución'}.`

  function resetComposer() {
    setContent('')
    setTagsInput('')
    setIsAnonymous(false)
    setIncludePoll(false)
    setPollQuestion('')
    setPollOptions(['', ''])
    setIsComposerOpen(false)
  }

  function openProfileCard(userId: string) {
    setSelectedPost(null)
    setProfileCardUserId(userId)
  }

  function openDMRequest(target: DMRequestTarget) {
    setSelectedPost(null)
    setDmRequestTarget(target)
  }

  async function loadPosts(nextLimit = visibleLimit, showReloadAnimation = false) {
    if (showReloadAnimation) {
      setReloading(true)

      if ('vibrate' in navigator) {
        navigator.vibrate(25)
      }
    } else {
      setLoadingPosts(true)
    }

    setErrorMessage('')

    let query = supabase
      .from('posts')
      .select(
        'id, user_id, author_name, university, province, content, created_at, is_anonymous, tags, post_scope',
      )
      .order('created_at', { ascending: false })
      .limit(nextLimit)

    if (mode === 'general') {
      query = query.eq('post_scope', 'general')
    }

    if (mode === 'university') {
      query = query
        .eq('post_scope', 'university')
        .eq('university', university || '')
    }

    const { data, error } = await query

    if (error) {
      setLoadingPosts(false)
      setReloading(false)
      setErrorMessage('No se pudieron cargar las publicaciones.')
      return
    }

    const basePosts = data ?? []
    const postIds = basePosts.map((post) => post.id)

    if (postIds.length === 0) {
      setPosts([])
      savePostsToCache(cacheKey, [])
      setLoadingPosts(false)
      setReloading(false)
      return
    }

    const [postLikesResult, commentsResult, pollsResult] = await Promise.all([
      supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
      supabase
        .from('post_comments')
        .select(
          'id, post_id, user_id, author_name, university, province, content, created_at',
        )
        .in('post_id', postIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('post_polls')
        .select('id, post_id, question')
        .in('post_id', postIds),
    ])

    const postLikes = postLikesResult.data ?? []
    const comments = commentsResult.data ?? []
    const polls = pollsResult.data ?? []

    const commentIds = comments.map((comment) => comment.id)
    const pollIds = polls.map((poll) => poll.id)

    const [commentLikesResult, pollOptionsResult, pollVotesResult] =
      await Promise.all([
        commentIds.length > 0
          ? supabase
              .from('comment_likes')
              .select('comment_id, user_id')
              .in('comment_id', commentIds)
          : Promise.resolve({
              data: [] as { comment_id: string; user_id: string }[],
            }),
        pollIds.length > 0
          ? supabase
              .from('post_poll_options')
              .select('id, poll_id, option_text, position')
              .in('poll_id', pollIds)
              .order('position', { ascending: true })
          : Promise.resolve({
              data: [] as {
                id: string
                poll_id: string
                option_text: string
                position: number
              }[],
            }),
        pollIds.length > 0
          ? supabase
              .from('post_poll_votes')
              .select('poll_id, option_id, user_id')
              .in('poll_id', pollIds)
          : Promise.resolve({
              data: [] as {
                poll_id: string
                option_id: string
                user_id: string
              }[],
            }),
      ])

    const commentLikes = commentLikesResult.data ?? []
    const pollOptions = pollOptionsResult.data ?? []
    const pollVotes = pollVotesResult.data ?? []

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

    const pollVoteCounts = new Map<string, number>()
    const myVotesByPoll = new Map<string, string>()

    pollVotes.forEach((vote) => {
      pollVoteCounts.set(
        vote.option_id,
        (pollVoteCounts.get(vote.option_id) ?? 0) + 1,
      )

      if (vote.user_id === user?.id) {
        myVotesByPoll.set(vote.poll_id, vote.option_id)
      }
    })

    const optionsByPoll = new Map<string, PollOption[]>()

    pollOptions.forEach((option) => {
      const enrichedOption: PollOption = {
        ...option,
        votes_count: pollVoteCounts.get(option.id) ?? 0,
      }

      const current = optionsByPoll.get(option.poll_id) ?? []
      current.push(enrichedOption)
      optionsByPoll.set(option.poll_id, current)
    })

    const pollsByPost = new Map<string, PostPoll>()

    polls.forEach((poll) => {
      const options = optionsByPoll.get(poll.id) ?? []
      const totalVotes = options.reduce(
        (total, option) => total + option.votes_count,
        0,
      )

      pollsByPost.set(poll.post_id, {
        ...poll,
        options,
        total_votes: totalVotes,
        my_vote_option_id: myVotesByPoll.get(poll.id) ?? null,
      })
    })

    const enrichedPosts: Post[] = basePosts.map((post) => ({
      ...post,
      tags: post.tags ?? [],
      likes_count: postLikeCounts.get(post.id) ?? 0,
      liked_by_me: postsLikedByMe.has(post.id),
      comments: commentsByPost.get(post.id) ?? [],
      poll: pollsByPost.get(post.id) ?? null,
    }))

    setPosts(enrichedPosts)
    savePostsToCache(cacheKey, enrichedPosts)
    setLoadingPosts(false)
    setReloading(false)
  }

  useEffect(() => {
    const cachedPosts = readPostsFromCache(cacheKey)

    if (cachedPosts) {
      setPosts(cachedPosts)
      setLoadingPosts(false)
      return
    }

    loadPosts(PAGE_SIZE)
  }, [mode, university])

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const cleanContent = content.trim()
    const cleanTags = normalizeTags(tagsInput)
    const cleanPollQuestion = pollQuestion.trim()
    const cleanPollOptions = pollOptions
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 5)

    if (!user) {
      setErrorMessage('Necesitás iniciar sesión para publicar.')
      return
    }

    if (!cleanContent && !includePoll) {
      setErrorMessage('Escribí algo antes de publicar.')
      return
    }

    if (cleanContent.length > 500) {
      setErrorMessage('La publicación no puede pasar de 500 caracteres.')
      return
    }

    if (includePoll) {
      if (!cleanPollQuestion) {
        setErrorMessage('Escribí la pregunta de la encuesta.')
        return
      }

      if (cleanPollOptions.length < 2) {
        setErrorMessage('La encuesta necesita al menos 2 opciones.')
        return
      }
    }

    setPublishing(true)

    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        author_name: displayName,
        university,
        province,
        content: cleanContent || cleanPollQuestion,
        is_anonymous: isAnonymous,
        tags: cleanTags,
        post_scope: mode,
      })
      .select('id')
      .single()

    if (postError || !postData) {
      setPublishing(false)
      setErrorMessage('No se pudo publicar. Intentá de nuevo.')
      return
    }

    if (includePoll) {
      const { data: pollData, error: pollError } = await supabase
        .from('post_polls')
        .insert({
          post_id: postData.id,
          question: cleanPollQuestion,
        })
        .select('id')
        .single()

      if (pollError || !pollData) {
        setPublishing(false)
        setErrorMessage('Se creó el post, pero no se pudo crear la encuesta.')
        await loadPosts(visibleLimit, true)
        return
      }

      const optionsPayload = cleanPollOptions.map((option, index) => ({
        poll_id: pollData.id,
        option_text: option,
        position: index + 1,
      }))

      const { error: optionsError } = await supabase
        .from('post_poll_options')
        .insert(optionsPayload)

      if (optionsError) {
        setPublishing(false)
        setErrorMessage('Se creó el post, pero no se pudieron guardar las opciones.')
        await loadPosts(visibleLimit, true)
        return
      }
    }

    setPublishing(false)
    resetComposer()
    await loadPosts(visibleLimit, true)
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

    await loadPosts(visibleLimit, true)
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

    await loadPosts(visibleLimit, true)
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

    await loadPosts(visibleLimit, true)
  }

  async function handleVotePoll(post: Post, optionId: string) {
    if (!user || !post.poll || post.poll.my_vote_option_id) {
      return
    }

    const { error } = await supabase.from('post_poll_votes').insert({
      poll_id: post.poll.id,
      option_id: optionId,
      user_id: user.id,
    })

    if (error) {
      setErrorMessage('No se pudo registrar tu voto.')
      return
    }

    await loadPosts(visibleLimit, true)
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
    setDetailPost(null)
    await loadPosts(visibleLimit, true)
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

  function handleAddPollOption() {
    if (pollOptions.length >= 5) {
      return
    }

    setPollOptions((current) => [...current, ''])
  }

  function handleRemovePollOption(indexToRemove: number) {
    if (pollOptions.length <= 2) {
      return
    }

    setPollOptions((current) =>
      current.filter((_, index) => index !== indexToRemove),
    )
  }

  function handleUpdatePollOption(indexToUpdate: number, value: string) {
    setPollOptions((current) =>
      current.map((option, index) =>
        index === indexToUpdate ? value : option,
      ),
    )
  }

  async function handleManualReload() {
    await loadPosts(visibleLimit, true)
  }

  async function handleShowMore() {
    const nextLimit = visibleLimit + PAGE_SIZE
    setVisibleLimit(nextLimit)
    await loadPosts(nextLimit, true)
  }

  function renderPollPreview(post: Post) {
    if (!post.poll) {
      return null
    }

    const hasVoted = Boolean(post.poll.my_vote_option_id)
    const totalVotes = post.poll.total_votes

    return (
      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
          <BarChart3 size={15} />
          Encuesta
        </div>

        <p className="mt-2 text-sm font-bold text-slate-800">
          {post.poll.question}
        </p>

        <div className="mt-3 space-y-2">
          {post.poll.options.map((option) => {
            const percentage =
              totalVotes > 0 ? Math.round((option.votes_count / totalVotes) * 100) : 0

            return (
              <button
                key={option.id}
                type="button"
                disabled={hasVoted}
                onClick={() => handleVotePoll(post, option.id)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm disabled:cursor-default"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-700">
                    {option.option_text}
                  </span>

                  {hasVoted && (
                    <span className="text-xs font-bold text-slate-500">
                      {percentage}%
                    </span>
                  )}
                </div>

                {hasVoted && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <p className="mt-2 text-xs text-slate-400">
          {hasVoted
            ? `${totalVotes} voto${totalVotes === 1 ? '' : 's'} en total`
            : 'Votá para ver los resultados'}
        </p>
      </div>
    )
  }

  return (
    <main>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={handleManualReload}
          disabled={reloading}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-70"
        >
          <RefreshCw
            size={17}
            className={reloading ? 'animate-spin' : ''}
          />
          <span className="hidden sm:inline">
            {reloading ? 'Actualizando' : 'Recargar'}
          </span>
        </button>
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
            <Plus size={18} />
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
                    : `${university || 'Institución'} ${province ? `• ${province}` : ''}`}
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

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-slate-700">
                <span>Agregar encuesta</span>
                <input
                  type="checkbox"
                  checked={includePoll}
                  onChange={(event) => setIncludePoll(event.target.checked)}
                  className="h-4 w-4"
                />
              </label>

              {includePoll && (
                <div className="mt-3 space-y-3">
                  <input
                    value={pollQuestion}
                    maxLength={160}
                    onChange={(event) => setPollQuestion(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
                    placeholder="Pregunta de la encuesta"
                  />

                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={option}
                        maxLength={80}
                        onChange={(event) =>
                          handleUpdatePollOption(index, event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
                        placeholder={`Opción ${index + 1}`}
                      />

                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePollOption(index)}
                          className="rounded-xl bg-white p-3 text-slate-400"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}

                  {pollOptions.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddPollOption}
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-600"
                    >
                      Agregar opción
                    </button>
                  )}
                </div>
              )}
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
                  onClick={resetComposer}
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

        {!loadingPosts && visiblePosts.length === 0 && (
          <div className="rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
            No hay publicaciones para mostrar.
          </div>
        )}

        {visiblePosts.map((post) => {
          const isOwnPost = post.user_id === user?.id
          const visibleName = post.is_anonymous ? 'Anónimo' : post.author_name
          const visibleInitial = post.is_anonymous
            ? '?'
            : post.author_name.charAt(0).toUpperCase()
          const lastComment =
            post.comments.length > 0
              ? post.comments[post.comments.length - 1]
              : null
          const isLongPost = post.content.length > 180

          return (
            <article
              key={post.id}
              className="rounded-3xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!post.is_anonymous) {
                      openProfileCard(post.user_id)
                    }
                  }}
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
                        : `${post.university || 'Institución'} ${
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

              <button
                type="button"
                onClick={() => setDetailPost(post)}
                className="mt-4 block w-full text-left"
              >
                <div className="min-h-20 max-h-24 overflow-hidden">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {isLongPost
                      ? `${post.content.slice(0, 180).trim()}...`
                      : post.content}
                  </p>
                </div>

                {isLongPost && (
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    Tocar para leer completo
                  </p>
                )}
              </button>

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

              {renderPollPreview(post)}

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

                <button
                  type="button"
                  onClick={() => setDetailPost(post)}
                  className="flex items-center gap-1"
                >
                  <MessageCircle size={17} />
                  {post.comments.length}
                </button>

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

              {lastComment && (
                <button
                  type="button"
                  onClick={() => setDetailPost(post)}
                  className="mt-4 w-full rounded-2xl bg-slate-50 p-3 text-left"
                >
                  <p className="text-xs font-bold text-slate-900">
                    Último comentario
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    {lastComment.author_name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                    {lastComment.content}
                  </p>
                </button>
              )}

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

        {!loadingPosts && canShowMore && (
          <button
            type="button"
            onClick={handleShowMore}
            className="w-full rounded-3xl border bg-white px-5 py-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Ver más publicaciones
          </button>
        )}
      </section>

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
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
              {!selectedPost.is_anonymous && (
                <button
                  type="button"
                  onClick={() => openProfileCard(selectedPost.user_id)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
                >
                  <UserRound size={18} />
                  Mirar carta de perfil
                </button>
              )}

              {!selectedPost.is_anonymous && selectedPost.user_id !== user?.id && (
                <button
                  type="button"
                  onClick={() =>
                    openDMRequest({
                      userId: selectedPost.user_id,
                      displayName: selectedPost.author_name,
                      sourcePostId: selectedPost.id,
                      sourceCommentId: null,
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                >
                  <MessageCircle size={18} />
                  Solicitar mensaje
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

      <PostDetailModal
        post={detailPost}
        userId={user?.id ?? null}
        commentValue={detailPost ? commentInputs[detailPost.id] ?? '' : ''}
        onClose={() => setDetailPost(null)}
        onOpenProfile={openProfileCard}
        onRequestDirectMessage={({ userId, displayName, sourcePostId, sourceCommentId }) =>
          openDMRequest({
            userId,
            displayName,
            sourcePostId,
            sourceCommentId,
          })
        }
        onTogglePostLike={handleTogglePostLike}
        onToggleCommentLike={handleToggleCommentLike}
        onCommentChange={(postId, value) =>
          setCommentInputs((current) => ({
            ...current,
            [postId]: value,
          }))
        }
        onCreateComment={handleCreateComment}
        onVotePoll={handleVotePoll}
      />

      <ProfileCard
        userId={profileCardUserId}
        open={Boolean(profileCardUserId)}
        onClose={() => setProfileCardUserId(null)}
      />

      <DirectMessageRequestModal
        open={Boolean(dmRequestTarget)}
        receiverUserId={dmRequestTarget?.userId ?? null}
        receiverName={dmRequestTarget?.displayName ?? ''}
        sourcePostId={dmRequestTarget?.sourcePostId ?? null}
        sourceCommentId={dmRequestTarget?.sourceCommentId ?? null}
        onClose={() => setDmRequestTarget(null)}
        onSuccess={() => {
          setSuccessMessage('Solicitud enviada correctamente.')
          setDmRequestTarget(null)
        }}
      />
    </main>
  )
}