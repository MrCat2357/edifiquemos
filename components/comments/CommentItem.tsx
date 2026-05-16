import { useState, useRef, useEffect } from "react";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import { Comment } from "@/hooks/useComments";
import CommentForm from "./CommentForm";

// ── Ícones ───────────────────────────────────────────────────────────────────

function IconThumbsUp({ size = 14, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M5 14H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2m0 7V7m0 7h6.5a1 1 0 0 0 .97-.757l1-4A1 1 0 0 0 13.5 7H10V4a2 2 0 0 0-2-2L5 7"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

function IconReply({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M1.5 5.5L6 1.5V4C10.5 4 14 6.5 14 11C12.5 8.5 10 7.5 6 7.5V10L1.5 5.5Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconDots({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="3" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="13" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}

function IconEdit({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2 4h12M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5L13 4"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Utilitários ──────────────────────────────────────────────────────────────

export function tempoRelativo(timestamp: any): string {
  if (!timestamp?.toDate) return "";
  const diff = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `há ${Math.floor(diff / 86400)} dias`;
  return timestamp.toDate().toLocaleDateString("pt-BR");
}

// ── CommentText ──────────────────────────────────────────────────────────────

function CommentText({ text, mentionSlug }: { text: string; mentionSlug?: string | null }) {
  const mentionMatch = text.match(/^(@[\w\s\-\.]+?)\s([\s\S]*)$/);

  const pStyle: React.CSSProperties = {
    fontSize: "0.9rem",
    color: "var(--text-2)",
    lineHeight: 1.6,
    wordBreak: "break-word",
    margin: 0,
  };

  if (mentionMatch && mentionSlug) {
    const mention = mentionMatch[1];
    const rest = mentionMatch[2];
    return (
      <p style={pStyle}>
        <a
          href={`/perfil/${mentionSlug}`}
          style={{ color: "var(--emerald)", fontWeight: 600, textDecoration: "none" }}
          onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.textDecoration = "underline")}
          onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.textDecoration = "none")}
        >
          {mention}
        </a>{" "}{rest}
      </p>
    );
  }

  return <p style={pStyle}>{text}</p>;
}

// ── Menu de ações (⋯) ────────────────────────────────────────────────────────

type ActionsMenuProps = {
  onEdit: () => void;
  onDelete: () => void;
};

function ActionsMenu({ onEdit, onDelete }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true);
    } else {
      setOpen(false);
      setConfirmDelete(false);
      onDelete();
    }
  }

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen((v) => !v); setConfirmDelete(false); }}
        title="Opções"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 6px",
          borderRadius: "var(--radius-full)",
          border: "none",
          background: open ? "var(--surface-2, rgba(255,255,255,0.06))" : "transparent",
          color: "var(--text-3)",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        <IconDots size={15} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 50,
            minWidth: 140,
            background: "var(--bg-elevated, #1a1a1a)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 10px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          {/* Editar */}
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "9px 14px",
              border: "none",
              background: "none",
              color: "var(--text-2)",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "var(--surface-2, rgba(255,255,255,0.06))")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "none")
            }
          >
            <IconEdit size={13} />
            Editar
          </button>

          <div style={{ height: 1, background: "var(--border)", margin: "0 10px" }} />

          {/* Excluir — dois cliques para confirmar */}
          <button
            onClick={handleDeleteClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "9px 14px",
              border: "none",
              background: confirmDelete ? "rgba(239,68,68,0.12)" : "none",
              color: confirmDelete ? "#f87171" : "var(--text-2)",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              if (!confirmDelete)
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--surface-2, rgba(255,255,255,0.06))";
            }}
            onMouseLeave={(e) => {
              if (!confirmDelete)
                (e.currentTarget as HTMLButtonElement).style.background = "none";
            }}
          >
            <IconTrash size={13} />
            {confirmDelete ? "Confirmar exclusão" : "Excluir"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── InlineEditForm ────────────────────────────────────────────────────────────

function InlineEditForm({
  initialText,
  onSave,
  onCancel,
}: {
  initialText: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const len = text.length;
    textareaRef.current?.setSelectionRange(len, len);
  }, []);

  async function handleSave() {
    if (!text.trim() || saving || text.trim() === initialText.trim()) {
      onCancel();
      return;
    }
    setSaving(true);
    await onSave(text.trim());
    setSaving(false);
  }

  return (
    <div style={{ marginTop: "0.25rem" }}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid var(--emerald)",
          color: "var(--text-1)",
          fontSize: "0.9rem",
          resize: "none",
          outline: "none",
          padding: "4px 0",
          fontFamily: "inherit",
          lineHeight: 1.6,
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "5px 14px",
            borderRadius: "var(--radius-full)",
            border: "none",
            background: "none",
            color: "var(--text-3)",
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          style={{
            padding: "5px 14px",
            borderRadius: "var(--radius-full)",
            border: "none",
            background: text.trim() ? "var(--emerald)" : "var(--border)",
            color: text.trim() ? "#fff" : "var(--text-3)",
            cursor: text.trim() ? "pointer" : "default",
            fontSize: "0.8rem",
            fontWeight: 600,
            transition: "all 0.15s",
          }}
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ── CommentItem ──────────────────────────────────────────────────────────────

type Props = {
  comment: Comment;
  currentUserId: string | null;
  currentUser: {
    uid: string;
    displayName?: string | null;
    photoURL?: string | null;
    platformName?: string | null;
    platformSlug?: string | null;
    platformPhoto?: string | null;
  } | null;
  onLike: (commentId: string, currentLikes: number, alreadyLiked: boolean) => void;
  onReply: (text: string, parentId: string, rootId: string) => Promise<void>;
  onEdit: (commentId: string, newText: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  // Chamado quando um usuário não logado clica em "Responder"
  onLoginRequired: () => void;
  replies?: Comment[];
  depth?: number;
  rootId?: string;
  isLast?: boolean;
  parentAuthorSlug?: string | null;
};

export default function CommentItem({
  comment,
  currentUserId,
  currentUser,
  onLike,
  onReply,
  onEdit,
  onDelete,
  onLoginRequired,
  replies = [],
  depth = 0,
  rootId,
  isLast = false,
  parentAuthorSlug = null,
}: Props) {
  const isOwner = !!currentUserId && comment.authorId === currentUserId;
  const alreadyLiked = !!currentUserId && comment.likedBy.includes(currentUserId);

  const [likeHovered, setLikeHovered] = useState(false);
  const [replyHovered, setReplyHovered] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [editing, setEditing] = useState(false);
  // Nudge inline para usuários não logados que clicam em Responder
  const [showLoginNudge, setShowLoginNudge] = useState(false);

  const directReplies = replies.filter((r) => r.parentId === comment.id);
  const effectiveRootId = rootId ?? comment.id;

  // Tamanho de avatar: root = 36, replies = 28 (independente da profundidade)
  const avatarSize = depth === 0 ? 36 : 28;

  async function handleReplySubmit(text: string) {
    await onReply(text, comment.id, effectiveRootId);
    setShowReplyForm(false);
    setShowReplies(true);
  }

  async function handleEditSave(newText: string) {
    await onEdit(comment.id, newText);
    setEditing(false);
  }

  // Clique no botão Responder: abre formulário se logado; nudge inline se não
  function handleReplyClick() {
    if (currentUser) {
      setShowReplyForm((v) => !v);
      setShowLoginNudge(false);
    } else {
      onLoginRequired(); // sobe o banner no topo dos comentários
      setShowLoginNudge(true); // e mostra o nudge aqui perto do botão
    }
  }

  const Wrapper = depth === 0 ? "li" : "div";

  return (
    <Wrapper style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", position: "relative" }}>
      {/* Avatar */}
      <div style={{ flexShrink: 0 }}>
        <AuthorAvatar src={comment.authorPhoto || null} name={comment.authorName} size={avatarSize} />
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)" }}>
            {comment.authorName}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
            {tempoRelativo(comment.createdAt)}
          </span>
          {comment.editedAt && (
            <span style={{ fontSize: "0.68rem", color: "var(--text-3)", fontStyle: "italic" }}>
              (editado)
            </span>
          )}
          {isOwner && !editing && (
            <div style={{ marginLeft: "auto" }}>
              <ActionsMenu
                onEdit={() => setEditing(true)}
                onDelete={() => onDelete(comment.id)}
              />
            </div>
          )}
        </div>

        {/* Texto ou formulário de edição inline */}
        {editing ? (
          <InlineEditForm
            initialText={comment.text}
            onSave={handleEditSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <CommentText text={comment.text} mentionSlug={parentAuthorSlug} />
        )}

        {/* Ações (like / responder) — ocultas durante edição */}
        {!editing && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.375rem" }}>
            {/* Like */}
            <button
              onClick={() => currentUserId && onLike(comment.id, comment.likes, alreadyLiked)}
              disabled={!currentUserId}
              onMouseEnter={() => setLikeHovered(true)}
              onMouseLeave={() => setLikeHovered(false)}
              title={currentUserId ? (alreadyLiked ? "Remover curtida" : "Curtir") : "Faça login para curtir"}
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "4px 8px", borderRadius: "var(--radius-full)", border: "none",
                background: likeHovered && currentUserId ? "var(--emerald-dim)" : "transparent",
                color: alreadyLiked ? "var(--emerald)" : "var(--text-3)",
                cursor: currentUserId ? "pointer" : "default",
                fontSize: "0.78rem", fontWeight: 600, transition: "all 0.15s",
              }}
            >
              <IconThumbsUp size={13} filled={alreadyLiked} />
              {comment.likes > 0 && <span>{comment.likes}</span>}
            </button>

            {/* Responder — visível para todos */}
            <button
              onClick={handleReplyClick}
              onMouseEnter={() => setReplyHovered(true)}
              onMouseLeave={() => setReplyHovered(false)}
              title={currentUser ? "Responder" : "Faça login para responder"}
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "4px 8px", borderRadius: "var(--radius-full)", border: "none",
                background: replyHovered ? "var(--emerald-dim)" : "transparent",
                color: showReplyForm ? "var(--emerald)" : "var(--text-3)",
                cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, transition: "all 0.15s",
              }}
            >
              <IconReply size={13} />
              Responder
            </button>
          </div>
        )}

        {/* Nudge inline para usuário não logado — aparece logo abaixo das ações */}
        {showLoginNudge && !currentUser && (
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              marginTop: "0.5rem", padding: "6px 12px",
              background: "var(--emerald-dim, rgba(52,211,153,0.12))",
              border: "1px solid var(--emerald)",
              borderRadius: "var(--radius-full)",
              fontSize: "0.78rem", color: "var(--emerald)", fontWeight: 600,
            }}
          >
            <span>👆</span>
            <span>Entre para responder — veja o convite acima</span>
            <button
              onClick={() => setShowLoginNudge(false)}
              style={{
                background: "none", border: "none", color: "var(--emerald)",
                cursor: "pointer", fontSize: "0.75rem", padding: "0 2px", lineHeight: 1,
              }}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        )}

        {/* Formulário de reply — só abre se logado */}
        {showReplyForm && currentUser && (
          <div style={{ marginTop: "0.75rem" }}>
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

        {/* Expandir/recolher replies */}
        {directReplies.length > 0 && (
          <button
            onClick={() => setShowReplies((v) => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              marginTop: "0.6rem", padding: "4px 10px",
              borderRadius: "var(--radius-full)", border: "none",
              background: "var(--emerald-dim, rgba(52,211,153,0.1))",
              color: "var(--emerald)", cursor: "pointer",
              fontSize: "0.78rem", fontWeight: 700, transition: "all 0.15s",
            }}
          >
            {showReplies ? "▲" : "▼"}{" "}
            {directReplies.length} resposta{directReplies.length !== 1 ? "s" : ""}
          </button>
        )}

        {/*
          ── Lista de replies — estilo YouTube ───────────────────────────────
          Linha vertical no container que conecta todos os filhos.
          Cada filho intermediário tem um braço horizontal saindo da linha.
          O último filho tem um gancho curvo que "fecha" a linha.
        */}
        {showReplies && directReplies.length > 0 && (
          <div
            role="list"
            style={{
              marginTop: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.875rem",
              paddingLeft: "20px",
              position: "relative",
            }}
          >
            {directReplies.map((reply, idx) => {
              const isLastReply = idx === directReplies.length - 1;

              return (
                <div key={reply.id} role="listitem" style={{ position: "relative" }}>
                  {isLastReply ? (
                    /*
                      Último filho: curva em L que fecha a linha vertical.
                      height cobre até o centro do avatar (≈14px = metade de 28px).
                    */
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: "-20px",
                        top: 0,
                        width: "16px",
                        height: "15px",
                        borderLeft: "1.5px solid var(--border)",
                        borderBottom: "1.5px solid var(--border)",
                        borderBottomLeftRadius: "6px",
                        pointerEvents: "none",
                      }}
                    />
                  ) : (
                    /*
                      Filhos intermediários:
                      - Linha vertical que vai do topo até o fundo do item
                        (conecta com o próximo irmão)
                      - Braço horizontal que sai da linha até o avatar
                    */
                    <>
                      {/* Linha vertical contínua para o próximo irmão */}
                      <div
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: "-20px",
                          top: 0,
                          bottom: `-0.875rem`, // cobre o gap entre itens
                          width: "1.5px",
                          background: "var(--border)",
                          pointerEvents: "none",
                        }}
                      />
                      {/* Braço horizontal até o avatar */}
                      <div
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: "-20px",
                          top: "15px",
                          width: "16px",
                          height: "1.5px",
                          background: "var(--border)",
                          pointerEvents: "none",
                        }}
                      />
                    </>
                  )}
                  <CommentItem
                    comment={reply}
                    currentUserId={currentUserId}
                    currentUser={currentUser}
                    onLike={onLike}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onLoginRequired={onLoginRequired}
                    replies={replies}
                    depth={depth + 1}
                    rootId={effectiveRootId}
                    isLast={isLastReply}
                    parentAuthorSlug={comment.authorSlug || null}
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