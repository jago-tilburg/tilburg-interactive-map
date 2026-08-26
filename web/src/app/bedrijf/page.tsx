import { Suspense } from "react";
import { BusinessShell } from "@/components/business/BusinessShell";

// BusinessShell reads ?tab= via useSearchParams, which needs a Suspense
// boundary so the rest of the route can still prerender
// (see Next's "missing-suspense-with-csr-bailout" doc).
export default function BedrijfPage() {
  return (
    <Suspense fallback={null}>
      <BusinessShell />
    </Suspense>
  );
}
