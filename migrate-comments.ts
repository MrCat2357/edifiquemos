import { adminDb } from "./lib/firebaseAdmin";

/**
 * Script de migração em duas etapas:
 *
 * ETAPA 1 (original) — preenche rootId nos comentários que eram replies
 * mas não tinham esse campo (comentários criados antes da feature de threading).
 *
 * ETAPA 2 (nova) — preenche authorSlug nos comentários que não têm esse campo.
 * O authorSlug é o slug do perfil do autor na plataforma (/users/{authorId}.slug).
 * Sem ele, os links de @menção derivavam o slug do nome do Google, levando
 * a perfis inexistentes (ex: "catulo-axel" em vez de "mrcat").
 */
async function migrate() {
  const postsSnap = await adminDb.collection("posts").get();
  let total = 0;
  let updatedRootId = 0;
  let updatedSlug = 0;

  // Cache de slugs: evita buscar o mesmo usuário várias vezes
  const slugCache: Record<string, string> = {};

  async function getSlugForUser(uid: string): Promise<string> {
    if (slugCache[uid] !== undefined) return slugCache[uid];
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const slug = userDoc.exists ? (userDoc.data()?.slug ?? "") : "";
    slugCache[uid] = slug;
    return slug;
  }

  for (const postDoc of postsSnap.docs) {
    const commentsSnap = await adminDb
      .collection("posts")
      .doc(postDoc.id)
      .collection("comments")
      .get();

    // Mapa id → parentId para navegar a árvore (usado na etapa 1)
    const map: Record<string, string | null> = {};
    commentsSnap.docs.forEach((d) => {
      map[d.id] = d.data().parentId ?? null;
    });

    function findRoot(id: string): string {
      const parentId = map[id];
      if (!parentId) return id;
      return findRoot(parentId);
    }

    let batch = adminDb.batch();
    let batchCount = 0;

    async function commitIfNeeded() {
      if (batchCount >= 499) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    for (const commentDoc of commentsSnap.docs) {
      total++;
      const data = commentDoc.data();
      const updates: Record<string, any> = {};

      // ETAPA 1: preenche rootId ausente em replies
      if (data.parentId && !data.rootId) {
        updates.rootId = findRoot(commentDoc.id);
        updatedRootId++;
      }

      // ETAPA 2: preenche authorSlug ausente em qualquer comentário
      if (!data.authorSlug && data.authorId) {
        const slug = await getSlugForUser(data.authorId);
        if (slug) {
          updates.authorSlug = slug;
          updatedSlug++;
        }
      }

      if (Object.keys(updates).length > 0) {
        batch.update(commentDoc.ref, updates);
        batchCount++;
        await commitIfNeeded();
      }
    }

    if (batchCount > 0) await batch.commit();
    console.log(`Post ${postDoc.id}: done`);
  }

  console.log(`\nConcluído:`);
  console.log(`  ${updatedRootId} comentários com rootId preenchido`);
  console.log(`  ${updatedSlug} comentários com authorSlug preenchido`);
  console.log(`  Total processado: ${total}`);
}

migrate().catch(console.error);