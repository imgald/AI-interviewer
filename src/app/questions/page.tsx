import { prisma } from "@/lib/db";
import { QuestionsExplorer, type QuestionExplorerItem } from "@/components/questions/questions-explorer";
import { QUESTION_BANK } from "@/lib/interview/question-bank";

export const dynamic = "force-dynamic";

const shellStyle = {
  minHeight: "100vh",
  padding: "24px 20px 40px",
} as const;

type QuestionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function QuestionsPage(_props: QuestionsPageProps) {
  const questions = await prisma.question.findMany({
    where: { isActive: true },
  });

  const questionOrderBySlug = new Map<string, number>();
  for (let index = 0; index < QUESTION_BANK.length; index += 1) {
    questionOrderBySlug.set(QUESTION_BANK[index]?.slug ?? "", index + 1);
  }

  const explorerItems: QuestionExplorerItem[] = questions
    .map((question) => ({
      id: question.id,
      order: questionOrderBySlug.get(question.slug) ?? null,
      title: question.title,
      type: question.type,
      difficulty: question.difficulty,
      levelTarget: question.type === "SYSTEM_DESIGN" ? "N/A" : (question.levelTarget ?? "SDE2"),
      companyStyle: question.companyStyle ?? "GENERIC",
      estimatedMinutes: question.estimatedMinutes ?? null,
      topicTags: toStringArray(question.topicTags),
    }))
    .sort(
      (left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) ||
        left.title.localeCompare(right.title),
    );

  return (
    <main style={shellStyle}>
      <QuestionsExplorer questions={explorerItems} />
    </main>
  );
}
