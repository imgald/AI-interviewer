import { z } from "zod";

export const interviewerProfileUrlSchema = z.object({
  url: z.string().trim().url("A valid URL is required"),
});

export type InterviewerProfileUrlInput = z.infer<typeof interviewerProfileUrlSchema>;
