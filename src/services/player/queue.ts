import { db } from '../../db/schema';

/** キューの並び（order の昇順） */
export const queueIds = async () => (await db.queue.orderBy('order').toArray()).map((q) => q.episodeId);

/** 末尾に追加。既にあれば何もしない */
export async function enqueue(episodeId: string) {
  await db.transaction('rw', db.queue, async () => {
    if (await db.queue.get(episodeId)) return;
    const last = await db.queue.orderBy('order').last();
    await db.queue.put({ episodeId, order: (last?.order ?? 0) + 1 });
  });
}

/** 先頭に追加（「次に再生」）。既にあれば先頭へ移す */
export async function enqueueNext(episodeId: string) {
  await db.transaction('rw', db.queue, async () => {
    const first = await db.queue.orderBy('order').first();
    await db.queue.put({ episodeId, order: (first?.order ?? 1) - 1 });
  });
}

export const dequeue = (episodeId: string) => db.queue.delete(episodeId);

export const clearQueue = () => db.queue.clear();

/** キューを ids の並びに置き換える（ids に無いものは外す） */
export async function reorderQueue(ids: string[]) {
  await db.transaction('rw', db.queue, async () => {
    await db.queue.clear();
    await db.queue.bulkPut(ids.map((episodeId, i) => ({ episodeId, order: i + 1 })));
  });
}

/** 先頭を取り出す */
export async function shiftQueue(): Promise<string | undefined> {
  return db.transaction('rw', db.queue, async () => {
    const first = await db.queue.orderBy('order').first();
    if (first) await db.queue.delete(first.episodeId);
    return first?.episodeId;
  });
}
