"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className="pressable"
      style={{
        background: "var(--surface-1)",
        color: "var(--fg-2)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-sm)",
        padding: "6px 12px",
        fontSize: "var(--text-sm)",
        cursor: "pointer",
      }}
    >
      로그아웃
    </button>
  );
}
