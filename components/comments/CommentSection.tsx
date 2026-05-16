import { useAuth } from "@/lib/useAuth";
import { auth } from "@/lib/firebase";
import { useComments } from "@/hooks/useComments";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";
import BannerLogin from "@/components/BannerLogin";
import { useState } from "react";

type Props = { postId: string };

export default function CommentSection({ postId }: Props) {
  const { user } = useAuth();
  const { comments, rootComments, getReplies, loading, addComment, toggleLike } =
    useComments(postId);
  const [showBanner, setShowBanner] = useState(false);
  const currentUserId = auth.currentUser?.uid ?? null;

  /**
   * Chamado pelo CommentItem ao submeter uma reply.
   * parentId = id do comentário sendo respondido (pode ser qualquer nível)
   * rootId   = id do comentário raiz do grupo (para manter tudo agrupado)
   */
  async function handleReply(text: string, parentId: string, rootId: string) {
    if (!user) return;
    await addComment(text, user, parentId, rootId);
  }

  return (
    <section style={{ marginTop: "2.5rem" }}>
      {/* Cabeçalho */}
      <h2
        style={{
          fontSize: "1rem",
          fontWeight: 700,
          color: "var(--text-1)",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        💬{" "}
        {loading
          ? "Comentários"
          : `${comments.length} Comentário${comments.length !== 1 ? "s" : ""}`}
      </h2>

      {/* Formulário principal ou convite para login */}
      {user ? (
        <CommentForm
          user={user}
          onSubmit={(text) => addComment(text, user, null, null)}
        />
      ) : (
        <div style={{ marginBottom: "1rem" }}>
          {showBanner ? (
            <BannerLogin onClose={() => setShowBanner(false)} />
          ) : (
            <button
              onClick={() => setShowBanner(true)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-full)",
                background: "transparent",
                color: "var(--text-3)",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Adicione um comentário...
            </button>
          )}
        </div>
      )}

      {/* Lista de comentários raiz */}
      <ul
        style={{
          marginTop: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {loading ? (
          <li style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>
            <div
              className="spinner"
              style={{ display: "inline-block", marginRight: "0.5rem" }}
            />
            Carregando comentários...
          </li>
        ) : rootComments.length === 0 ? (
          <li
            style={{
              color: "var(--text-3)",
              fontSize: "0.85rem",
              fontStyle: "italic",
            }}
          >
            Seja o primeiro a comentar.
          </li>
        ) : (
          rootComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              currentUser={user ?? null}
              onLike={(id, currentLikes, alreadyLiked) =>
                toggleLike(id, currentUserId!, currentLikes, alreadyLiked)
              }
              onReply={handleReply}
              replies={getReplies(comment.id)}
              depth={0}
              rootId={comment.id}
            />
          ))
        )}
      </ul>
    </section>
  );
}