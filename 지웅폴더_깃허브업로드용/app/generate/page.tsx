import { Sparkles } from "lucide-react";
import { requireRole, AuthError } from "@/lib/auth";
import { countActiveKeysByKind } from "@/lib/ai/keys";
import PageHeader from "@/app/_components/PageHeader";
import GeneratePanel from "./_components/GeneratePanel";

export const dynamic = "force-dynamic";

export default async function GeneratePage() {
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
        icon={<Sparkles size={22} strokeWidth={2} />}
        overline="법령 준수 콘텐츠 생성"
        title="콘텐츠 생성"
      />
      <GeneratePanel counts={counts} analysisCount={counts.analysis} />
    </main>
  );
}
