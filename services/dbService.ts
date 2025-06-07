
// services/dbService.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Stream, StreamUpdate, Podcast } from '../types'; // Added Podcast

const DB_NAME = 'GeminiTopicStreamerDB';
const DB_VERSION = 3; 
const STREAMS_STORE = 'streams';
const UPDATES_STORE = 'updates';
const TTS_AUDIO_STORE = 'tts-audio';
const PODCASTS_STORE = 'podcasts'; 

interface AppDB extends DBSchema {
  [STREAMS_STORE]: {
    key: string;
    value: Stream & { order: number }; 
    indexes: { order: 'order' };
  };
  [UPDATES_STORE]: {
    key: string;
    value: StreamUpdate;
    indexes: { streamId: 'streamId' };
  };
  [TTS_AUDIO_STORE]: { 
    key: string; 
    value: {
      updateId: string;
      audioB64: string; 
    };
  };
  [PODCASTS_STORE]: { 
    key: string;
    value: Podcast; // Podcast type now includes scriptText, voiceName, and titleCardImageUrl
    indexes: { createdAt: 'createdAt' };
  };
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

const getDB = (): Promise<IDBPDatabase<AppDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) { 
        if (oldVersion < 1) { 
          if (!db.objectStoreNames.contains(STREAMS_STORE)) {
            const streamsStore = db.createObjectStore(STREAMS_STORE, { keyPath: 'id' });
            streamsStore.createIndex('order', 'order', { unique: false });
          }
          if (!db.objectStoreNames.contains(UPDATES_STORE)) {
            const updatesStore = db.createObjectStore(UPDATES_STORE, { keyPath: 'id' });
            updatesStore.createIndex('streamId', 'streamId', { unique: false });
          }
        }
        if (oldVersion < 2) { 
          if (!db.objectStoreNames.contains(TTS_AUDIO_STORE)) {
            db.createObjectStore(TTS_AUDIO_STORE, { keyPath: 'updateId' });
          }
        }
        if (oldVersion < 3) { 
            if (!db.objectStoreNames.contains(PODCASTS_STORE)) {
              const podcastStore = db.createObjectStore(PODCASTS_STORE, { keyPath: 'id' });
              podcastStore.createIndex('createdAt', 'createdAt');
            }
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
  return sortedStreams.map(({ order, ...restOfStream }) => restOfStream as Stream);
};

export const deleteStreamFromDB = async (streamId: string) => {
  const db = await getDB();
  await db.delete(STREAMS_STORE, streamId);

  const updatesTx = db.transaction(UPDATES_STORE, 'readwrite');
  const audioTx = db.transaction(TTS_AUDIO_STORE, 'readwrite'); 
  const updatesIndex = updatesTx.store.index('streamId');
  
  let cursor = await updatesIndex.openCursor(IDBKeyRange.only(streamId));
  while (cursor) {
    const updateId = cursor.primaryKey; 
    await cursor.delete(); 
    await audioTx.store.delete(updateId); 
    cursor = await cursor.continue();
  }
  
  await updatesTx.done;
  await audioTx.done; 
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
  await db.clear(TTS_AUDIO_STORE); 
  await db.clear(PODCASTS_STORE); // Also clear podcasts
};

// --- TTS Audio Cache Functions ---
export const saveTtsAudio = async (updateId: string, audioB64: string) => {
  const db = await getDB();
  await db.put(TTS_AUDIO_STORE, { updateId, audioB64 });
  console.log(`Cached TTS audio for update ID: ${updateId}`);
};

export const getTtsAudio = async (updateId: string): Promise<string | null> => {
  const db = await getDB();
  const result = await db.get(TTS_AUDIO_STORE, updateId);
  if (result) {
    console.log(`Retrieved cached TTS audio for update ID: ${updateId}`);
    return result.audioB64;
  }
  console.log(`No cached TTS audio found for update ID: ${updateId}`);
  return null;
};

export const deleteTtsAudio = async (updateId: string) => {
  const db = await getDB();
  await db.delete(TTS_AUDIO_STORE, updateId);
  console.log(`Deleted cached TTS audio for update ID: ${updateId}`);
};

// --- Podcast Functions ---
export const savePodcast = async (podcast: Podcast) => {
  const db = await getDB();
  await db.put(PODCASTS_STORE, podcast);
};

export const getAllPodcasts = async (): Promise<Podcast[]> => {
  const db = await getDB();
  const podcasts = await db.getAll(PODCASTS_STORE);
  // Sort by createdAt descending
  return podcasts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const deletePodcast = async (podcastId: string) => {
  const db = await getDB();
  await db.delete(PODCASTS_STORE, podcastId);
};