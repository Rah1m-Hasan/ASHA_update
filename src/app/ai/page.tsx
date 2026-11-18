import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, type Bar } from "@/components/ai/BarChart";
import report from "../../../docs/retrieval-eval.json";
import { MCP_SERVERS } from "@/server/mcp/servers.js";
import { MAIRA_ROUTES } from "@/server/lib/maira-provider.js";
import { OLLAMA_MODELS } from "@/server/lib/ollama-provider.js";

export const metadata: Metadata = {
  title: "How Asha uses AI",
  description:
    "What runs where in Asha, what was measured, and what is not proven yet.",
};

type Score = { recallAt3: number; mrr: number };
const summary = report.summary as Record<
  "all" | "en" | "bn",
  Record<string, Score>
>;
const total = report.cases;

const METHODS: { key: string; label: string; emphasis?: string }[] = [
  {
    key: "bm25.local",
    label: "Keyword search in the app (BM25)",
    emphasis: "Used when the index is unreachable",
  },
  { key: "fullText.rewritten", label: "Full text only" },
  { key: "semantic.rewritten", label: "Semantic only" },
  { key: "hybrid.rewritten", label: "Hybrid (semantic + full text)" },
  {
    key: "hybridGraph.rewritten",
    label: "Hybrid + knowledge graph",
    emphasis: "What the app serves",
  },
];

const answered = (s: Score, n: number) => Math.round(s.recallAt3 * n);
const methodBars: Bar[] = METHODS.map((m) => {
  const s = summary.all[m.key];
  return {
    label: m.label,
    emphasis: m.emphasis,
    value: s.mrr,
    details: [
      `MRR ${s.mrr.toFixed(3)}`,
      `Answered in the top 3: ${answered(s, total)} of ${total}`,
    ],
  };
});
const bn = report.languages.bn;
const rewriteBars: Bar[] = [
  { key: "hybridGraph.raw", label: "Without query rewriting" },
  { key: "hybridGraph.rewritten", label: "With query rewriting" },
].map((m) => {
  const s = summary.bn[m.key];
  return {
    label: m.label,
    value: s.recallAt3,
    details: [
      `Answered in the top 3: ${answered(s, bn)} of ${bn}`,
      `MRR ${s.mrr.toFixed(3)}`,
    ],
  };
});

const ON_DEVICE = [
  [
    "MediaPipe Face Landmarker",
    "Eyes, blinks and face signals for EyeSpeak and FaceSpeak",
  ],
  [
    "MediaPipe Hand and Pose Landmarkers",
    "Hand gestures, movement and posture",
  ],
  [
    "FingerSpeak sequence model (TensorFlow.js)",
    "Learns one patient's own hand signs",
  ],
  ["YOLO26n-pose (ONNX Runtime Web)", "Optional pose tracking"],
  [
    "EfficientNet-Lite0 (int8)",
    "Experimental food suggestions. It is not trained on food.",
  ],
];

const ROUTE_LABELS: Record<string, string> = {
  conversation: "English conversation",
  bilingual: "Bangla and mixed language",
  speech: "Clarifying unclear speech",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="text-lg font-semibold text-heading">{title}</h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-canvas">
      {children}
    </div>
  );
}

function Row({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-sm font-medium text-ink">{title}</p>
      {meta && <p className="mt-0.5 text-sm text-muted">{meta}</p>}
      {children}
    </div>
  );
}

export default function AiPage() {
  const ran = new Date(report.ranAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <main className="min-h-screen bg-wash pb-20">
      <div className="mx-auto w-full max-w-3xl px-4 pt-12 sm:px-8">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Asha
        </Link>
        <h1 className="mt-6 text-3xl font-semibold text-heading">
          How Asha uses AI
        </h1>
        <p className="mt-3 text-muted">
          What runs where, what we measured, and what is not proven yet. Camera
          models run on the device. Language models only see text, and an
          urgent-symptom check runs before any of them.
        </p>

        <Section title="Answers about the app">
          <p className="mt-2 text-sm text-muted">
            When someone asks how Asha works, it searches eight short app guides
            and gives the passages it finds to the language model. We asked{" "}
            {total} questions ({report.languages.en} English, {bn} Bangla) and
            checked whether a passage from the right guide came back.
          </p>
          <div className="mt-4 rounded-2xl border border-line bg-canvas px-5 py-5">
            <p className="text-sm font-medium text-ink">
              How high the right guide ranks (mean reciprocal rank, 1.0 is
              always first)
            </p>
            <BarChart
              bars={methodBars}
              label="Mean reciprocal rank by search method, all questions"
            />
            <p className="mt-4 text-sm text-muted">
              Every Supabase method with query rewriting found the right guide
              in the top three for all {total} questions. Keyword search in the
              app found it for {answered(summary.all["bm25.local"], total)}.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-canvas px-5 py-5">
            <p className="text-sm font-medium text-ink">
              Bangla questions answered in the top three
            </p>
            <BarChart
              bars={rewriteBars}
              label="Share of Bangla questions answered in the top three, with and without query rewriting"
              unit="percent"
            />
            <p className="mt-4 text-sm text-muted">
              The embedding model reads English. Asha maps Bangla words to the
              English terms of its own word list before searching, which is what
              makes Bangla work.
            </p>
          </div>

          <details className="mt-4 rounded-2xl border border-line bg-canvas px-5 py-4 text-sm">
            <summary className="cursor-pointer text-ink">
              Show all results as a table
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left tabular-nums">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-normal">Method</th>
                    <th className="py-2 pr-4 font-normal">Recall@3</th>
                    <th className="py-2 pr-4 font-normal">MRR</th>
                    <th className="py-2 pr-4 font-normal">English MRR</th>
                    <th className="py-2 font-normal">Bangla MRR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {METHODS.map((m) => (
                    <tr key={m.key}>
                      <td className="py-2 pr-4 text-ink">{m.label}</td>
                      <td className="py-2 pr-4">
                        {summary.all[m.key].recallAt3.toFixed(3)}
                      </td>
                      <td className="py-2 pr-4">
                        {summary.all[m.key].mrr.toFixed(3)}
                      </td>
                      <td className="py-2 pr-4">
                        {summary.en[m.key].mrr.toFixed(3)}
                      </td>
                      <td className="py-2">
                        {summary.bn[m.key].mrr.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-muted">
              Measured on {ran} against index {report.hybridIndex}. The
              questions were written by the Asha team, not by patients, so treat
              this as a check that the pipeline works rather than a benchmark.
              Method: semantic chunks with gte-small embeddings in pgvector,
              Postgres full text, reciprocal rank fusion, and a 28-edge
              knowledge graph between guides. Confirmed patient speech never
              leaves Asha&apos;s server.
            </p>
          </details>
        </Section>

        <Section title="Language models">
          <Card>
            {Object.entries(MAIRA_ROUTES).map(([task, route]) => (
              <Row
                key={task}
                title={ROUTE_LABELS[task] || task}
                meta={`${route.model}, through the MAIRA API`}
              />
            ))}
            <Row
              title="Local option"
              meta={`Ollama, on a computer the Asha server can reach: ${OLLAMA_MODELS.map(
                (m) => m.model,
              )
                .filter((m, i, a) => a.indexOf(m) === i)
                .join(", ")}`}
            >
              <p className="mt-1 text-sm text-muted">
                It can take over when MAIRA is unreachable, or run everything
                without the cloud. Its accuracy has not been measured yet.
              </p>
            </Row>
          </Card>
          <p className="mt-3 text-sm text-muted">
            Every model reply must be valid JSON with an allowed tool call, and
            Asha checks it before using it. Urgent symptoms get a fixed safety
            reply without any model.
          </p>
        </Section>

        <Section title="On the device">
          <Card>
            {ON_DEVICE.map(([name, use]) => (
              <Row key={name} title={name} meta={use} />
            ))}
          </Card>
          <p className="mt-3 text-sm text-muted">
            Camera frames are processed on the phone or computer and are not
            uploaded.
          </p>
        </Section>

        <Section title="Tools for AI assistants (MCP)">
          <p className="mt-2 text-sm text-muted">
            Five Model Context Protocol servers let an assistant such as Claude
            use Asha&apos;s own tools. The caregiver server needs the token from
            the caregiver&apos;s private link.
          </p>
          <Card>
            {Object.entries(MCP_SERVERS).map(([key, server]) => (
              <Row key={key} title={`/api/mcp/${key}`} meta={server.summary}>
                <p className="mt-1 font-mono text-xs text-muted">
                  {server.tools.join(" · ")}
                </p>
              </Row>
            ))}
          </Card>
        </Section>

        <Section title="Caregiver reminders">
          <Card>
            <Row
              title="When a request is not acknowledged"
              meta="An n8n workflow waits, asks Asha whether the caregiver has seen the request, and if not, asks Asha to remind them. At most three reminders."
            />
            <Row
              title="What it is sent"
              meta="Only the request type, its id, the patient id and a time. Both directions are signed."
            />
            <Row
              title="Tested"
              meta="End to end with n8n 1.123.91 on 18 November 2026. Not yet run against a hosted n8n."
            />
          </Card>
        </Section>

        <Section title="Not proven yet">
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Accuracy of the local models.</li>
            <li>
              Retrieval on real caregiver and patient questions. The current set
              is small and written by the team.
            </li>
            <li>Any clinical use. Asha is not a medical device.</li>
          </ul>
        </Section>
      </div>
    </main>
  );
}
