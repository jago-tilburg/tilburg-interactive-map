"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useAuth } from "@/hooks/useAuth";
import { AuthModal } from "./AuthModal";
import { PostAuthFlow } from "./PostAuthFlow";
import { RoleChoiceModal, type RoleChoice } from "./RoleChoiceModal";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { signOutCurrentUser } from "@/lib/firebase/auth";
import type { Visitor } from "@/types/account";
import styles from "./AccountMenu.module.css";

type PostAuthStep = "onboarding" | "chooser" | "createBusiness";

// A signed-out visitor gets a single "Inloggen" action; once signed in this
// becomes a menu of everything the account has (PLAN-INLOGGEN.md §10) rather
// than the old priority-ordered single dashboard (admin > business >
// visitor).
export function AccountMenu() {
  const { isAdmin, currentVisitor, currentBusiness } = useAuth();
  const router = useRouter();
  const [roleChoiceOpen, setRoleChoiceOpen] = useState(false);
  const [roleChoice, setRoleChoice] = useState<RoleChoice | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [postAuth, setPostAuth] = useState<PostAuthStep | null>(null);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  const signedIn = !!currentVisitor;

  function goToBusiness() {
    router.push("/eventbeheer");
  }

  function handleRoleChosen(role: RoleChoice) {
    setRoleChoice(role);
    setRoleChoiceOpen(false);
    setAuthOpen(true);
  }

  function handleSkipToLogin() {
    setRoleChoice(null);
    setRoleChoiceOpen(false);
    setAuthOpen(true);
  }

  function handleAuthenticated(visitor: Visitor) {
    const isNewAccount = visitor.marketingConsentAt === undefined;
    setPostAuth(isNewAccount ? "onboarding" : "chooser");
  }

  async function handleLogout() {
    await signOutCurrentUser();
  }

  const accountName = isAdmin ? "Admin" : (currentVisitor?.displayName ?? "Account");

  return (
    <nav className={styles.menu}>
      {signedIn ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className={styles.accountLink} aria-label={accountName} title={accountName}>
              👤
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.dropdown} align="end" sideOffset={8}>
              <DropdownMenu.Item className={styles.item} onSelect={() => router.push("/profiel")}>
                👤 Mijn profiel
              </DropdownMenu.Item>
              {currentBusiness ? (
                <DropdownMenu.Item className={styles.item} onSelect={goToBusiness}>
                  🏢 Eventomgeving
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item className={styles.item} onSelect={() => setPostAuth("createBusiness")}>
                  🏢 Event-profiel aanmaken
                </DropdownMenu.Item>
              )}
              {isAdmin && (
                <DropdownMenu.Item className={styles.item} onSelect={() => setAdminPanelOpen(true)}>
                  🔐 Adminpaneel
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className={styles.separator} />
              <DropdownMenu.Item className={styles.item} onSelect={handleLogout}>
                Uitloggen
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : (
        <button
          type="button"
          className={styles.accountLink}
          aria-label="Inloggen"
          title="Inloggen"
          onClick={() => setRoleChoiceOpen(true)}
        >
          👤
        </button>
      )}

      <RoleChoiceModal
        open={roleChoiceOpen}
        onClose={() => setRoleChoiceOpen(false)}
        onChoose={handleRoleChosen}
        onSkipToLogin={handleSkipToLogin}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />

      <PostAuthFlow
        open={postAuth !== null}
        onClose={() => {
          setPostAuth(null);
          setRoleChoice(null);
        }}
        startStep={postAuth ?? "chooser"}
        businessIntent={roleChoice === "business"}
        onOpenProfile={() => router.push("/profiel")}
        onGoToBusiness={goToBusiness}
      />

      <AdminPanel open={adminPanelOpen} onClose={() => setAdminPanelOpen(false)} />
    </nav>
  );
}
