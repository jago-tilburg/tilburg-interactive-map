import { MapPageShell } from "../../_components/MapPageShell";

export default async function UmbrellaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MapPageShell initialSelection={{ type: "umbrella", id }} />;
}
