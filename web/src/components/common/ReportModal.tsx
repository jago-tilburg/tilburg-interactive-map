"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { createReport } from "@/lib/firebase/reports";
import { getAnonUserId } from "@/lib/shops/anonUserId";
import { useAuth } from "@/hooks/useAuth";
import type { ReportContentType, ReportReason } from "@/types/reports";
import styles from "./ReportModal.module.css";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  contentType: ReportContentType;
  contentId: string;
}

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "offensive", label: "Aanstootgevend" },
  { value: "incorrect_info", label: "Onjuiste informatie" },
  { value: "other", label: "Anders" },
];

export function ReportModal({ open, onClose, contentType, contentId }: ReportModalProps) {
  const { currentVisitor } = useAuth();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleClose() {
    setReason("spam");
    setDetails("");
    setError(null);
    setSent(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const reporterId = currentVisitor?.uid ?? getAnonUserId();
      await createReport(reporterId, { contentType, contentId, reason, details: details.trim() || undefined });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Melden mislukt.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="🚩 Melden">
      {sent ? (
        <div className={styles.sent}>
          <p>Bedankt voor je melding. Een beheerder bekijkt dit zo snel mogelijk.</p>
          <button type="button" onClick={handleClose}>
            Sluiten
          </button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="report-reason">Reden</label>
          <select
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label htmlFor="report-details">Toelichting (optioneel)</label>
          <textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={sending}>
              Melding versturen
            </button>
            <button type="button" onClick={handleClose}>
              Annuleren
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
