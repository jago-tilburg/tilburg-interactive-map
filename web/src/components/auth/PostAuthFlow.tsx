"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { saveOnboardingConsent, createBusinessProfile } from "@/lib/firebase/firestore";
import styles from "./PostAuthFlow.module.css";

interface PostAuthFlowProps {
  open: boolean;
  onClose: () => void;
  // Decided by the caller: a just-authenticated brand-new account starts on
  // "onboarding" (from marketingConsentAt, PLAN-INLOGGEN.md §8), a returning
  // one on "chooser" — and the account menu's "Event-profiel aanmaken" entry
  // jumps straight to "createBusiness" for an already-signed-in visitor.
  startStep: Step;
  onOpenProfile: () => void;
  onGoToBusiness: () => void;
}

type Step = "onboarding" | "chooser" | "createBusiness";

// One component, three standen, one window — same modal the login screen
// used, no route change and no flash of the map in between
// (PLAN-INLOGGEN.md §8).
export function PostAuthFlow({ open, onClose, startStep, onOpenProfile, onGoToBusiness }: PostAuthFlowProps) {
  const { currentUser, currentVisitor, currentBusiness, refreshCurrentVisitor, refreshCurrentBusiness } = useAuth();
  const [step, setStep] = useState<Step>(startStep);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-syncs whenever the modal (re)opens — mirrors the settings-form sync
  // pattern already used elsewhere in this app (e.g. the settings tab's
  // settingsSyncedUid), not a plain effect, so the fields are correct before
  // the very first paint rather than flashing empty first.
  const [syncedForOpen, setSyncedForOpen] = useState(false);
  if (open && !syncedForOpen) {
    setSyncedForOpen(true);
    setStep(startStep);
    setName(currentUser?.displayName ?? "");
    setConsent(false);
    setBusinessName("");
    setError(null);
  } else if (!open && syncedForOpen) {
    setSyncedForOpen(false);
    setSubmitting(false);
  }

  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentVisitor) return;
    setSubmitting(true);
    setError(null);
    try {
      const finalName = name.trim() || currentVisitor.displayName;
      await saveOnboardingConsent(currentVisitor.uid, finalName, consent);
      await refreshCurrentVisitor(currentVisitor.uid);
      setStep("chooser");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    const trimmed = businessName.trim();
    if (!trimmed) {
      setError("Bedrijfsnaam is verplicht.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createBusinessProfile(currentUser.uid, trimmed, currentUser.email ?? "");
      await refreshCurrentBusiness(currentUser.uid);
      onClose();
      onGoToBusiness();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aanmaken mislukt.");
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    step === "onboarding" ? "Welkom bij 2happies" : step === "chooser" ? "Waar wil je naartoe?" : "Event-profiel aanmaken";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {step === "onboarding" && (
        <form className={styles.onboardingForm} onSubmit={handleOnboardingSubmit}>
          <label htmlFor="onboarding-name">Hoe mogen we je noemen?</label>
          <input id="onboarding-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />

          <label className={styles.consentRow}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Houd me per e-mail op de hoogte van nieuwe events en acties. Je kunt dit altijd weer uitzetten in je
              profiel.
            </span>
          </label>

          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.primaryButton} disabled={submitting}>
            Doorgaan
          </button>
        </form>
      )}

      {step === "chooser" && (
        <div className={styles.chooser}>
          <button type="button" className={styles.chooserButton} onClick={onClose}>
            🗺️ De kaart
          </button>
          <button
            type="button"
            className={styles.chooserButton}
            onClick={() => {
              onClose();
              onOpenProfile();
            }}
          >
            👤 Mijn profiel
          </button>
          <button
            type="button"
            className={styles.chooserButton}
            onClick={() => {
              if (currentBusiness) {
                onClose();
                onGoToBusiness();
              } else {
                setError(null);
                setStep("createBusiness");
              }
            }}
          >
            🏢 {currentBusiness ? "Event-profiel" : "Event-profiel aanmaken"}
          </button>
        </div>
      )}

      {step === "createBusiness" && (
        <form className={styles.onboardingForm} onSubmit={handleCreateBusiness}>
          <label htmlFor="onboarding-business-name">Bedrijfsnaam</label>
          <input
            id="onboarding-business-name"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.primaryButton} disabled={submitting}>
            Aanmaken
          </button>
          <button type="button" className={styles.linkButton} onClick={() => setStep("chooser")}>
            Terug
          </button>
        </form>
      )}
    </Modal>
  );
}
