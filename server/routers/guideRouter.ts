/**
 * Guide content router — allows admins to read and update editable text fields
 * and images in the Guide presentations. Content is stored in the guide_content table.
 *
 * Each field is identified by (presentationId, slideId, fieldKey).
 * Content is a JSON string: plain text for single-value fields, JSON array for bullet lists,
 * or an S3 URL for image fields.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { guideContent } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { storagePut } from "../storage";

// ─── Admin guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
  return next({ ctx });
});

// ─── Helper: upsert a content row ─────────────────────────────────────────────
async function upsertRow(
  presentationId: string,
  slideId: string,
  fieldKey: string,
  content: string,
  updatedBy: string
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const existing = await db
    .select({ id: guideContent.id })
    .from(guideContent)
    .where(
      and(
        eq(guideContent.presentationId, presentationId),
        eq(guideContent.slideId, slideId),
        eq(guideContent.fieldKey, fieldKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(guideContent)
      .set({ content, updatedBy })
      .where(eq(guideContent.id, existing[0].id));
  } else {
    await db.insert(guideContent).values({
      presentationId,
      slideId,
      fieldKey,
      content,
      updatedBy,
    });
  }
}

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
   * Upsert a single content field (text or JSON list). Admin only.
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
      await upsertRow(
        input.presentationId,
        input.slideId,
        input.fieldKey,
        input.content,
        ctx.user.name ?? ctx.user.email ?? "admin"
      );
      return { ok: true };
    }),

  /**
   * Upload an image to S3 and save the URL as a guide content field. Admin only.
   * Accepts base64-encoded image data.
   */
  uploadImage: adminProcedure
    .input(
      z.object({
        presentationId: z.string(),
        slideId: z.string(),
        fieldKey: z.string(),
        /** Base64-encoded image data (without data URL prefix) */
        base64: z.string(),
        mimeType: z.string().regex(/^image\//),
        filename: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Decode base64 to Buffer
      const buffer = Buffer.from(input.base64, "base64");

      // Generate a unique S3 key
      const ext = input.filename.split(".").pop() ?? "jpg";
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const key = `guide-images/${input.presentationId}/${input.slideId}/${input.fieldKey}-${randomSuffix}.${ext}`;

      // Upload to S3
      const { url } = await storagePut(key, buffer, input.mimeType);

      // Save URL to guide_content
      await upsertRow(
        input.presentationId,
        input.slideId,
        input.fieldKey,
        url,
        ctx.user.name ?? ctx.user.email ?? "admin"
      );

      return { url };
    }),
});
