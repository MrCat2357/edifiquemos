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

/**
 * Renderiza o texto do comentário, transformando @menções no início em links.
 * Só linka a primeira @menção contígua no início do texto.
 */
function CommentText({ text }: { text: string }) {
  // Detecta @menção no início: "@Nome Sobrenome " seguido do restante
  const mentionMatch = text.match(/^(@[\w\s\-\.]+?)\s([\s\S]*)$/);

  if (mentionMatch) {
    const mention = mentionMatch[1]; // ex: "@Catulo Axel"
    const rest = mentionMatch[2];
    // Transforma o nome em slug para o link de perfil
    const slug = mention.replace("@", "").trim().toLowerCase().replace(/\s+/g, "-");

    return (
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--text-2)",
          lineHeight: 1.6,
          wordBreak: "break-word",
          margin: 0,
        }}
      >
        <a
          href={`/perfil/${slug}`}
          style={{
            color: "var(--emerald)",
            fontWeight: 600,
            textDecoration: "none",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLAnchorElement).style.textDecoration = "underline")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLAnchorElement).style.textDecoration = "none")
          }
        >
          {mention}
        </a>{" "}
        {rest}
      </p>
    );
  }

  return (
    <p
      style={{
        fontSize: "0.9rem",
        color: "var(--text-2)",
        lineHeight: 1.6,
        wordBreak: "break-word",
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

type Props = {
  comment: Comment;
  currentUserId: string | null;
  currentUser: { uid: string; displayName?: string | null; photoURL?: string | null } | null;
  onLike: (commentId: string, currentLikes: number, alreadyLiked: boolean) => void;
  onReply: (text: string, parentId: string, rootId: string) => Promise<void>;
  // replies é toda a lista "achatada" de replies do rootId — cada item decide sua posição
  replies?: Comment[];
  depth?: number;
  rootId?: string; // id do comentário raiz para manter a cadeia no mesmo grupo
  isLast?: boolean; // último item da lista (para cortar a linha vertical)
};

export default function CommentItem({
  comment,
  currentUserId,
  currentUser,
  onLike,
  onReply,
  replies = [],
  depth = 0,
  rootId,
  isLast = false,
}: Props) {
  const alreadyLiked = !!currentUserId && comment.likedBy.includes(currentUserId);
  const [likeHovered, setLikeHovered] = useState(false);
  const [replyHovered, setReplyHovered] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  // Replies diretas deste comentário (parentId === comment.id)
  const directReplies = replies.filter((r) => r.parentId === comment.id);
  // O rootId efetivo para toda a cadeia: se este já é uma reply, pega o rootId dele, senão é o próprio id
  const effectiveRootId = rootId ?? comment.id;

  const avatarSize = depth === 0 ? 36 : 28;
  // A linha vertical conecta o avatar ao primeiro reply — tamanho do avatar + padding
  const lineLeftOffset = Math.floor(avatarSize / 2);

  async function handleReplySubmit(text: string) {
    await onReply(text, comment.id, effectiveRootId);
    setShowReplyForm(false);
    setShowReplies(true);
  }

  // Quando é reply (depth > 0) usa div para evitar <li> dentro de <li>
  const Wrapper = depth === 0 ? "li" : "div";

  return (
    <Wrapper
      style={{
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      {/* Coluna esquerda: avatar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <AuthorAvatar
          src={comment.authorPhoto || null}
          name={comment.authorName}
          size={avatarSize}
        />
      </div>

      {/* Conteúdo */}
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
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)" }}>
            {comment.authorName}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
            {tempoRelativo(comment.createdAt)}
          </span>
        </div>

        {/* Texto com @menção linkada */}
        <CommentText text={comment.text} />

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
            onMouseEnter={() => setLikeHovered(true)}
            onMouseLeave={() => setLikeHovered(false)}
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
                likeHovered && currentUserId ? "var(--emerald-dim)" : "transparent",
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

          {/* Responder — disponível para qualquer profundidade */}
          {currentUser && (
            <button
              onClick={() => setShowReplyForm((v) => !v)}
              onMouseEnter={() => setReplyHovered(true)}
              onMouseLeave={() => setReplyHovered(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "var(--radius-full)",
                border: "none",
                background: replyHovered ? "var(--emerald-dim)" : "transparent",
                color: showReplyForm ? "var(--emerald)" : "var(--text-3)",
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

        {/* Formulário de reply — a curva vem da linha vertical do avatar acima */}
        {showReplyForm && currentUser && (
          <div style={{ marginTop: "0.75rem", position: "relative" }}>
            <CommentForm
              user={currentUser}
              onSubmit={handleReplySubmit}
              onCancel={() => setShowReplyForm(false)}
              placeholder={`Respondendo a ${comment.authorName}...`}
              autoFocus
              compact
              mentionName={comment.authorName}
            />
          </div>
        )}

        {/* Botão expandir/recolher replies */}
        {directReplies.length > 0 && (
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
            {directReplies.length} resposta{directReplies.length !== 1 ? "s" : ""}
          </button>
        )}

        {/*
          Lista de replies diretas.
          Usamos <div role="list"> para evitar <li> dentro de <li>.
          Cada reply é um <div role="listitem"> com position: relative para ancorar a curva.
          A curva conectora fica dentro do próprio wrapper, não dentro do CommentItem.
        */}
        {showReplies && directReplies.length > 0 && (
          <div
            role="list"
            style={{
              marginTop: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              // paddingLeft abre espaço para a curva + gap até o avatar do reply
              paddingLeft: `${lineLeftOffset + 12}px`,
              position: "relative",
            }}
          >
            {directReplies.map((reply, idx) => {
              const isLastReply = idx === directReplies.length - 1;
              const replyAvatarSize = 28;
              const curveHeight = Math.floor(replyAvatarSize / 2) + 4;
              const curveWidth = lineLeftOffset + 8;
              const curveLeft = lineLeftOffset + 12;

              return (
                <div key={reply.id} role="listitem" style={{ position: "relative" }}>
                  {/* Curva individual estilo YouTube: linha vertical + cotovelo horizontal */}
                  <div
                    style={{
                      position: "absolute",
                      left: `-${curveLeft}px`,
                      top: 0,
                      width: `${curveWidth}px`,
                      height: `${curveHeight}px`,
                      borderLeft: "2px solid var(--border)",
                      borderBottom: "2px solid var(--border)",
                      borderBottomLeftRadius: "10px",
                      pointerEvents: "none",
                    }}
                  />
                  <CommentItem
                    comment={reply}
                    currentUserId={currentUserId}
                    currentUser={currentUser}
                    onLike={onLike}
                    onReply={onReply}
                    replies={replies}
                    depth={depth + 1}
                    rootId={effectiveRootId}
                    isLast={isLastReply}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Wrapper>
  );
}