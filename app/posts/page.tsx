"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /posts agora redireciona para a home ("/"),
 * onde o hero e o feed foram unificados.
 * Links antigos continuam funcionando.
 */
export default function PostsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}