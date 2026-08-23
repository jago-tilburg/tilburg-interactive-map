import { ref, push, onValue, remove, type Unsubscribe } from "firebase/database";
import { getRtdb } from "./database";
import type { ShopRequest } from "@/types/requests";

export async function submitRequest(shopName: string, userId: string) {
  const newRequest = {
    id: Date.now(),
    shopName,
    userId,
    createdAt: new Date().toISOString(),
  };
  // push() writes without reading first — the requests node is publicly
  // writable (guests can suggest a shop) but only admin-readable, per
  // database.rules.json.
  return push(ref(getRtdb(), "requests"), newRequest);
}

// Admin-only per the RTDB rules — subscribing as a non-admin rejects with a
// permission-denied error, surfaced via onError.
export function subscribeRequests(
  onChange: (requests: ShopRequest[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(getRtdb(), "requests"),
    (snap) => {
      const val = snap.val() as Record<string, Omit<ShopRequest, "firebaseKey">> | null;
      const list = val
        ? Object.entries(val).map(([firebaseKey, r]) => ({ firebaseKey, ...r }))
        : [];
      onChange(list);
    },
    (error) => onError?.(error),
  );
}

export async function deleteRequest(firebaseKey: string) {
  return remove(ref(getRtdb(), `requests/${firebaseKey}`));
}
