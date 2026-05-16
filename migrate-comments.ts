import { adminDb } from "./lib/firebaseAdmin";

/**
 * Script de migração em três etapas:
 *
 * ETAPA 1 (original) — preenche rootId nos comentários que eram replies
 * mas não tinham esse campo (comentários criados antes da feature de threading).
 *
 * ETAPA 2 (anterior) — preenche authorSlug ausente em qualquer comentário.
 *
 * ETAPA 3 (nova) — preenche commentCount no doc do post com o total real de
 * comentários da subcoleção. Necessário para exibir o contador no feed sem
 * precisar abrir o painel. A partir daqui useComments.ts mantém o campo
 * sincronizado via increment(±1) a cada addComment/deleteComment.
 */
async function migrate() {
  const postsSnap = await adminDb.collection("posts").get();
  let total = 0;
  let updatedRootId = 0;
  let updatedSlug = 0;
  let updatedCommentCount = 0;

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

    // ETAPA 3: atualiza commentCount no doc do post com o total real
    const realCount = commentsSnap.size;
    await adminDb.collection("posts").doc(postDoc.id).update({ commentCount: realCount });
    updatedCommentCount++;

    console.log(`Post ${postDoc.id}: done (${realCount} comentários)`);
  }

  console.log(`\nConcluído:`);
  console.log(`  ${updatedRootId} comentários com rootId preenchido`);
  console.log(`  ${updatedSlug} comentários com authorSlug preenchido`);
  console.log(`  ${updatedCommentCount} posts com commentCount atualizado`);
  console.log(`  Total de comentários processado: ${total}`);
}

migrate().catch(console.error);