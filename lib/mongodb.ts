import mongoose from "mongoose";

const rawUri = process.env.MONGODB_URI;
if (!rawUri) {
  throw new Error(
    "Будь ласка, визначте змінну MONGODB_URI у файлі .env.local"
  );
}
const MONGODB_URI: string = rawUri;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.mongoose ?? {
  conn: null,
  promise: null,
};

if (process.env.NODE_ENV !== "production") {
  globalThis.mongoose = cached;
}

/**
 * Підключення до MongoDB з кешуванням.
 * У режимі розробки (HMR) повторно використовує існуюче підключення,
 * щоб уникнути вичерпання ліміту з'єднань.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
