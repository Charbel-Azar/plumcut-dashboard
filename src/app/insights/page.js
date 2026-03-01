import { fetchInsights } from "@/services/api";
import nextDynamic from "next/dynamic";

const InsightsClient = nextDynamic(() => import("./client"), {
  ssr: false,
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InsightsPage() {
  const insights = await fetchInsights();
  return <InsightsClient insights={insights} />;
}
