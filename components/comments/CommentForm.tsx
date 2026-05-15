import { useState } from "react";
import { AuthorAvatar } from "@/components/AuthorAvatar";

type Props = {
  user: { displayName?: string | null; photoURL?: string | null };
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean; // modo compacto para replies (sem avatar grande)
};

export default function CommentForm({
  user,
  onSubmit,
  onCancel,
  placeholder = "Adicione um comentário...",
  autoFocus = false,
  compact = false,
}: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(autoFocus);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!text.trim() || loading) return;
    setLoading(true);
    await onSubmit(text.trim());
    setText("");
    setFocused(false);
    setLoading(false);
  }

  function handleCancel() {
    setText("");
    setFocused(false);
    onCancel?.();
  }

  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
      {!compact && (
        <AuthorAvatar src={user.photoURL} name={user.displayName || "?"} size={36} />
      )}
      <div style={{ flex: 1 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          rows={focused ? 3 : 1}
          autoFocus={autoFocus}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${focused ? "var(--emerald)" : "var(--border)"}`,
            color: "var(--text-1)",
            fontSize: compact ? "0.85rem" : "0.9rem",
            resize: "none",
            outline: "none",
            padding: "4px 0",
            transition: "border-color 0.2s",
            fontFamily: "inherit",
          }}
        />
        {focused && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              marginTop: "0.5rem",
            }}
          >
            <button
              onClick={handleCancel}
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius-full)",
                border: "none",
                background: "none",
                color: "var(--text-3)",
                cursor: "pointer",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || loading}
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius-full)",
                border: "none",
                background: text.trim() ? "var(--emerald)" : "var(--border)",
                color: text.trim() ? "#fff" : "var(--text-3)",
                cursor: text.trim() ? "pointer" : "default",
                fontSize: "0.82rem",
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {loading ? "Enviando…" : "Comentar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}