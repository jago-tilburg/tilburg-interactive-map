const ANON_USER_ID_KEY = "tilburg-user-id";
const USER_NAME_KEY = "tilburg-user-name";

// The anonymous, device-local identity — always exists, independent of
// whether a visitor account is signed in. Used as the migration source
// when a visitor logs in for the first time (see useAuth's TODO for
// migrateAnonymousDataToVisitor, still unported — map/shop domain).
export function getAnonUserId(): string {
  let userId = window.localStorage.getItem(ANON_USER_ID_KEY);
  if (!userId) {
    userId = "user-" + Math.random().toString(36).substring(2, 11);
    window.localStorage.setItem(ANON_USER_ID_KEY, userId);
  }
  return userId;
}

export function getRememberedUserName(): string {
  return window.localStorage.getItem(USER_NAME_KEY) ?? "";
}

export function rememberUserName(name: string): void {
  window.localStorage.setItem(USER_NAME_KEY, name);
}
