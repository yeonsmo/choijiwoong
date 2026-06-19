"use client";

import { useActionState } from "react";
import { manageAccount, type ActionResult } from "@/app/admin/actions";
import type { Role, Status } from "@/lib/auth";

/**
 * 계정 목록의 한 행에 대한 관리 컨트롤(권한 변경 / 비활성화·활성화 / 삭제).
 *   - SUPER 대상 또는 본인 행에는 컨트롤을 렌더하지 않고 보호 표시만 한다.
 *     (서버에서도 동일하게 차단하므로, UI는 안내 목적일 뿐 보안 경계가 아니다.)
 *   - 모든 조작은 단일 서버 액션 manageAccount 로 전달되며 op 로 구분한다.
 */
export default function AccountRowActions({
  targetId,
  targetRole,
  targetStatus,
  isSelf,
  isSuper,
}: {
  targetId: string;
  targetRole: Role;
  targetStatus: Status;
  isSelf: boolean;
  isSuper: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    manageAccount,
    null,
  );

  if (isSuper) {
    return <span className="t-caption" style={{ color: "var(--fg-3)" }}>보호됨</span>;
  }
  if (isSelf) {
    return <span className="t-caption" style={{ color: "var(--fg-3)" }}>본인 계정</span>;
  }

  const isActive = targetStatus === "ACTIVE";
  const nextStatus: Status = isActive ? "DISABLED" : "ACTIVE";

  function onDeleteClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm("이 계정을 영구 삭제할까요? 되돌릴 수 없어요.")) {
      e.preventDefault();
    }
  }

  return (
    <form
      action={formAction}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--sp-2)",
      }}
    >
      <input type="hidden" name="id" value={targetId} />
      <input type="hidden" name="next_status" value={nextStatus} />

      {/* 권한 등급 변경 */}
      <select
        name="role"
        defaultValue={targetRole}
        disabled={pending}
        style={selectStyle}
        aria-label="권한 등급"
      >
        <option value="USER">USER</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      <button
        type="submit"
        name="op"
        value="role"
        disabled={pending}
        className="pressable"
        style={ghostBtn}
      >
        권한 적용
      </button>

      {/* 비활성화 / 활성화 */}
      <button
        type="submit"
        name="op"
        value="status"
        disabled={pending}
        className="pressable"
        style={ghostBtn}
      >
        {isActive ? "비활성화" : "활성화"}
      </button>

      {/* 삭제 */}
      <button
        type="submit"
        name="op"
        value="delete"
        disabled={pending}
        onClick={onDeleteClick}
        className="pressable"
        style={dangerBtn}
      >
        삭제
      </button>

      {state && (
        <span
          role="status"
          className="t-caption"
          style={{
            flexBasis: "100%",
            color: state.ok ? "var(--ok)" : "var(--danger)",
          }}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

const selectStyle: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  padding: "5px 8px",
  color: "var(--fg-1)",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-sans)",
};

const ghostBtn: React.CSSProperties = {
  background: "var(--surface-1)",
  color: "var(--fg-2)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  padding: "5px 10px",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dangerBtn: React.CSSProperties = {
  background: "var(--danger-wash)",
  color: "var(--danger)",
  border: "1px solid transparent",
  borderRadius: "var(--r-sm)",
  padding: "5px 10px",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
