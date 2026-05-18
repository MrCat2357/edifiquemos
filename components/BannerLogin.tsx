"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function BannerLogin({
  onClose,
  redirectTo,
}: {
  onClose: () => void;
  redirectTo?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const currentPath = qs ? `${pathname}?${qs}` : pathname;

  const destino = redirectTo ?? currentPath;
  const href = destino && destino !== "/" && !destino.startsWith("/entrar")
    ? `/entrar?next=${encodeURIComponent(destino)}`
    : "/entrar";

  return (
    <div className="login-banner" role="alert" aria-live="polite">
      <div className="login-banner-icon">🙏</div>
      <div className="login-banner-text">
        <p className="login-banner-title">Que bom que você está gostando!</p>
        <p className="login-banner-sub">
          Faça parte da nossa comunidade para curtir, salvar conteúdos e muito mais.
        </p>
      </div>
      <Link href={href} className="login-banner-btn">
        Entrar
      </Link>
      <button
        className="login-banner-close"
        onClick={onClose}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  );
}