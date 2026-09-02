// Canonical breakpoints, shared between JS media-query hooks and CSS (see
// the comment at the top of src/app/globals.css). Two extra CSS-only tiers
// are sanctioned beyond these: Header.module.css's 390px small-phone tier
// and ShopDetailModal.module.css's 968px tablet tier.
export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 968;

export const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;
export const TABLET_QUERY = `(max-width: ${TABLET_BREAKPOINT}px)`;
