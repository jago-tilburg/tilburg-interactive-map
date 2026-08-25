import { MapPageShell } from "../../_components/MapPageShell";

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MapPageShell initialSelection={{ type: "shop", id: Number(id) }} />;
}
