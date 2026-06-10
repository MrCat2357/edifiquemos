"use client";

/**
 * useAudioSync
 *
 * Hook que encapsula toda a lógica de sincronização entre o player de áudio
 * e a navegação entre páginas. Deve ser usado por QUALQUER página que exibe
 * um item da fila de áudio (posts, reflexões, etc.).
 *
 * Responsabilidades:
 *  1. Registra `registerOnEndedCallback` → navega para o próximo item ao
 *     terminar a faixa atual (o AudioProvider já inicia o áudio antes de
 *     chamar este callback — a página só precisa navegar).
 *  2. Registra `registerNavigationCallback` → navega para o item correto
 *     quando o usuário clica em prev/next no player (MiniPlayer, Sidebar…).
 *     Idem: o AudioProvider já iniciou o áudio antes de chamar este callback.
 *
 * NÃO faz chamadas ao player para forçar sincronização reversa (página→player),
 * o que evita o loop descrito no Bug 2 da documentação.
 *
 * Contextos suportados: "home" | "perfil" | "serie"
 *   - Para "serie", usa `serieSlugParam` para montar a URL correta.
 *   - Para outros contextos (null, "reflexoes") os callbacks são limpos.
 *
 * @param itemId        ID do item atualmente exibido na página
 * @param fromParam     Valor do parâmetro ?from= da URL atual
 * @param serieSlugParam Valor do parâmetro ?serieSlug= (apenas quando from=serie)
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { AudioPublication } from "@/providers/AudioProvider";

// ── pubToUrl ─────────────────────────────────────────────────────────────────

/**
 * Constrói a URL de navegação para uma AudioPublication.
 *
 * ALTERADO: aceita `serieSlugParam` para montar URLs de contexto série.
 */
export function pubToUrl( // ← ALTERADO (adiciona serieSlugParam)
  pub: AudioPublication,
  fromParam: string,
  serieSlugParam?: string
): string {
  const from = fromParam || "home";

  if (pub.tipo === "reflexao") {
    const aSlug = pub.autorSlug ?? "";
    return `/${aSlug}/reflexao/${pub.slug}?from=${from}`;
  }

  const cat = pub.tipo === "sermao" ? "sermoes" : "estudos";
  const base = `/posts/${cat}/${pub.slug}`;

  // ← ALTERADO: contexto série inclui serieSlug na URL
  if (from === "serie" && serieSlugParam) {
    return `${base}?from=serie&serieSlug=${serieSlugParam}`;
  }

  return `${base}?from=${from}`;
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useAudioSync(
  itemId: string,
  fromParam: string,
  serieSlugParam?: string // ← ALTERADO (novo parâmetro opcional)
) {
  const router = useRouter();
  const {
    queue,
    currentIndex,
    contextType,
    registerOnEndedCallback,
    registerNavigationCallback,
    playQueue,
  } = useAudioPlayer();

  useEffect(() => {
    // ← ALTERADO: "serie" agora é contexto válido para sincronização.
    //   Antes, "serie" era excluído aqui, deixando posts abertos via série
    //   sem callbacks de navegação.
    //
    //   Contextos válidos:
    //     "home"   → fila do feed global (expandida com episódios de séries)
    //     "perfil" → fila de posts do autor
    //     "serie"  → fila de episódios da série
    //
    //   A exceção "não navegar em home/perfil" aplica-se quando NENHUMA
    //   página de post está montada (ex.: usuário ouve pelo card da home).
    //   Nesse caso, este hook não está rodando e o player avança sozinho
    //   sem callback — comportamento correto por design.
    if (
      contextType !== "home" &&
      contextType !== "perfil" &&
      contextType !== "serie" // ← ALTERADO
    ) {
      registerOnEndedCallback(null);
      registerNavigationCallback(null);
      return;
    }

    // Verifica se este item está na fila do player
    const idxNaFila = queue.findIndex((p) => p.id === itemId);

    if (idxNaFila === -1) {
      // Item não está na fila — limpa callbacks para não interferir
      registerOnEndedCallback(null);
      registerNavigationCallback(null);
      return;
    }

    // fromParam da URL tem prioridade; cai no contextType como fallback
    const targetFrom = fromParam || contextType || "home";

    // ── Callback 1: ao terminar a faixa, navega para o próximo ──────────────
    //
    // NOTA: o AudioProvider já iniciou o próximo áudio ANTES de chamar este
    // callback. Aqui só precisamos navegar a página.
    const onEndedCb = () => {
      const nextPub = queue[idxNaFila + 1];
      if (!nextPub) return;
      // ← ALTERADO: passa serieSlugParam para URL de série
      router.push(pubToUrl(nextPub, targetFrom, serieSlugParam));
    };

    // ── Callback 2: botões prev/next do player navegam para a página correta ─
    //
    // NOTA: idem — o AudioProvider já iniciou o áudio antes de chamar aqui.
    const navCb = (
      _direction: "next" | "previous",
      pub: AudioPublication
    ) => {
      // ← ALTERADO: passa serieSlugParam para URL de série
      router.push(pubToUrl(pub, targetFrom, serieSlugParam));
    };

    registerOnEndedCallback(onEndedCb);
    registerNavigationCallback(navCb);

    return () => {
      registerOnEndedCallback(null);
      registerNavigationCallback(null);
    };
  }, [
    itemId,
    queue,
    currentIndex,
    contextType,
    fromParam,
    serieSlugParam, // ← ALTERADO (nova dependência)
    registerOnEndedCallback,
    registerNavigationCallback,
    router,
    // IMPORTANTE: não incluir `current` nem `playOrToggle` aqui.
    // Essas dependências causariam o loop do Bug 2.
  ]);

  /**
   * Função estável que PostNavigation/ReflexaoNavigation pode chamar
   * quando o usuário clica nos botões da página para navegar.
   * Sincroniza o player pulando para a faixa correta.
   */
  function handlePlayQueueItem(pub: AudioPublication) {
    if (queue.length > 0 && queue.some((p) => p.id === pub.id)) {
      playQueue(pub, queue, contextType);
    }
  }

  return { handlePlayQueueItem };
}