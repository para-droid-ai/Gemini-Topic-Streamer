// services/dbService.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Stream, StreamUpdate } from '../types';

const DB_NAME = 'GeminiTopicStreamerDB';
const DB_VERSION = 1;
const STREAMS_STORE = 'streams';
const UPDATES_STORE = 'updates';

interface AppDB extends DBSchema {
  [STREAMS_STORE]: {
    key: string;
    value: Stream & { order: number }; // Add order property for sorting
    indexes: { order: 'order' };
  };
  [UPDATES_STORE]: {
    key: string;
    value: StreamUpdate;
    indexes: { streamId: 'streamId' };
  };
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

const getDB = (): Promise<IDBPDatabase<AppDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STREAMS_STORE)) {
          const streamsStore = db.createObjectStore(STREAMS_STORE, { keyPath: 'id' });
          streamsStore.createIndex('order', 'order', { unique: false });
        }
        if (!db.objectStoreNames.contains(UPDATES_STORE)) {
          const updatesStore = db.createObjectStore(UPDATES_STORE, { keyPath: 'id' });
          updatesStore.createIndex('streamId', 'streamId', { unique: false });
        }
      },
    });
  }
  return dbPromise;
};

// --- Stream Functions ---
export const saveStreams = async (streams: Stream[]) => {
  const db = await getDB();
  const tx = db.transaction(STREAMS_STORE, 'readwrite');
  await Promise.all(
    streams.map((stream, index) => tx.store.put({ ...stream, order: index }))
  );
  await tx.done;
};

export const getAllStreams = async (): Promise<Stream[]> => {
  const db = await getDB();
  const sortedStreams = await db.getAllFromIndex(STREAMS_STORE, 'order');
  // Remove the 'order' property before returning the streams
  return sortedStreams.map(({ order, ...restOfStream }) => restOfStream as Stream);
};

export const deleteStreamFromDB = async (streamId: string) => {
  const db = await getDB();
  // Delete the stream itself
  await db.delete(STREAMS_STORE, streamId);

  // Also delete all associated updates
  const tx = db.transaction(UPDATES_STORE, 'readwrite');
  const index = tx.store.index('streamId');
  // Use IDBKeyRange.only for exact match query
  let cursor = await index.openCursor(IDBKeyRange.only(streamId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
};

// --- Update Functions ---
export const saveUpdate = async (update: StreamUpdate) => {
  const db = await getDB();
  await db.put(UPDATES_STORE, update);
};

export const getAllUpdates = async (): Promise<{ [key: string]: StreamUpdate[] }> => {
  const db = await getDB();
  const allUpdatesDb = await db.getAll(UPDATES_STORE);
  const groupedUpdates: { [key: string]: StreamUpdate[] } = {};

  for (const update of allUpdatesDb) {
    if (!groupedUpdates[update.streamId]) {
      groupedUpdates[update.streamId] = [];
    }
    groupedUpdates[update.streamId].push(update);
  }

  // Sort updates within each stream by timestamp (newest first)
  for (const streamId in groupedUpdates) {
    groupedUpdates[streamId].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  return groupedUpdates;
};

export const deleteUpdateFromDB = async (updateId: string) => {
  const db = await getDB();
  await db.delete(UPDATES_STORE, updateId);
};

// --- Import/Export Function ---
export const clearAllDataFromDB = async () => {
  const db = await getDB();
  await db.clear(STREAMS_STORE);
  await db.clear(UPDATES_STORE);
};