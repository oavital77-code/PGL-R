import { getTranslations } from "next-intl/server";
import { isNull, and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, documentTypes, users } from "@/lib/db/schema";
import type { DocumentEntity } from "@/lib/storage";
import { formatDate } from "@/lib/i18n/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadDocumentsForm, DeleteDocumentButton } from "./documents-client";

/** Documents tab: list + drag&drop upload (spec §8.5). */
export async function DocumentsPanel({ entityType, entityId, canEdit, defaultType }: { entityType: DocumentEntity; entityId: string; canEdit: boolean; defaultType?: string }) {
  const [t, rows, types] = await Promise.all([
    getTranslations("documents"),
    db
      .select({ d: documents, uploader: users.firstName, uploaderLast: users.lastName })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.uploadedBy))
      .where(and(eq(documents.entityType, entityType), eq(documents.entityId, entityId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt)),
    db.select({ code: documentTypes.code, name: documentTypes.name }).from(documentTypes).where(eq(documentTypes.isActive, true)).orderBy(documentTypes.sortOrder),
  ]);
  const typeName = new Map(types.map((x) => [x.code, x.name]));
  return (
    <div className="space-y-4">
      {canEdit ? <UploadDocumentsForm entityType={entityType} entityId={entityId} types={types} defaultType={defaultType} /> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("file")}</TableHead>
            <TableHead>{t("type")}</TableHead>
            <TableHead>{t("version")}</TableHead>
            <TableHead>{t("size")}</TableHead>
            <TableHead>{t("uploaded_by")}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map(({ d, uploader, uploaderLast }) => (
              <TableRow key={d.id}>
                <TableCell>
                  <a href={`/api/files/${d.id}`} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                    {d.fileName}
                  </a>
                  {d.mimeType === "application/pdf" || d.mimeType.startsWith("image/") ? (
                    <a href={`/api/files/${d.id}?inline=1`} className="ms-2 text-xs text-muted-foreground hover:underline" target="_blank" rel="noreferrer">
                      {t("preview")}
                    </a>
                  ) : null}
                </TableCell>
                <TableCell>{d.documentType ? (typeName.get(d.documentType) ?? d.documentType) : "—"}</TableCell>
                <TableCell className="num">{d.version}</TableCell>
                <TableCell className="num">{(d.sizeBytes / 1024).toFixed(0)} KB</TableCell>
                <TableCell>{uploader ? `${uploader} ${uploaderLast}` : "—"}</TableCell>
                <TableCell className="num">{formatDate(d.createdAt)}</TableCell>
                <TableCell className="text-end">{canEdit ? <DeleteDocumentButton id={d.id} /> : null}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
