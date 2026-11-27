import type { Metadata } from "next";
import { RatePanel } from "@/components/rate-panel";

export const metadata: Metadata = { title: "Rate websites · webgen-bench", robots: { index: false } };

export default function Page() {
  return <RatePanel />;
}
