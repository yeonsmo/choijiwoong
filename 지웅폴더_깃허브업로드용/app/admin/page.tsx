import Link from "next/link";
import { ArrowLeft, Users, ShieldAlert, SlidersHorizontal, Webhook } from "lucide-react";
import {
  requireRole,
  AuthError,
  type Role,
  type Status,
  type Profile,
} from "@/lib/auth";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import SignOutButton from "@/app/_components/SignOutButton";
import CreateAccountForm from "@/app/admin/_components/CreateAccountForm";
import AccountRowActions from "@/app/admin/_components/AccountRowActions";

// 인증/권한(쿠키)에 의존하므로 정적 프리렌더 제외.
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  USER: "일반 사용자",
  ADMIN: "관리자",
  SUPER: "최고권한자",
};

const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: "활성",
  DISABLED: "비활성",
};

export default async function AdminPage() {
  // 권한 가드: ADMIN 이상만. 미충족 시 사유를 화면에 표시(임의 복구하지 않음 - 지침 9-4).
  let me: Profile;
  try {
    me = await requireRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return <Forbidden message={e.message} />;
    throw e;
  }

  // 계정 목록 조회: 권한 검증을 마쳤으므로 service_role 로 RLS 우회(읽기 전용).
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    // 오류 원문 표시(지침 9-4).
    return <Forbidden message={`계정 목록 조회 실패: ${error.message}`} />;
  }

  const profiles = (data ?? []) as Profile[];

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "var(--sp-10) var(--sp-6)",
        display: "grid",
        gap: "var(--sp-6)",
      }}
    >
      {/* 헤더 */}
      <header
        className="glass glass--chrome"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          padding: "var(--sp-4) var(--sp-5)",
          borderRadius: "var(--r-xl)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--r-sm)",
            background: "var(--accent-grad)",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <Users size={22} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="t-overline">관리자</div>
          <div className="t-h3" style={{ marginTop: 2 }}>
            계정 관리
          </div>
        </div>
        <span
          className="t-label"
          style={{
            background: "var(--accent-wash)",
            color: "var(--accent-strong)",
            borderRadius: "var(--r-pill)",
            padding: "4px 12px",
          }}
        >
          {ROLE_LABEL[me.role]}
        </span>
        <SignOutButton />
      </header>

      {/* 네비게이션 */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <Link
          href="/"
          className="pressable"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-1)",
            background: "var(--surface-1)",
            color: "var(--fg-2)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-sm)",
            padding: "6px 12px",
            fontSize: "var(--text-sm)",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          홈으로
        </Link>
        <Link
          href="/admin/settings"
          className="pressable"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-1)",
            background: "var(--surface-1)",
            color: "var(--fg-2)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-sm)",
            padding: "6px 12px",
            fontSize: "var(--text-sm)",
            textDecoration: "none",
          }}
        >
          <SlidersHorizontal size={15} strokeWidth={2} />
          시스템 설정
        </Link>
        <Link
          href="/admin/tokens"
          className="pressable"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-1)",
            background: "var(--surface-1)",
            color: "var(--fg-2)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-sm)",
            padding: "6px 12px",
            fontSize: "var(--text-sm)",
            textDecoration: "none",
          }}
        >
          <Webhook size={15} strokeWidth={2} />
          외부 API 토큰
        </Link>
        <span className="t-caption" style={{ margin: 0 }}>
          총 {profiles.length}개 계정
        </span>
      </div>

      {/* 신규 계정 생성 */}
      <CreateAccountForm />

      {/* 계정 목록 (읽기 전용) */}
      <section
        className="glass"
        style={{
          borderRadius: "var(--r-xl)",
          padding: "var(--sp-2)",
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 560,
          }}
        >
          <thead>
            <tr>
              <Th>이메일</Th>
              <Th>권한 등급</Th>
              <Th>상태</Th>
              <Th>생성일</Th>
              <Th>관리</Th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <Td>
                  <span style={{ color: "var(--fg-1)", fontWeight: 500 }}>
                    {p.email}
                  </span>
                  {p.id === me.id && (
                    <span
                      className="t-caption"
                      style={{ marginLeft: 8, color: "var(--fg-3)" }}
                    >
                      (본인)
                    </span>
                  )}
                </Td>
                <Td>
                  <RoleBadge role={p.role} />
                </Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
                <Td>
                  <span className="t-caption" style={{ color: "var(--fg-2)" }}>
                    {formatDate(p.created_at)}
                  </span>
                </Td>
                <Td>
                  <AccountRowActions
                    targetId={p.id}
                    targetRole={p.role}
                    targetStatus={p.status}
                    isSelf={p.id === me.id}
                    isSuper={p.role === "SUPER"}
                  />
                </Td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "var(--sp-6)" }}>
                  <p className="t-body" style={{ textAlign: "center", margin: 0 }}>
                    표시할 계정이 없어요.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="t-caption" style={{ textAlign: "center", margin: 0 }}>
        최고권한자(SUPER) 계정과 본인 계정은 이 화면에서 변경·삭제할 수 없어요(서버에서 강제).
      </p>
    </main>
  );
}

/** ADMIN 미만 또는 비활성 계정 접근 시 표시하는 거부 화면. */
function Forbidden({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "var(--sp-6)",
      }}
    >
      <div
        className="glass glass--chrome"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "var(--sp-8)",
          borderRadius: "var(--r-2xl)",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--r-md)",
            background: "var(--danger-wash)",
            color: "var(--danger)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto var(--sp-4)",
          }}
        >
          <ShieldAlert size={26} strokeWidth={2} />
        </div>
        <h1 className="t-h2" style={{ margin: 0 }}>
          접근할 수 없어요
        </h1>
        <p
          className="t-body"
          style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-6)" }}
        >
          {message}
        </p>
        <Link
          href="/"
          className="pressable"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-1)",
            background: "var(--accent)",
            color: "var(--fg-on-accent)",
            border: "1px solid transparent",
            borderRadius: "var(--r-sm)",
            padding: "10px 16px",
            fontSize: "var(--text-body)",
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          홈으로
        </Link>
      </div>
    </main>
  );
}

function RoleBadge({ role }: { role: Role }) {
  // SUPER 는 한눈에 구분되도록 강조, ADMIN 은 액센트, USER 는 중립.
  const styleByRole: Record<Role, React.CSSProperties> = {
    SUPER: { background: "var(--warn-wash)", color: "var(--warn)" },
    ADMIN: { background: "var(--accent-wash)", color: "var(--accent-strong)" },
    USER: { background: "var(--surface-2)", color: "var(--fg-2)" },
  };
  return (
    <span
      className="t-label"
      style={{
        ...styleByRole[role],
        borderRadius: "var(--r-pill)",
        padding: "3px 10px",
        display: "inline-block",
      }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className="t-label"
      style={{
        background: isActive ? "var(--ok-wash)" : "var(--surface-2)",
        color: isActive ? "var(--ok)" : "var(--fg-3)",
        borderRadius: "var(--r-pill)",
        padding: "3px 10px",
        display: "inline-block",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="t-overline"
      style={{
        textAlign: "left",
        padding: "var(--sp-3) var(--sp-4)",
        color: "var(--fg-3)",
        borderBottom: "1px solid var(--hairline)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "var(--sp-3) var(--sp-4)",
        borderBottom: "1px solid var(--hairline)",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

/** YYYY-MM-DD 형식. 서버 렌더 결정성을 위해 ISO 문자열을 직접 자른다. */
function formatDate(iso: string): string {
  return iso.slice(0, 10);
}
