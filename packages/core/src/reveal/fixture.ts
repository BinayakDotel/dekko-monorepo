import type { ChangeModel } from "../schema";

/** Fixed ChangeModel for layout/render snapshot tests. */
export function fixtureRevealModel(): ChangeModel {
  return {
    schemaVersion: 1,
    components: [
      {
        id: "refunds-controller",
        label: "RefundsController",
        kind: "route",
        status: "added",
        hunks: ["h1"],
        confidence: 0.95,
      },
      {
        id: "ledger-service",
        label: "LedgerService",
        kind: "service",
        status: "modified",
        hunks: ["h1"],
        confidence: 0.9,
      },
      {
        id: "audit-log",
        label: "AuditLog",
        kind: "model",
        status: "modified",
        hunks: ["h2"],
        confidence: 0.85,
      },
      {
        id: "payment-repository",
        label: "PaymentRepository",
        kind: "model",
        status: "context",
        hunks: [],
        confidence: 0.7,
      },
      {
        id: "notification-queue",
        label: "NotificationQueue",
        kind: "queue",
        status: "modified",
        hunks: ["h3"],
        confidence: 0.8,
      },
    ],
    edges: [
      {
        from: "refunds-controller",
        to: "ledger-service",
        relation: "calls",
        hunks: ["h1"],
        confidence: 0.9,
      },
      {
        from: "ledger-service",
        to: "payment-repository",
        relation: "writes",
        hunks: ["h1"],
        confidence: 0.55,
      },
      {
        from: "refunds-controller",
        to: "audit-log",
        relation: "writes",
        hunks: ["h2"],
        confidence: 0.8,
      },
      {
        from: "audit-log",
        to: "notification-queue",
        relation: "publishes",
        hunks: ["h3"],
        confidence: 0.75,
      },
    ],
    keyHunks: [
      { hunkId: "h1", why: "Refund entry point.", rank: 1, focusStart: null, focusEnd: null },
      { hunkId: "h2", why: "Audit trail.", rank: 2, focusStart: null, focusEnd: null },
      { hunkId: "h3", why: "Notify downstream.", rank: 3, focusStart: null, focusEnd: null },
    ],
    questions: [
      {
        id: "q1",
        kind: "data-flow",
        text: "Where does money flow?",
        expectedAnswer: "Through ledger.",
        hunks: ["h1"],
      },
      {
        id: "q2",
        kind: "failure",
        text: "What if ledger fails?",
        expectedAnswer: "Refund errors.",
        hunks: ["h1"],
      },
      {
        id: "q3",
        kind: "debugging",
        text: "Where to trace?",
        expectedAnswer: "Audit log.",
        hunks: ["h2"],
      },
    ],
    summary: ["Refunds added.", "Ledger touched.", "Notifications fire."],
    edgeCase: "Partial refund with zero amount.",
  };
}
