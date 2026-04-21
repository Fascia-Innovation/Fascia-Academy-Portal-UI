/**
 * Guide content router — allows admins to read and update editable text fields
 * in the Guide presentations. Content is stored in the guide_content table.
 *
 * Each field is identified by (presentationId, slideId, fieldKey).
 * Content is a JSON string: plain text for single-value fields, JSON array for bullet lists.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { guideContent } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";

// ─── Admin guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
  return next({ ctx });
});

export const guideRouter = router({
  /**
   * Get all content overrides for a presentation.
   * Returns a map: { [slideId__fieldKey]: content }
   */
  getContent: protectedProcedure
    .input(z.object({ presentationId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select()
        .from(guideContent)
        .where(eq(guideContent.presentationId, input.presentationId));

      const map: Record<string, string> = {};
      for (const row of rows) {
        map[`${row.slideId}__${row.fieldKey}`] = row.content;
      }
      return map;
    }),

  /**
   * Upsert a single content field. Admin only.
   */
  upsertContent: adminProcedure
    .input(
      z.object({
        presentationId: z.string(),
        slideId: z.string(),
        fieldKey: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Check if row exists
      const existing = await db
        .select({ id: guideContent.id })
        .from(guideContent)
        .where(
          and(
            eq(guideContent.presentationId, input.presentationId),
            eq(guideContent.slideId, input.slideId),
            eq(guideContent.fieldKey, input.fieldKey)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(guideContent)
          .set({
            content: input.content,
            updatedBy: ctx.user.name ?? ctx.user.email ?? "admin",
          })
          .where(eq(guideContent.id, existing[0].id));
      } else {
        await db.insert(guideContent).values({
          presentationId: input.presentationId,
          slideId: input.slideId,
          fieldKey: input.fieldKey,
          content: input.content,
          updatedBy: ctx.user.name ?? ctx.user.email ?? "admin",
        });
      }

      return { ok: true };
    }),
});
