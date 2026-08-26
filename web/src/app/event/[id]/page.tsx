import { MapPageShell } from "../../_components/MapPageShell";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  const { payment } = await searchParams;
  return (
    <MapPageShell
      initialSelection={{ type: "event", id }}
      paymentStatus={payment === "success" || payment === "cancelled" ? payment : undefined}
    />
  );
}
