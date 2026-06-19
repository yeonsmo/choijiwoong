import { ScanSearch } from "lucide-react";
import { requireRole, AuthError } from "@/lib/auth";
import { countActiveKeysByKind } from "@/lib/ai/keys";
import PageHeader from "@/app/_components/PageHeader";
import AnalyzePanel from "./_components/AnalyzePanel";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  try {
    await requireRole("USER");
  } catch (e) {
    if (e instanceof AuthError) {
      return (
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "var(--sp-10) var(--sp-6)" }}>
          <p className="t-body">{e.message}</p>
        </main>
      );
    }
    throw e;
  }

  const counts = await countActiveKeysByKind();

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--sp-10) var(--sp-6)",
        display: "grid",
        gap: "var(--sp-6)",
      }}
    >
      <PageHeader
        icon={<ScanSearch size={22} strokeWidth={2} />}
        overline="보험광고 법령 검증"
        title="광고 검증"
      />
      <AnalyzePanel keyCount={counts.analysis} />
    </main>
  );
}
