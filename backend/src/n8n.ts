import { createHmac } from "node:crypto";

export type Evaluation = {
  matchScore: number;
  strengths: string[];
  gaps: string[];
  summary: string;
  tailoredCv: string;
  coverLetter: string;
};

export interface N8nAdapter {
  mode: "mock" | "live";
  syncProfile(payload: Record<string, unknown>): Promise<void>;
  evaluate(payload: Record<string, unknown>): Promise<Evaluation>;
  notifyApproval(payload: Record<string, unknown>): Promise<void>;
}

const mockEvaluation: Evaluation = {
  matchScore: 72,
  strengths: ["Role was added manually", "Candidate profile is available"],
  gaps: ["Mock evaluation only—connect the authorized n8n webhook for AI analysis"],
  summary: "This is deterministic mock data. No external service or job application was contacted.",
  tailoredCv: "Mock tailored CV placeholder. Review and edit before use.",
  coverLetter: "Mock cover-letter placeholder. Review and edit before use.",
};

export function createN8nAdapter(env: NodeJS.ProcessEnv): N8nAdapter {
  if (env.N8N_MODE !== "live") {
    return { mode: "mock", async syncProfile() {}, async evaluate() { return mockEvaluation; }, async notifyApproval() {} };
  }

  const baseUrl = required(env.N8N_BASE_URL, "N8N_BASE_URL");
  const profilePath = required(env.N8N_PROFILE_WEBHOOK_PATH, "N8N_PROFILE_WEBHOOK_PATH");
  const evaluationPath = required(env.N8N_JOB_EVALUATION_WEBHOOK_PATH, "N8N_JOB_EVALUATION_WEBHOOK_PATH");
  const approvalPath = required(env.N8N_APPROVAL_WEBHOOK_PATH, "N8N_APPROVAL_WEBHOOK_PATH");
  const secret = required(env.N8N_WEBHOOK_SECRET, "N8N_WEBHOOK_SECRET");

  async function signedPost(path: string, payload: Record<string, unknown>) {
    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const response = await fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", "x-applypilot-timestamp": timestamp, "x-applypilot-signature": signature },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`n8n request failed with status ${response.status}`);
    return response;
  }

  return {
    mode: "live",
    async syncProfile(payload) { await signedPost(profilePath, payload); },
    async evaluate(payload) { return await (await signedPost(evaluationPath, payload)).json() as Evaluation; },
    async notifyApproval(payload) { await signedPost(approvalPath, payload); },
  };
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required when N8N_MODE=live`);
  return value;
}
