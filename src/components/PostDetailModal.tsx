import {
  BarChart3,
  Heart,
  MessageCircle,
  Send,
  UserRound,
  X,
} from 'lucide-react'
import type { Post, PostComment } from './Wall'

type DMRequestPayload = {
  userId: string
  displayName: string
  sourcePostId?: string | null
  sourceCommentId?: string | null
}

type PostDetailModalProps = {
  post: Post | null
  userId: string | null
  commentValue: string
  onClose: () => void
  onOpenProfile: (userId: string) => void
  onRequestDirectMessage: (payload: DMRequestPayload) => void
  onTogglePostLike: (post: Post) => Promise<void>
  onToggleCommentLike: (comment: PostComment) => Promise<void>
  onCommentChange: (postId: string, value: string) => void
  onCreateComment: (postId: string) => Promise<void>
  onVotePoll: (post: Post, optionId: string) => Promise<void>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function PostDetailModal({
  post,
  userId,
  commentValue,
  onClose,
  onOpenProfile,
  onRequestDirectMessage,
  onTogglePostLike,
  onToggleCommentLike,
  onCommentChange,
  onCreateComment,
  onVotePoll,
}: PostDetailModalProps) {
  if (!post) {
    return null
  }

  const visibleName = post.is_anonymous ? 'Anónimo' : post.author_name
  const visibleInitial = post.is_anonymous
    ? '?'
    : post.author_name.charAt(0).toUpperCase()

  const hasPoll = Boolean(post.poll)
  const hasVoted = Boolean(post.poll?.my_vote_option_id)
  const totalVotes = post.poll?.total_votes ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <section className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b p-5">
          <button
            type="button"
            onClick={() => {
              if (!post.is_anonymous) {
                onOpenProfile(post.user_id)
              }
            }}
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <div
              className={[
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black',
                post.is_anonymous
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-700',
              ].join(' ')}
            >
              {visibleInitial}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900">
                {visibleName}
              </p>

              <p className="text-xs text-slate-500">
                {post.is_anonymous
                  ? `Publicación anónima • ${formatDate(post.created_at)}`
                  : `${post.university || 'Institución'} ${
                      post.province ? `• ${post.province}` : ''
                    } • ${formatDate(post.created_at)}`}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 p-2 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {post.content}
          </p>

          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {hasPoll && post.poll && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
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
                    totalVotes > 0
                      ? Math.round((option.votes_count / totalVotes) * 100)
                      : 0

                  const isMyVote = post.poll?.my_vote_option_id === option.id

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={hasVoted}
                      onClick={() => onVotePoll(post, option.id)}
                      className={[
                        'w-full rounded-2xl border p-3 text-left text-sm disabled:cursor-default',
                        isMyVote
                          ? 'border-slate-900 bg-white'
                          : 'border-slate-200 bg-white',
                      ].join(' ')}
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
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4 text-sm text-slate-500">
            <button
              type="button"
              onClick={() => onTogglePostLike(post)}
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

            {!post.is_anonymous && (
              <button
                type="button"
                onClick={() => onOpenProfile(post.user_id)}
                className="flex items-center gap-1 font-semibold text-slate-500"
              >
                <UserRound size={17} />
                Perfil
              </button>
            )}

            {!post.is_anonymous && post.user_id !== userId && (
              <button
                type="button"
                onClick={() =>
                  onRequestDirectMessage({
                    userId: post.user_id,
                    displayName: post.author_name,
                    sourcePostId: post.id,
                    sourceCommentId: null,
                  })
                }
                className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
              >
                <MessageCircle size={15} />
                Solicitar DM
              </button>
            )}
          </div>

          <section className="mt-5">
            <h3 className="text-sm font-black text-slate-900">
              Comentarios
            </h3>

            {post.comments.length === 0 && (
              <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Todavía no hay comentarios.
              </p>
            )}

            <div className="mt-3 space-y-3">
              {post.comments.map((comment) => (
                <article key={comment.id} className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(comment.user_id)}
                      className="text-left"
                    >
                      <p className="text-xs font-bold text-slate-900">
                        {comment.author_name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatDate(comment.created_at)}
                      </p>
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenProfile(comment.user_id)}
                        className="rounded-xl bg-white px-2 py-1 text-[11px] font-bold text-slate-500"
                      >
                        Perfil
                      </button>

                      {comment.user_id !== userId && (
                        <button
                          type="button"
                          onClick={() =>
                            onRequestDirectMessage({
                              userId: comment.user_id,
                              displayName: comment.author_name,
                              sourcePostId: post.id,
                              sourceCommentId: comment.id,
                            })
                          }
                          className="rounded-xl bg-slate-900 px-2 py-1 text-[11px] font-bold text-white"
                        >
                          Solicitar DM
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {comment.content}
                  </p>

                  <button
                    type="button"
                    onClick={() => onToggleCommentLike(comment)}
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
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <input
              value={commentValue}
              onChange={(event) => onCommentChange(post.id, event.target.value)}
              maxLength={500}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-500"
              placeholder="Escribí un comentario..."
            />

            <button
              type="button"
              onClick={() => onCreateComment(post.id)}
              className="rounded-2xl bg-slate-900 p-3 text-white"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}