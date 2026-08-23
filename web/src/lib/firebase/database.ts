import { getDatabase, type Database } from "firebase/database";
import { getFirebaseApp } from "./app";

export function getRtdb(): Database {
  return getDatabase(getFirebaseApp());
}
