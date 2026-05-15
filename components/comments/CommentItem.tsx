import { useState } from "react";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import { Comment } from "@/hooks/useComments";
import CommentForm from "./CommentForm";

function IconThumbsUp({ size = 14, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M5 14H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2m0 7V7m0 7h6.5a1 1 0 0 0 .97-.757l1-4A1 1 0 0 0 13.5 7H10V4a2 2 0 0 0-2-2L5 7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

function IconReply({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M1.5 5.5L6 1.5V4C10.5 4 14 6.5 14 11C12.5 8.5 10 7.5 6 7.5V10L1.5 5.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function tempoRelativo(timestamp: any): string {
  if (!timestamp?.toDate) return "";
  const diff = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `há ${Math.floor(diff / 86400)} dias`;
  return timestamp.toDate().toLocaleDateString("pt-BR");
}

type Props = {
  comment: Comment;
  currentUserId: string | null;
  currentUser: { displayName?: string | null; photoURL?: string | null } | null;
  onLike: (commentId: string, currentLikes: number, alreadyLiked: boolean) => void;
  onReply: (text: string, parentId: string) => Promise<void>;
  replies?: Comment[];
  depth?: number; // 0 = raiz, 1 = reply (não aninhamos mais fundo, como o YouTube)
};

export default function CommentItem({
  comment,
  currentUserId,
  currentUser,
  onLike,
  onReply,
  replies = [],
  depth = 0,
}: Props) {
  const alreadyLiked = !!currentUserId && comment.likedBy.includes(currentUserId);
  const [hovered, setHovered] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  async function handleReplySubmit(text: string) {
    await onReply(text, comment.id);
    setShowReplyForm(false);
    setShowReplies(true); // mostra as replies após enviar
  }

  return (
    <li style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
      <AuthorAvatar
        src={comment.authorPhoto || null}
        name={comment.authorName}
        size={depth === 0 ? 36 : 28}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Cabeçalho */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.25rem",
          }}
        >
          <span
            style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)" }}
          >
            {comment.authorName}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
            {tempoRelativo(comment.createdAt)}
          </span>
        </div>

        {/* Texto */}
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-2)",
            lineHeight: 1.6,
            wordBreak: "break-word",
            margin: 0,
          }}
        >
          {comment.text}
        </p>

        {/* Ações */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            marginTop: "0.375rem",
          }}
        >
          {/* Like */}
          <button
            onClick={() =>
              currentUserId && onLike(comment.id, comment.likes, alreadyLiked)
            }
            disabled={!currentUserId}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title={
              currentUserId
                ? alreadyLiked
                  ? "Remover curtida"
                  : "Curtir"
                : "Faça login para curtir"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "var(--radius-full)",
              border: "none",
              background:
                hovered && currentUserId ? "var(--emerald-dim)" : "transparent",
              color: alreadyLiked ? "var(--emerald)" : "var(--text-3)",
              cursor: currentUserId ? "pointer" : "default",
              fontSize: "0.78rem",
              fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            <IconThumbsUp size={13} filled={alreadyLiked} />
            {comment.likes > 0 && <span>{comment.likes}</span>}
          </button>

          {/* Responder — só em comentários raiz */}
          {depth === 0 && currentUser && (
            <button
              onClick={() => setShowReplyForm((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "var(--radius-full)",
                border: "none",
                background: "transparent",
                color: "var(--text-3)",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              <IconReply size={13} />
              Responder
            </button>
          )}
        </div>

        {/* Formulário de reply */}
        {showReplyForm && currentUser && (
          <div style={{ marginTop: "0.75rem" }}>
            <CommentForm
              user={currentUser}
              onSubmit={handleReplySubmit}
              onCancel={() => setShowReplyForm(false)}
              placeholder={`Respondendo a ${comment.authorName}...`}
              autoFocus
              compact
            />
          </div>
        )}

        {/* Expandir / recolher replies */}
        {depth === 0 && replies.length > 0 && (
          <button
            onClick={() => setShowReplies((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "0.6rem",
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              border: "none",
              background: "var(--emerald-dim, rgba(52,211,153,0.1))",
              color: "var(--emerald)",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: 700,
              transition: "all 0.15s",
            }}
          >
            {showReplies ? "▲" : "▼"}{" "}
            {replies.length} resposta{replies.length !== 1 ? "s" : ""}
          </button>
        )}

        {/* Lista de replies */}
        {depth === 0 && showReplies && replies.length > 0 && (
          <ul
            style={{
              marginTop: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              listStyle: "none",
              padding: 0,
              paddingLeft: "0.5rem",
              borderLeft: "2px solid var(--border)",
            }}
          >
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                currentUser={currentUser}
                onLike={onLike}
                onReply={onReply}
                replies={[]}
                depth={1}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}