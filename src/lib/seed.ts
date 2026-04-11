import { prisma } from "@/lib/db";
import { QUESTION_BANK } from "@/lib/interview/question-bank";

export async function ensureSeedData() {
  const existing = await prisma.user.findFirst({
    where: { email: "demo@example.com" },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        email: "demo@example.com",
        name: "Demo Candidate",
      },
    });
  }

  const batchSize = 25;
  for (let index = 0; index < QUESTION_BANK.length; index += batchSize) {
    const batch = QUESTION_BANK.slice(index, index + batchSize);
    await prisma.$transaction(
      batch.map((question) =>
        prisma.question.upsert({
          where: { slug: question.slug },
          update: question,
          create: question,
        }),
      ),
    );
  }
}
