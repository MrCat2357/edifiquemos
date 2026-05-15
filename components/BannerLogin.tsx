"use client";

import Link from "next/link";

/**
 * BannerLogin
 * Exibido quando um visitante não logado tenta curtir ou comentar.
 * Uso:
 *   const [showLoginBanner, setShowLoginBanner] = useState(false);
 *   ...
 *   {showLoginBanner && <BannerLogin onClose={() => setShowLoginBanner(false)} />}
 */

export default function BannerLogin({ onClose }: { onClose: () => void }) {
  return (
    <div className="login-banner" role="alert" aria-live="polite">
      <div className="login-banner-icon">🙏</div>
      <div className="login-banner-text">
        <p className="login-banner-title">Que bom que você está gostando!</p>
        <p className="login-banner-sub">
          Faça parte da nossa comunidade para curtir, salvar conteúdos e muito mais.
        </p>
      </div>
      <Link href="/entrar" className="login-banner-btn">
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