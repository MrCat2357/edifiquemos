import { adminDb } from "./lib/firebaseAdmin";

async function migrate() {
  const postsSnap = await adminDb.collection("posts").get();
  let total = 0;
  let updated = 0;

  for (const postDoc of postsSnap.docs) {
    const commentsSnap = await adminDb
      .collection("posts")
      .doc(postDoc.id)
      .collection("comments")
      .get();

    // Mapa id → parentId para navegar a árvore
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

    for (const commentDoc of commentsSnap.docs) {
      total++;
      const data = commentDoc.data();

      // Pula raiz e já migrados
      if (!data.parentId || data.rootId) continue;

      batch.update(commentDoc.ref, { rootId: findRoot(commentDoc.id) });
      batchCount++;
      updated++;

      if (batchCount === 499) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();
    console.log(`Post ${postDoc.id}: done`);
  }

  console.log(`\nConcluído: ${updated} de ${total} comentários atualizados.`);
}

migrate().catch(console.error);