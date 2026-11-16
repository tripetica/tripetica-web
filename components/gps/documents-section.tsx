"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GpsVehicleIdentity } from "@/components/gps/vehicle-identity";
import { deleteVehicleDocumentAction, saveVehicleDocumentAction } from "@/lib/gps/document-actions";
import {
  documentCopyFor,
  documentLocale,
  documentStatusLabel,
  documentTypeName,
  formatDocumentDate,
  type DocumentCopy,
  type DocumentStatus,
  type VehicleDocumentType,
} from "@/lib/gps/documents";

type DocumentRow = {
  type: VehicleDocumentType;
  officialName: string;
  expiresOn: string | null;
  daysLeft: number | null;
  status: DocumentStatus;
  policyNumber: string | null;
  hasFile: boolean;
  fileMime: string | null;
};

type Editor = {
  mode: "create" | "edit";
  type: VehicleDocumentType;
  expiresOn: string;
  policyNumber: string;
  hasFile: boolean;
};

function errorText(copy: DocumentCopy, error: string) {
  if (error === "forbidden") return copy.forbidden;
  if (error === "file") return copy.fileError;
  if (error === "exists") return copy.exists;
  if (error === "missing") return copy.missing;
  if (error === "delete") return copy.deleteFailed;
  if (error === "failed") return copy.failed;
  return copy.invalid;
}

export function GpsDocumentsPanel({
  vehicleId,
  locale,
  documentsUrl = "/api/gps/documents",
  canEdit,
  plate = null,
  brand = null,
  model = null,
}: {
  vehicleId: string;
  locale: string;
  documentsUrl?: string;
  canEdit: boolean;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
}) {
  const copy = documentCopyFor(locale);
  const names = documentLocale(locale);
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [editable, setEditable] = useState(canEdit);
  const [problem, setProblem] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmType, setConfirmType] = useState<VehicleDocumentType | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pickedFile, setPickedFile] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const saved = (rows ?? []).filter((row) => row.status !== "empty");
  const available = (rows ?? []).filter((row) => row.status === "empty");

  useEffect(() => {
    let stopped = false;
    async function pull() {
      try {
        const response = await fetch(`${documentsUrl}/${vehicleId}?locale=${encodeURIComponent(locale)}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) {
          if (!stopped) setProblem(response.status === 401 || response.status === 404 ? copy.forbidden : copy.failed);
          return;
        }
        const body = await response.json() as { documents?: DocumentRow[]; canEdit?: boolean };
        if (!stopped && Array.isArray(body.documents)) {
          setRows(body.documents);
          setEditable(canEdit && body.canEdit !== false);
          setProblem(null);
          return;
        }
        if (!stopped) setProblem(copy.failed);
      } catch {
        if (!stopped) setProblem(copy.failed);
      }
    }
    void pull();
    return () => {
      stopped = true;
    };
  }, [attempt, canEdit, copy.failed, copy.forbidden, documentsUrl, locale, vehicleId]);

  useLayoutEffect(() => {
    const form = formRef.current;
    if (!editor || !form) return;
    const field = form.querySelector<HTMLElement>("select[name='documentType'], input[name='expiresOn']");
    const reveal = () => {
      if (!form.isConnected) return;
      form.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
    };
    reveal();
    field?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    const keepFieldVisible = () => {
      if (!field?.isConnected || !viewport) return;
      const rect = field.getBoundingClientRect();
      const top = viewport.offsetTop + 12;
      const bottom = viewport.offsetTop + viewport.height - 12;
      if (rect.top >= top && rect.bottom <= bottom) return;
      window.scrollBy(0, rect.top < top ? rect.top - top : rect.bottom - bottom);
    };
    viewport?.addEventListener("resize", keepFieldVisible);
    const frame = window.requestAnimationFrame(reveal);
    const timer = window.setTimeout(keepFieldVisible, 350);
    return () => {
      viewport?.removeEventListener("resize", keepFieldVisible);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [editor]);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setProblem(null);
    const result = await saveVehicleDocumentAction(formData);
    setPending(false);
    if (!result.ok) {
      setProblem(errorText(copy, result.error));
      return;
    }
    setEditor(null);
    setPickedFile("");
    setConfirmType(null);
    setAttempt((value) => value + 1);
  }

  async function remove(type: VehicleDocumentType) {
    setPending(true);
    setProblem(null);
    const result = await deleteVehicleDocumentAction(vehicleId, type);
    setPending(false);
    if (!result.ok) {
      setProblem(result.error === "failed" ? copy.deleteFailed : errorText(copy, result.error));
      return;
    }
    if (editor?.type === type) setEditor(null);
    setConfirmType(null);
    setPickedFile("");
    setAttempt((value) => value + 1);
  }

  function openCreate() {
    const first = available[0];
    if (!first) return;
    setProblem(null);
    setPickedFile("");
    setEditor({
      mode: "create",
      type: first.type,
      expiresOn: "",
      policyNumber: "",
      hasFile: false,
    });
  }

  return (
    <div className="gps-documents">
      <h2>{copy.title}</h2>
      <GpsVehicleIdentity plate={plate} brand={brand} model={model} />
      {editable ? (
        <div className="gps-doc-toolbar">
          <button type="button" className="gps-doc-add" disabled={available.length === 0} onClick={openCreate}>
            + {copy.add}
          </button>
        </div>
      ) : null}
      {problem ? <p className="gps-inline-note">{problem}</p> : null}
      {editor && editable ? (
        <form
          ref={formRef}
          key={`${editor.mode}:${editor.type}`}
          className="gps-doc-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <input type="hidden" name="mode" value={editor.mode} />
          {editor.mode === "create" ? (
            <label>
              {copy.type}
              <select name="documentType" required defaultValue={editor.type}>
                {available.map((row) => (
                  <option key={row.type} value={row.type}>{row.officialName || documentTypeName(row.type, names)}</option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <input type="hidden" name="documentType" value={editor.type} />
              <label>{copy.type}<input value={documentTypeName(editor.type, names)} readOnly /></label>
            </>
          )}
          <label>{copy.expires}<input name="expiresOn" type="date" required defaultValue={editor.expiresOn} /></label>
          <label className="gps-doc-file">
            {copy.file}
            <span className="gps-doc-file-button">
              {copy.filePick}
              <input
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.heic,.heif"
                onChange={(event) => setPickedFile(event.currentTarget.files?.[0]?.name ?? "")}
              />
            </span>
            {pickedFile ? <span className="gps-doc-file-name">{pickedFile}</span> : null}
          </label>
          <p className="gps-inline-note">{copy.fileHint}</p>
          <label>{copy.policy}<input name="policyNumber" maxLength={80} defaultValue={editor.policyNumber} /></label>
          {editor.mode === "edit" && editor.hasFile ? (
            <label className="gps-doc-check"><input name="removeFile" type="checkbox" value="1" /> {copy.removeFile}</label>
          ) : null}
          <div className="gps-doc-actions">
            <button className="ops-btn gps-doc-save" type="submit" disabled={pending}>{copy.save}</button>
            <button className="ops-btn gps-doc-cancel" type="button" onClick={() => { setPickedFile(""); setEditor(null); }}>{copy.cancel}</button>
          </div>
        </form>
      ) : null}
      {rows && saved.length > 0 ? (
        <ul className="gps-doc-list">
          {saved.map((row) => (
            <li key={row.type} className={`gps-doc-card gps-doc-${row.status}`}>
              <div>
                <strong>{row.officialName || documentTypeName(row.type, names)}</strong>
                <span className="gps-doc-status">{documentStatusLabel(copy, row.status)}</span>
              </div>
              <dl>
                <div><dt>{copy.expires}</dt><dd>{row.expiresOn ? formatDocumentDate(row.expiresOn) : "—"}</dd></div>
                <div><dt>{copy.days}</dt><dd>{row.daysLeft === null ? "—" : row.daysLeft}</dd></div>
                <div><dt>{copy.policy}</dt><dd>{row.policyNumber || "—"}</dd></div>
              </dl>
              <div className="gps-doc-actions">
                {row.hasFile ? (
                  <a className="ops-btn ops-btn-secondary" href={`${documentsUrl}/${vehicleId}/${row.type}/file`} target="_blank" rel="noreferrer">{copy.open}</a>
                ) : null}
                {editable ? (
                  <button type="button" className="ops-btn ops-btn-secondary" onClick={() => { setPickedFile(""); setConfirmType(null); setEditor({
                    mode: "edit",
                    type: row.type,
                    expiresOn: row.expiresOn ?? "",
                    policyNumber: row.policyNumber ?? "",
                    hasFile: row.hasFile,
                  }); }}>{copy.edit}</button>
                ) : null}
                {editable && confirmType === row.type ? (
                  <div className="gps-doc-confirm">
                    <p>{copy.deleteAsk}</p>
                    <button type="button" className="gps-doc-delete" disabled={pending} onClick={() => void remove(row.type)}>{copy.delete}</button>
                    <button type="button" className="ops-btn ops-btn-secondary" onClick={() => setConfirmType(null)}>{copy.cancel}</button>
                  </div>
                ) : editable ? (
                  <button type="button" className="gps-doc-delete" onClick={() => { setConfirmType(row.type); setEditor(null); }}>{copy.delete}</button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : rows ? null : <p>{copy.loading}</p>}
    </div>
  );
}
