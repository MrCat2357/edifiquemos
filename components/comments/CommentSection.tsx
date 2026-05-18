import { useAuth } from "@/lib/useAuth";
import { auth, db } from "@/lib/firebase";
import { useComments, CommentUser } from "@/hooks/useComments";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";
import BannerLogin from "@/components/BannerLogin";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";

type Props = {
  postId: string;
  onCountChange?: (n: number) => void;
  /**
   * Coleção raiz onde os comentários estão armazenados.
   * "posts"     → /posts/{postId}/comments     (padrão, retrocompatível)
   * "reflexoes" → /reflexoes/{postId}/comments
   */
  collectionRoot?: "posts" | "reflexoes";
};

export default function CommentSection({
  postId,
  onCountChange,
  collectionRoot = "posts",
}: Props) {
  const { user } = useAuth();
  const {
    comments,
    rootComments,
    getReplies,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    addComment,
    editComment,
    deleteComment,
    toggleLike,
  } = useComments(postId, collectionRoot);
  const [showBanner, setShowBanner] = useState(false);
  const currentUserId = auth.currentUser?.uid ?? null;

  // Notifica o pai sempre que o total de comentários mudar
  useEffect(() => {
    if (!loading) onCountChange?.(comments.length);
  }, [comments.length, loading]);

  // Busca dados da plataforma (/users/{uid}) para enriquecer o usuário
  const [platformUser, setPlatformUser] = useState<CommentUser | null>(null);

  useEffect(() => {
    if (!user) {
      setPlatformUser(null);
      return;
    }

    async function fetchPlatformData() {
      const userDoc = await getDoc(doc(db, "users", user!.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const titulo = data.titulo?.trim() || "";
        const nome = data.nome?.trim() || "";
        const nomeCompleto = titulo && nome ? `${titulo} ${nome}` : nome || titulo || null;

        setPlatformUser({
          uid: user!.uid,
          displayName: user!.displayName,
          photoURL: user!.photoURL,
          platformName: nomeCompleto,
          platformSlug: data.slug || null,
          platformPhoto: data.fotoUrl || null,
        });
      } else {
        setPlatformUser({
          uid: user!.uid,
          displayName: user!.displayName,
          photoURL: user!.photoURL,
        });
      }
    }

    fetchPlatformData();
  }, [user]);

  const effectiveUser: CommentUser | null = platformUser ?? (user
    ? { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }
    : null);

  // Salva a URL atual e exibe o banner de login.
  // Chamado tanto pelo botão "Adicione um comentário..." quanto pelo
  // botão "Responder" em CommentItem quando o usuário não está logado.
  function requestLogin() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("redirect-after-auth", window.location.href);
    }
    setShowBanner(true);
  }

  async function handleReply(text: string, parentId: string, rootId: string) {
    if (!effectiveUser) return;
    await addComment(text, effectiveUser, parentId, rootId);
  }

  async function handleEdit(commentId: string, newText: string) {
    if (!currentUserId) return;
    await editComment(commentId, newText, currentUserId);
  }

  async function handleDelete(commentId: string) {
    if (!currentUserId) return;
    await deleteComment(commentId, currentUserId);
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
          : `${rootComments.length} Comentário${rootComments.length !== 1 ? "s" : ""}`}
      </h2>

      {/* Formulário principal ou convite para login */}
      {effectiveUser ? (
        <CommentForm
          user={effectiveUser}
          onSubmit={(text) => addComment(text, effectiveUser, null, null)}
        />
      ) : (
        <div style={{ marginBottom: "1rem" }}>
          {showBanner ? (
            <BannerLogin onClose={() => setShowBanner(false)} />
          ) : (
            <button
              onClick={requestLogin}
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
            <div className="spinner" style={{ display: "inline-block", marginRight: "0.5rem" }} />
            Carregando comentários...
          </li>
        ) : rootComments.length === 0 ? (
          <li style={{ color: "var(--text-3)", fontSize: "0.85rem", fontStyle: "italic" }}>
            Seja o primeiro a comentar.
          </li>
        ) : (
          rootComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              currentUser={effectiveUser}
              onLike={(id, currentLikes, alreadyLiked) =>
                toggleLike(id, currentUserId!, currentLikes, alreadyLiked)
              }
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onLoginRequired={requestLogin}
              replies={getReplies(comment.id)}
              depth={0}
              rootId={comment.id}
            />
          ))
        )}
      </ul>

      {/* Paginação */}
      {hasMore && !loading && (
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              padding: "8px 24px",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: loadingMore ? "var(--text-3)" : "var(--text-2)",
              cursor: loadingMore ? "default" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {loadingMore ? "Carregando..." : "Ver mais comentários"}
          </button>
        </div>
      )}
    </section>
  );
}