/** 분석(검증) 결과 타입. 클라이언트/서버 공용(비밀 없음). */

export type VerdictValue = "VIOLATION" | "COMPLIANT" | "UNCERTAIN";

export interface ViolatedArticle {
  law: string;
  article?: string;
  reason: string;
}

/** 모델 1개의 판별 결과. */
export interface ModelVerdict {
  verdict: VerdictValue;
  confidence: number; // 0..1
  rationale: string;
  violatedArticles: ViolatedArticle[];
}

/** 한 모델의 참여 기록(교차검증에서 사용). */
export interface ModelOpinion {
  provider: string;
  stage: "initial" | "critique" | "final";
  verdict?: ModelVerdict;
  /** 비평 단계 등 자유 텍스트. */
  text?: string;
}

/** 분석 전체 결과(단일/교차 공통). */
export interface AnalysisResult {
  mode: "single" | "cross";
  /** 최종 합의 판별. */
  final: ModelVerdict;
  /** 참여 모델별 의견/비평 기록. */
  opinions: ModelOpinion[];
  /** 대조에 사용한 법령 근거 요약(표시용). */
  lawBasis: string;
}
