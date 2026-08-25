"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { getAnonUserId } from "@/lib/shops/anonUserId";
import { nextUserRating, averageRating, buildComment, buildUserReview } from "@/lib/shops/shopHelpers";
import {
  setShopLike,
  setShopUserRating,
  addShopComment,
  removeShopComment,
  addShopUserReview,
  removeShopUserReview,
  trackShopView,
  getShopViews,
  deleteShop,
} from "@/lib/firebase/shops";
import { navigateToLocation } from "@/lib/shops/navigateToLocation";
import { DietaryBadges } from "./DietaryBadges";
import { SocialLinks } from "./SocialLinks";
import { InstagramEmbed } from "./InstagramEmbed";
import { StarRating } from "./StarRating";
import { CommentNameModal } from "./CommentNameModal";
import { UserReviewModal } from "./UserReviewModal";
import { ReportModal } from "@/components/common/ReportModal";
import type { Shop } from "@/types/shops";
import styles from "./ShopDetailModal.module.css";

interface ShopDetailModalProps {
  open: boolean;
  onClose: () => void;
  shop: Shop | null;
  onEditRequested?: (shop: Shop) => void;
}

// No real external subscription needed — the anon id is stable for the
// component's lifetime once resolved — so this is a no-op unsubscribe.
function subscribeToNothing() {
  return () => {};
}

// Resolves to the signed-in visitor's uid, or (once mounted, client-side)
// the device-local anonymous id. Uses useSyncExternalStore rather than an
// effect+setState "isClient" flag specifically for its getServerSnapshot
// fallback: it renders `null` for both the server pass and the client's
// first (pre-hydration) pass — avoiding a hydration mismatch — then swaps
// to the real getAnonUserId() value after mount, without ever touching
// localStorage during SSR.
function useCurrentUserId(): string | null {
  const { currentVisitor } = useAuth();
  const anonId = useSyncExternalStore(
    subscribeToNothing,
    getAnonUserId,
    /* v8 ignore next -- getServerSnapshot only runs during an actual server render or the
       initial hydration pass; RTL's render() does neither, so this is never invoked here. */
    () => null,
  );
  return currentVisitor?.uid ?? anonId;
}

export function ShopDetailModal({ open, onClose, shop, onEditRequested }: ShopDetailModalProps) {
  const { isAdmin } = useAuth();
  const userId = useCurrentUserId();
  const [viewCount, setViewCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [pendingCommentText, setPendingCommentText] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Resets the error banner as soon as a different shop is shown — done
  // during render (comparing against the previously-rendered shop id)
  // rather than in the effect below, per the same pattern used in the
  // event form modals.
  const [errorShownForShopId, setErrorShownForShopId] = useState<number | null>(null);
  if (open && shop && shop.id !== errorShownForShopId) {
    setErrorShownForShopId(shop.id);
    setError(null);
  }

  useEffect(() => {
    if (!open || !shop) return;
    trackShopView(shop.id).catch(() => {});
    getShopViews(shop.id)
      .then(setViewCount)
      .catch(() => setViewCount(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only shop.id identity matters, not the whole object
  }, [open, shop?.id]);

  if (!shop) return null;

  // RTDB never stores an empty array — writing `likes: []` on create is
  // equivalent to writing nothing at all — so a shop with zero interactions
  // so far can come back from a real snapshot missing these fields
  // entirely, even though the Shop type promises they're always arrays.
  // Normalized once at the read boundary (shopsSnapshotToArray) for every
  // real caller, but defended here too — this crashed the whole page
  // (`shop.likes.includes` on undefined) opening any shop with no likes yet.
  const likes = shop.likes ?? [];
  const comments = shop.comments ?? [];
  const userReviews = shop.userReviews ?? [];
  const userRatings = shop.userRatings ?? [];

  /* v8 ignore next -- userId's falsy branch is the pre-hydration SSR state; useSyncExternalStore
     resolves it synchronously on the client's first render under RTL (no real hydration pass),
     so this branch is only reachable during an actual server render, never in this test suite. */
  const hasLiked = userId ? likes.includes(userId) : false;
  const avg = averageRating(userRatings);
  /* v8 ignore next -- see hasLiked above. */
  const userRating = userId ? userRatings.find((r) => r.userId === userId)?.rating : undefined;

  async function handleRate(rating: number) {
    /* v8 ignore next -- see hasLiked above. */
    if (!userId) return;
    try {
      const existing = shop!.userRatings.find((r) => r.userId === userId);
      await setShopUserRating(shop!.id, userId, nextUserRating(existing, userId, rating));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rating opslaan mislukt.");
    }
  }

  async function handleToggleLike() {
    /* v8 ignore next -- see hasLiked above. */
    if (!userId) return;
    try {
      await setShopLike(shop!.id, userId, !hasLiked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    }
  }

  function handleSubmitCommentDraft() {
    if (!commentDraft.trim()) {
      setError("Vul een reactie in");
      return;
    }
    setPendingCommentText(commentDraft.trim());
  }

  async function handleSubmitCommentName(name: string) {
    /* v8 ignore next -- unreachable via the UI: CommentNameModal only ever calls onSubmit
       while pendingCommentText is set, and userId's falsy state is the SSR-only case
       documented above hasLiked. */
    if (!userId || !pendingCommentText) return;
    try {
      await addShopComment(shop!.id, buildComment({ userId, userName: name, text: pendingCommentText }));
      setCommentDraft("");
    } catch (err) {
      // Also close the name-prompt on failure — it sits in front of the
      // main modal, so the error message set below would otherwise be
      // rendered but invisible behind it.
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setPendingCommentText(null);
    }
  }

  async function handleDeleteComment(commentId: number) {
    try {
      await removeShopComment(shop!.id, commentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  async function handleSubmitReview(input: { name: string; rating: number; text: string }) {
    /* v8 ignore next -- see hasLiked above. */
    if (!userId) return;
    try {
      await addShopUserReview(
        shop!.id,
        buildUserReview({ userId, userName: input.name, rating: input.rating, text: input.text }),
      );
    } catch (err) {
      // Also close the review modal on failure — see handleSubmitCommentName.
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setReviewModalOpen(false);
    }
  }

  async function handleDeleteReview(reviewId: number) {
    try {
      await removeShopUserReview(shop!.id, reviewId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  async function handleDeleteShop() {
    try {
      await deleteShop(shop!.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  return (
    <>
      <Modal
        open={open && !pendingCommentText && !reviewModalOpen && !reportModalOpen}
        onClose={onClose}
        title={shop.name}
        variant="detail"
      >
        <button
          type="button"
          className={styles.address}
          onClick={() => navigateToLocation(shop.lat, shop.lng, shop.name)}
        >
          📍 {shop.address}
        </button>

        <div className={styles.badges}>
          <span className={styles.ratingBadge}>{shop.rating} ⭐</span>
          <span className={styles.priceBadge}>{shop.price}</span>
          {avg !== null && (
            <span className={styles.avgBadge}>
              👥 {avg} ⭐ ({userRatings.length})
            </span>
          )}
          <DietaryBadges options={shop.dietaryOptions} />
          <SocialLinks shopName={shop.name} tiktokUrl={shop.tiktokUrl} instagramUrl={shop.instagramUrl} />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {/* Two columns on desktop (photo/review/rating/interactions/admin
            left, Instagram embed right, sticky) — collapses to one stacked
            column under 968px. Comments/reviews stay full-width below,
            outside this grid, matching the prototype's shop-detail-columns
            scope. */}
        <div className={styles.columns}>
          <div className={styles.left}>
            {shop.photoUrl && <img src={shop.photoUrl} alt={shop.name} className={styles.photo} />}

            <div className={styles.reviewSection}>
              <div className={styles.reviewLabel}>Review van Bastiaan</div>
              <p className={styles.reviewText}>{shop.review}</p>
            </div>

            <div className={styles.reviewSection}>
              <div className={styles.reviewLabel}>Geef je beoordeling</div>
              <StarRating currentUserRating={userRating} onRate={handleRate} />
            </div>

            <div className={styles.interactionBar}>
              <button
                type="button"
                className={hasLiked ? styles.likedButton : styles.likeButton}
                onClick={handleToggleLike}
              >
                👍 {likes.length}
              </button>
              {viewCount !== null && <span className={styles.viewCount}>👁️ {viewCount}</span>}
              <button type="button" className={styles.reportButton} onClick={() => setReportModalOpen(true)}>
                🚩 Melden
              </button>
            </div>

            {isAdmin && (
              <div className={styles.adminActions}>
                <button type="button" className={styles.btnEdit} onClick={() => onEditRequested?.(shop)}>
                  ✏️ Bewerken
                </button>
                <button type="button" className={styles.btnDelete} onClick={handleDeleteShop}>
                  🗑️ Verwijderen
                </button>
              </div>
            )}
          </div>

          <div className={styles.right}>
            <InstagramEmbed instagramUrl={shop.instagramUrl} />
          </div>
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewLabel}>Reacties</div>
          {comments.length === 0 ? (
            <p className={styles.empty}>Nog geen reacties.</p>
          ) : (
            <ul className={styles.commentList}>
              {comments.map((c) => (
                <li key={c.id} className={styles.commentItem}>
                  <div className={styles.commentHeader}>
                    <span className={styles.commentAuthor}>{c.userName}</span>
                  </div>
                  <p className={styles.commentText}>{c.text}</p>
                  {(isAdmin || c.userId === userId) && (
                    <button type="button" onClick={() => handleDeleteComment(c.id)}>
                      Verwijderen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <textarea
            aria-label="Reactie"
            placeholder="Schrijf een reactie..."
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
          />
          <button type="button" onClick={handleSubmitCommentDraft}>
            Plaats reactie
          </button>
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewLabel}>Reviews van Bezoekers</div>
          {userReviews.length === 0 ? (
            <p className={styles.empty}>Nog geen reviews.</p>
          ) : (
            <ul className={styles.commentList}>
              {userReviews.map((r) => (
                <li key={r.id} className={styles.userReview}>
                  <div className={styles.userReviewHeader}>
                    <span className={styles.userReviewAuthor}>{r.userName}</span>
                    <span className={styles.userReviewRating}>{r.rating} ⭐</span>
                  </div>
                  <p className={styles.userReviewText}>{r.text}</p>
                  {(isAdmin || r.userId === userId) && (
                    <button type="button" onClick={() => handleDeleteReview(r.id)}>
                      Verwijderen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setReviewModalOpen(true)}>
            Voeg Je Review Toe
          </button>
        </div>
      </Modal>

      <CommentNameModal
        open={!!pendingCommentText}
        onCancel={() => setPendingCommentText(null)}
        onSubmit={handleSubmitCommentName}
      />
      <UserReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onSubmit={handleSubmitReview}
      />
      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        contentType="shop"
        contentId={String(shop.id)}
      />
    </>
  );
}
