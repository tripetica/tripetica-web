"use client";
import { useUetdsValidation } from "@/components/uetds/use-uetds-validation";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { SearchableSelect } from "@/components/partner/searchable-select";
import { UetdsLocationField } from "@/components/uetds/uetds-location-field";
import { UetdsPassengerRemoveButton } from "@/components/uetds/uetds-passenger-remove-button";
import { countries } from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import {
  replaceCompany,
  replaceCount,
  replaceTime,
  uetdsEligibilityMessage,
  uetdsMissingFieldMessage,
  type UetdsFormCopy,
} from "@/lib/uetds/copy";
import {
  countSuggestedFields,
  createPassengerDraft,
  markUserEdited,
  missingMandatoryFields,
  canonicalGroupPurpose,
  purposeForTripKind,
  syncDraftLocations,
  type UetdsDraft,
  type UetdsFieldConflict,
  type UetdsFieldProvenance,
  type UetdsPassengerDraft,
  type UetdsTripKind,
} from "@/lib/uetds/draft";
import { applyUetdsStartToEnd, isUetdsEndAfterStart } from "@/lib/uetds/trip-time";
import { evaluateUetdsEligibility } from "@/lib/uetds/eligibility";
import { extractionHasStructuredFields } from "@/lib/uetds/extract";
import { cloneUetdsDraft } from "@/lib/uetds/ai-edit";
import { captureAiEditSnapshot, planAiEditContinue, portalNextDraftFromSnapshot, type AiEditChangePlan, type AiEditSnapshot, type PortalNextDraft } from "@/lib/uetds/ai-edit-snapshot";
import { AiEditLunaWorkspace } from "@/components/uetds/ai-edit-luna-workspace";
import { AI_EXTRACTION_MAX_TEXT, mergeAiUetdsExtraction, type AiExtractionMergeOptions } from "@/lib/uetds/ai-extraction-schema";
import {
  createBrowserUetdsPlacesLookup,
  enrichUetdsDraftLocationsFromText,
} from "@/lib/uetds/resolve-location";
import { initialUetdsFleetSelection, selectedFleetCompany, type UetdsFleetOption, type UetdsFleetScope } from "@/lib/uetds/fleet-options";
import {
  allowedAuthorityIds,
  applyDriverVehicleDefault,
  authorityForNotificationForm,
  initialVehicleForSelectedDriver,
  type AuthorityChoice,
} from "@/lib/partner/fleet-pairing-rules";
import {
  extractUetdsDocumentAction,
  persistAiEditTargetAction,
  saveUetdsFormDraftAction,
  submitUetdsNotificationAction,
  type UetdsSubmitFormState,
} from "@/lib/uetds/notification-actions";
import { type UetdsLocation } from "@/lib/uetds/location";
import { prepareUetdsUploadFiles } from "@/lib/uetds/optimize-image";
import { appendUetdsImageFiles } from "@/lib/uetds/upload-files";
import {
  isOversizedUetdsBatch,
  isOversizedUetdsFile,
  UETDS_MAX_IMAGE_COUNT,
} from "@/lib/uetds/upload-limits";

type UetdsNotificationFormProps = {
  locale: Locale;
  copy: UetdsFormCopy;
  actor: UetdsFleetScope;
  ministryEnv: "test" | "live" | null;
  initialDraft: UetdsDraft;
  drivers: UetdsFleetOption[];
  vehicles: UetdsFleetOption[];
  authorities?: readonly AuthorityChoice[];
  listHref: string;
  /** Prefilled edit of an existing notification. Original stays untouched in memory. */
  aiEdit?: {
    originalDraft: UetdsDraft;
    meta: {
      notificationId: string;
      partnerId: string;
      companyId: string | null;
      companyName: string;
      seferReference: string | null;
      firmaSeferNo: string | null;
      plate: string;
      driverName: string;
      vehicleLabel: string;
    };
  };
};

function provenanceHint(value: UetdsFieldProvenance, copy: UetdsFormCopy) {
  if (value === "suggested") {
    return copy.suggested;
  }
  if (value === "document") {
    return copy.fromDocument;
  }
  if (value === "reservation") {
    return copy.fromReservation;
  }
  return null;
}

function ProvenanceNote({
  value,
  copy,
}: {
  value: UetdsFieldProvenance;
  copy: UetdsFormCopy;
}) {
  const hint = provenanceHint(value, copy);
  if (!hint || value === "reservation") {
    return null;
  }
  return <p className="uetds-field-hint">{hint}</p>;
}

export function UetdsNotificationForm({
  locale,
  copy,
  actor,
  ministryEnv,
  initialDraft,
  drivers,
  vehicles,
  authorities = [],
  listHref,
  aiEdit,
}: UetdsNotificationFormProps) {
  const originalDraftRef = useRef(aiEdit ? cloneUetdsDraft(aiEdit.originalDraft) : null);
  const oldSnapshotRef = useRef<AiEditSnapshot | null>(aiEdit ? captureAiEditSnapshot(aiEdit.originalDraft, aiEdit.meta) : null);
  const newSnapshotRef = useRef<AiEditSnapshot | null>(null);
  const aiMergeOptions: AiExtractionMergeOptions | undefined = aiEdit
    ? { lockPassengerCount: true, preserveUntouchedTimes: true, replaceMissingDocument: true }
    : undefined;
  const [draft, setDraft] = useState(() => {
    const selected = syncDraftLocations({
      ...initialDraft,
      ...initialUetdsFleetSelection(initialDraft, drivers, vehicles),
    });
    const driver = drivers.find((item) => item.id === selected.driverId);
    return initialVehicleForSelectedDriver(
      selected,
      initialDraft.vehicleId,
      driver?.defaultVehicleId,
      vehicles.map((item) => item.id),
    );
  });
  const [authorityId, setAuthorityId] = useState(() => {
    const selected = drivers.find((item) => item.id === draft.driverId);
    return authorityForNotificationForm({
      previousDriverId: "",
      nextDriverId: selected?.id ?? "",
      currentAuthorityId: "",
      defaultAuthorityId: selected?.defaultAuthorityId,
      allowedAuthorityIds: selected ? allowedAuthorityIds(selected, authorities) : [],
    });
  });
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [conflicts, setConflicts] = useState<UetdsFieldConflict[]>([]);
  const [extractHint, setExtractHint] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [locationPrefillVersion, setLocationPrefillVersion] = useState(0);
  const extractionInFlight = useRef(false);
  const extractionValidationPending = useRef(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const selectedFiles = [...documentFiles, ...imageFiles];
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<AiEditChangePlan | null>(null);
  const [lunaOpen, setLunaOpen] = useState(false);
  const [lunaDraft, setLunaDraft] = useState<PortalNextDraft | null>(null);
  const [aiContinueHint, setAiContinueHint] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<UetdsSubmitFormState, FormData>(
    submitUetdsNotificationAction,
    { ok: false, error: null, id: null, ministryMessage: null, seferReferansNo: null, ministryStatus: null, timeAdjustment: null },
  );
  const submittedOk = state.ok && state.ministryStatus === "submitted";
  const storedAttempt = state.ok && Boolean(state.id);
  const timeAdjustment = state.timeAdjustment;
  const startAdjustedLabel =
    timeAdjustment?.startAdjusted
      ? replaceTime(copy.startAdjusted, `${timeAdjustment.startDate} ${timeAdjustment.startTime}`)
      : null;
  const endAdjustedLabel =
    timeAdjustment?.endAdjusted
      ? replaceTime(copy.endAdjusted, `${timeAdjustment.endDate} ${timeAdjustment.endTime}`)
      : null;

  const skipFirstSave = useRef(true);

  function snapshotMeta(nextDraft: UetdsDraft) {
    if (!aiEdit) return null;
    const driver = drivers.find((item) => item.id === nextDraft.driverId);
    const vehicle = vehicles.find((item) => item.id === nextDraft.vehicleId);
    return {
      ...aiEdit.meta,
      driverName: nextDraft.driverId === aiEdit.originalDraft.driverId ? aiEdit.meta.driverName : driver?.label || aiEdit.meta.driverName,
      vehicleLabel: vehicle?.label || aiEdit.meta.vehicleLabel,
      plate: nextDraft.vehicleId === aiEdit.originalDraft.vehicleId ? aiEdit.meta.plate : vehicle?.label || aiEdit.meta.plate,
    };
  }

  function rememberNewSnapshot(nextDraft: UetdsDraft) {
    if (!aiEdit || !originalDraftRef.current) return null;
    const meta = snapshotMeta(nextDraft);
    if (!meta) return null;
    const planned = planAiEditContinue({
      existingOld: oldSnapshotRef.current,
      originalDraft: originalDraftRef.current,
      currentDraft: nextDraft,
      meta,
      authorityId,
    });
    if (!oldSnapshotRef.current) oldSnapshotRef.current = planned.old;
    newSnapshotRef.current = planned.next;
    setEditPlan(planned.plan);
    return planned;
  }

  function clearEditMemory() {
    oldSnapshotRef.current = null;
    newSnapshotRef.current = null;
    setEditPlan(null);
    setLunaOpen(false);
    setLunaDraft(null);
  }
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    return () => {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      if (imageRef.current) {
        imageRef.current.value = "";
      }
    };
  }, []);

  useEffect(() => {
    if (!timeAdjustment?.startAdjusted) {
      return;
    }
    setDraft((current) => ({
      ...current,
      startDate: timeAdjustment.startDate,
      startTime: timeAdjustment.startTime,
      endDate: timeAdjustment.endDate,
      endTime: timeAdjustment.endTime,
    }));
  }, [timeAdjustment]);

  useEffect(() => {
    if (aiEdit || !draft.reservationId || submittedOk || storedAttempt) {
      return;
    }
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const formData = new FormData();
      formData.set("actor", actor);
      formData.set("draft", JSON.stringify(draft));
      void saveUetdsFormDraftAction(formData);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [actor, aiEdit, draft, submittedOk, storedAttempt]);

  useEffect(() => {
    if (aiEdit || !draft.reservationId) return;
    function flushDraft() {
      if (submittedOk || storedAttempt) {
        return;
      }
      const formData = new FormData();
      formData.set("actor", actor);
      formData.set("draft", JSON.stringify(draftRef.current));
      void saveUetdsFormDraftAction(formData);
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    }
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [actor, aiEdit, draft.reservationId, submittedOk, storedAttempt]);

  const countryOptions = useMemo(
    () =>
      countries()
        .map((country) => ({
          value: country.iso2,
          label: country.names[locale] || country.names.en,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [locale],
  );
  const driverOptions = useMemo(
    () => drivers.map((item) => ({ value: item.id, label: item.label })),
    [drivers],
  );
  const vehicleOptions = useMemo(
    () => vehicles.map((item) => ({ value: item.id, label: item.label })),
    [vehicles],
  );
  const driver = drivers.find((item) => item.id === draft.driverId) ?? null;
  const authorityOptions = useMemo(() => {
    const allowed = new Set(driver ? allowedAuthorityIds(driver, authorities) : []);
    return authorities
      .filter((item) => allowed.has(item.id))
      .map((item) => ({ value: item.id, label: item.label }));
  }, [authorities, driver]);
  const visibleAuthorityId = authorityOptions.some((item) => item.value === authorityId) ? authorityId : "";
  const vehicle = vehicles.find((item) => item.id === draft.vehicleId) ?? null;
  const company = selectedFleetCompany(driver, vehicle);
  const eligibility = evaluateUetdsEligibility({
    driverId: draft.driverId,
    vehicleId: draft.vehicleId,
    driverKind: draft.driverId ? "registered" : null,
    vehicleKind: draft.vehicleId ? "registered" : null,
    driverCompanyId: driver?.uetdsCompanyId ?? null,
    vehicleCompanyId: vehicle?.uetdsCompanyId ?? null,
    company,
  });
  const missing = missingMandatoryFields(draft);
  const endBeforeStart = Boolean(
    draft.startDate &&
      draft.startTime &&
      draft.endDate &&
      draft.endTime &&
      !isUetdsEndAfterStart(draft.startDate, draft.startTime, draft.endDate, draft.endTime),
  );
  const blocking = [...missing, ...(endBeforeStart ? ["endBeforeStart"] : [])];
  const suggested = countSuggestedFields(draft);
  const selectedDriverLabel = driver?.label ?? "";
  const selectedVehicleLabel = vehicle?.label ?? "";

  function updateLocation(key: "originLocation" | "destinationLocation", location: UetdsLocation) {
    setDraft((current) => {
      const next = {
        ...current,
        [key]: location,
        [key === "originLocation" ? "origin" : "destination"]: location.placeName,
        [key === "originLocation" ? "originReview" : "destinationReview"]: location.review,
        fieldProvenance: {
          ...current.fieldProvenance,
          [key === "originLocation" ? "origin" : "destination"]: markUserEdited(
            current.fieldProvenance[key === "originLocation" ? "origin" : "destination"],
            location.placeName,
            key === "originLocation" ? current.origin : current.destination,
          ),
        },
      };
      return next;
    });
    setFieldErrors([]);
  }

  function missingMessages(keys: string[]) {
    return keys.map((key) => uetdsMissingFieldMessage(key, copy));
  }

  function applyPurposeChip(tripKind: UetdsTripKind) {
    setDraft((current) => {
      const nextPurpose =
        tripKind === "other" && !["Transfer", "Tur", "Tahsis"].includes(current.purpose.trim())
          ? current.purpose
          : purposeForTripKind(tripKind);
      return {
        ...current,
        tripKind,
        purpose: nextPurpose,
        fieldProvenance: {
          ...current.fieldProvenance,
          purpose: markUserEdited(current.fieldProvenance.purpose, nextPurpose, current.purpose),
        },
      };
    });
    setFieldErrors([]);
  }

  function purposeChipSelected(tripKind: UetdsTripKind) {
    const canonical = canonicalGroupPurpose({ tripKind: draft.tripKind, purpose: draft.purpose });
    if (tripKind === "transfer") return canonical.purpose === "Transfer";
    if (tripKind === "tour") return canonical.purpose === "Tur";
    if (tripKind === "charter") return canonical.purpose === "Tahsis";
    return false;
  }

  async function continueAiEdit() {
    if (!aiEdit || !originalDraftRef.current) return;
    const source = originalDraftRef.current;
    const current = {
      ...draft,
      startDate: source.startDate,
      startTime: source.startTime,
      endDate: source.endDate,
      endTime: source.endTime,
    };
    setDraft(current);
    const planned = rememberNewSnapshot(current);
    if (!planned?.openLogin) {
      setAiContinueHint(copy.edevletAuthority);
      return;
    }
    const formData = new FormData();
    formData.set("actor", actor);
    formData.set("locale", locale);
    formData.set("id", aiEdit.meta.notificationId);
    formData.set("draft", JSON.stringify(current));
    const saved = await persistAiEditTargetAction(formData);
    if (!saved.ok) {
      setAiContinueHint(copy.saveFailed);
      return;
    }
    setExtractHint(null);
    setAiContinueHint(null);
    setLunaDraft(planned.next ? portalNextDraftFromSnapshot(planned.next) : null);
    setLunaOpen(true);
  }

  const visibleFieldErrors = fieldErrors.filter((message) => message !== copy.endBeforeStart);
  const validation = useUetdsValidation(draft, copy, !eligibility.ok || driver?.hasNationalId === false);
  useEffect(() => {
    if (extractionValidationPending.current) {
      extractionValidationPending.current = false;
      validation.validate();
    }
  }, [draft, validation]);

  function requestSend() {
    const valid = validation.validate();
    const keys = [
      ...missingMandatoryFields(draft),
      ...(endBeforeStart ? ["endBeforeStart"] : []),
    ];
    const fleetBlocked = !eligibility.ok;
    const driverIdentityMissing = Boolean(draft.driverId && driver && driver.hasNationalId === false);
    if (!valid || keys.length > 0 || fleetBlocked || driverIdentityMissing) {
      const messages = [
        ...missingMessages(keys),
        fleetBlocked ? uetdsEligibilityMessage(eligibility.reason, copy) : "",
        driverIdentityMissing ? copy.missingDriverIdentity : "",
      ].filter(Boolean);
      setFieldErrors(messages);
      return;
    }
    setFieldErrors([]);
    setConfirmOpen(true);
  }

  function updateTrip<K extends keyof UetdsDraft>(key: K, value: UetdsDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key in current.fieldProvenance) {
        const field = key as keyof UetdsDraft["fieldProvenance"];
        next.fieldProvenance = {
          ...current.fieldProvenance,
          [field]: markUserEdited(
            current.fieldProvenance[field],
            String(value ?? ""),
            String(current[key] ?? ""),
          ),
        };
      }
      return next;
    });
  }

  function updateStart(next: { startDate?: string; startTime?: string }) {
    setDraft((current) => {
      const startDate = next.startDate ?? current.startDate;
      const startTime = next.startTime ?? current.startTime;
      const end = aiEdit
        ? { endDate: current.endDate, endTime: current.endTime }
        : applyUetdsStartToEnd({
            startDate,
            startTime,
            endDate: current.endDate,
            endTime: current.endTime,
            endManual: current.endManual,
          });
      return {
        ...current,
        startDate,
        startTime,
        endDate: end.endDate,
        endTime: end.endTime,
        fieldProvenance: {
          ...current.fieldProvenance,
          startDate: markUserEdited(current.fieldProvenance.startDate, startDate, current.startDate),
          startTime: markUserEdited(current.fieldProvenance.startTime, startTime, current.startTime),
        },
      };
    });
    setFieldErrors([]);
  }

  function updateEnd(next: { endDate?: string; endTime?: string }) {
    setDraft((current) => ({
      ...current,
      endDate: next.endDate ?? current.endDate,
      endTime: next.endTime ?? current.endTime,
      endManual: true,
      fieldProvenance: {
        ...current.fieldProvenance,
        endDate: markUserEdited(
          current.fieldProvenance.endDate,
          next.endDate ?? current.endDate,
          current.endDate,
        ),
        endTime: markUserEdited(
          current.fieldProvenance.endTime,
          next.endTime ?? current.endTime,
          current.endTime,
        ),
      },
    }));
    setFieldErrors([]);
  }

  function updatePassenger(index: number, patch: Partial<UetdsPassengerDraft>) {
    setDraft((current) => ({
      ...current,
      passengers: current.passengers.map((passenger, itemIndex) => {
        if (itemIndex !== index) {
          return passenger;
        }
        const next = { ...passenger, ...patch };
        const provenance = { ...passenger.provenance };
        (["firstName", "lastName", "nationality", "identityNumber", "gender"] as const).forEach(
          (field) => {
            if (patch[field] != null && patch[field] !== passenger[field]) {
              provenance[field] = markUserEdited(
                passenger.provenance[field],
                String(patch[field] ?? ""),
                String(passenger[field] ?? ""),
              );
            }
          },
        );
        return { ...next, provenance };
      }),
    }));
  }

  async function runExtract(input: { files: File[]; text: string }) {
    if (extractionInFlight.current || (!input.files.length && !input.text.trim())) return false;
    if (input.text.length > AI_EXTRACTION_MAX_TEXT) {
      setExtractHint(copy.aiInputTooLarge);
      return false;
    }
    if (input.files.some((file) => isOversizedUetdsFile(file.size)) || isOversizedUetdsBatch(input.files.map((file) => file.size))) {
      setExtractHint(copy.fileTooLarge);
      return;
    }
    if (input.files.length > UETDS_MAX_IMAGE_COUNT) {
      setExtractHint(copy.fileTooLarge);
      return;
    }
    extractionInFlight.current = true;
    setExtracting(true);
    setExtractHint(copy.extracting);
    const formData = new FormData();
    formData.set("actor", actor);
    formData.set("text", input.text);
    try {
      const files = await prepareUetdsUploadFiles(input.files);
      if (files.some((file) => isOversizedUetdsFile(file.size)) || isOversizedUetdsBatch(files.map((file) => file.size))) {
        setExtractHint(copy.fileTooLarge);
        return;
      }
      for (const file of files) {
        formData.append("files", file);
      }
      const result = await extractUetdsDocumentAction(formData);
      if (result.error === "too-large") {
        setExtractHint(copy.fileTooLarge);
        return;
      }
      if (!result.ok) {
        const errorCopy = {
          "unsupported-type": copy.aiUnsupported,
          "model-unavailable": copy.aiModelUnavailable,
          unavailable: copy.aiUnavailable,
          timeout: copy.aiTimeout,
          busy: copy.aiBusy,
        };
        setExtractHint(result.error && result.error in errorCopy ? errorCopy[result.error as keyof typeof errorCopy] : copy.extractFailed);
        return false;
      }
      if (result.imageOnly || !extractionHasStructuredFields(result.extracted)) {
        setExtractHint(copy.extractNone);
        return false;
      }
      const merged = mergeAiUetdsExtraction(draftRef.current, result.extracted ?? {}, Date.now(), aiMergeOptions);
      const enriched = await enrichUetdsDraftLocationsFromText(
        merged.draft,
        createBrowserUetdsPlacesLookup(locale),
      );
      extractionValidationPending.current = true;
      const applied = { ...merged.draft, ...enriched };
      setDraft(applied);
      rememberNewSnapshot(applied);
      setLocationPrefillVersion((version) => version + 1);
      setConflicts(merged.conflicts);
      const missingAfter = missingMandatoryFields({ ...merged.draft, ...enriched });
      setExtractHint(
        merged.conflicts.length || missingAfter.length || countSuggestedFields({ ...merged.draft, ...enriched })
          ? copy.extractPartial
          : copy.extractApplied,
      );
      return true;
    } catch {
      setExtractHint(copy.extractFailed);
      return false;
    } finally {
      extractionInFlight.current = false;
      setExtracting(false);
    }
  }

  function clearFileInput(input: HTMLInputElement | null) {
    if (input) {
      input.value = "";
    }
  }

  function onDocumentFiles(kind: "file" | "images", list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    if (kind === "file") {
      // PDF picker is single-file; keep replace semantics.
      setDocumentFiles(files);
    } else {
      setImageFiles((current) => appendUetdsImageFiles(current, files, UETDS_MAX_IMAGE_COUNT));
    }
    clearFileInput(kind === "file" ? fileRef.current : imageRef.current);
  }

  async function onAnalyzeSources() {
    if (await runExtract({ files: selectedFiles, text: pasteText.trim() })) {
      setDocumentFiles([]);
      setImageFiles([]);
      setPasteText("");
      setPasteOpen(false);
    }
  }

  async function resolveConflict(conflict: UetdsFieldConflict, choice: "current" | "incoming") {
    if (choice === "incoming" && (conflict.path === "origin" || conflict.path === "destination")) {
      const key = conflict.path;
      const merged = mergeAiUetdsExtraction(
        { ...draft, fieldProvenance: { ...draft.fieldProvenance, [key]: "missing" } },
        { [key]: conflict.incoming },
        Date.now(),
        aiMergeOptions,
      ).draft;
      const enriched = await enrichUetdsDraftLocationsFromText(
        merged,
        createBrowserUetdsPlacesLookup(locale),
      );
      setDraft({ ...merged, ...enriched });
      setConflicts((current) => current.filter((item) => item.path !== conflict.path));
      return;
    }
    if (choice === "incoming") {
      const incoming = conflict.path.startsWith("passengers.")
        ? (() => {
            const [, indexText, field] = conflict.path.split(".");
            const passengers = [...draft.passengers];
            const index = Number(indexText);
            const current = passengers[index];
            if (current) {
              passengers[index] = {
                ...current,
                [field]: conflict.incoming,
                provenance: {
                  ...current.provenance,
                  [field === "identityNumber" ? "identityNumber" : field]: "document",
                },
              };
            }
            return { ...draft, passengers };
          })()
        : {
            ...draft,
            [conflict.path]: conflict.incoming,
            fieldProvenance: {
              ...draft.fieldProvenance,
              [conflict.path]: "document",
            },
          };
      setDraft(incoming as UetdsDraft);
    }
    setConflicts((current) => current.filter((item) => item.path !== conflict.path));
  }

  if (state.ok) {
    return (
      <section className="uetds-form" ref={validation.rootRef}>
        <p className={state.ministryStatus === "submitted" ? "ops-form-success" : "uetds-form-info"} role="status">
          {state.finalVerificationResult === "final-verification-failed"
            ? copy.finalVerificationFailed
            : state.finalVerificationResult === "verified"
              ? copy.verifiedByMinistry
              : state.ministryStatus === "partial"
            ? ministryEnv === "test"
              ? copy.testPartial
              : copy.livePartial
            : ministryEnv === "test"
              ? copy.saved
              : copy.savedLive}
        </p>
        {state.seferReferansNo ? (
          <p className="uetds-field-hint">
            {copy.seferRef}: {state.seferReferansNo}
          </p>
        ) : null}
        {startAdjustedLabel ? <p className="uetds-form-info" role="status">{startAdjustedLabel}</p> : null}
        {endAdjustedLabel ? <p className="uetds-form-info" role="status">{endAdjustedLabel}</p> : null}
        {state.ministryMessage && !state.finalVerificationResult ? <p className="uetds-field-hint">{state.ministryMessage}</p> : null}
        {state.id && state.finalVerificationResult === "final-verification-failed" ? (
          <a className="ops-btn-secondary" href={`${listHref}/${state.id}`}>{copy.retryVerification}</a>
        ) : null}
        <a className="ops-btn-secondary" href={listHref}>
          {copy.backToList}
        </a>
      </section>
    );
  }

  return (
    <section className="uetds-form uetds-new-form" ref={validation.rootRef}>
      {aiEdit ? (
        <dl className="uetds-confirm-dl">
          <div>
            <dt>{copy.firmaSeferNo}</dt>
            <dd>{aiEdit.meta.firmaSeferNo || "—"}</dd>
          </div>
        </dl>
      ) : null}
      <div className="uetds-form-section">
        <h2>{copy.fillFromDocument}</h2>
        <div className="uetds-document-actions">
          <button type="button" className="ops-btn-secondary" onClick={() => fileRef.current?.click()} disabled={extracting}>
            {copy.addFile}
          </button>
          <button type="button" className="ops-btn-secondary" onClick={() => imageRef.current?.click()} disabled={extracting}>
            {copy.addImages}
          </button>
          <button
            type="button"
            className="ops-btn-secondary"
            onClick={() => setPasteOpen((open) => !open)}
            disabled={extracting}
          >
            {copy.pasteText}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(event) => void onDocumentFiles("file", event.target.files)}
        />
        <input
          ref={imageRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          hidden
          onChange={(event) => void onDocumentFiles("images", event.target.files)}
        />
        {selectedFiles.length > 0 ? <ul className="uetds-file-names">
          {selectedFiles.map((file, index) => <li key={`${index}-${file.name}`}>
            {file.name}{" "}
            <button type="button" className="ops-btn-secondary" disabled={extracting}
              aria-label={`${copy.removeSource}: ${file.name}`}
              onClick={() => index < documentFiles.length
                ? setDocumentFiles((files) => files.filter((_, i) => i !== index))
                : setImageFiles((files) => files.filter((_, i) => i !== index - documentFiles.length))}>×</button>
          </li>)}
        </ul> : null}
        {pasteOpen ? (
          <div className="uetds-paste-panel">
            <textarea
              className="uetds-paste"
              maxLength={AI_EXTRACTION_MAX_TEXT}
              value={pasteText}
              disabled={extracting}
              aria-label={copy.pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={copy.pastePlaceholder}
              rows={5}
            />
          </div>
        ) : null}
        <button
          type="button"
          className="ops-btn-primary"
          onClick={() => void onAnalyzeSources()}
          disabled={extracting || (!selectedFiles.length && !pasteText.trim())}
        >
          {extracting ? copy.extracting : copy.extract}
        </button>
        {extractHint ? (
          <p className="uetds-field-hint" role="status">
            {extractHint}
          </p>
        ) : null}
        {conflicts.map((conflict) => (
          <div key={conflict.path} className="uetds-conflict">
            <p>
              {conflict.label}: {conflict.current} / {conflict.incoming}
            </p>
            <div className="uetds-document-actions">
              <button type="button" className="ops-btn-secondary" onClick={() => void resolveConflict(conflict, "current")}>
                {copy.keepCurrent}
              </button>
              <button type="button" className="ops-btn-secondary" onClick={() => void resolveConflict(conflict, "incoming")}>
                {copy.useExtracted}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="uetds-form-section">
        <h2>{copy.tripSection}</h2>
        <div className="uetds-grid">
          <UetdsLocationField
            locale={locale}
            copy={copy}
            label={copy.origin}
            key={`origin-${locationPrefillVersion}`}
            suggestOnMount={locationPrefillVersion > 0}
            fieldId="uetds-origin"
            value={draft.originLocation}
            invalid={missing.includes("origin")}
            onChange={(location) => updateLocation("originLocation", location)}
          />
          <UetdsLocationField
            locale={locale}
            copy={copy}
            label={copy.destination}
            key={`destination-${locationPrefillVersion}`}
            suggestOnMount={locationPrefillVersion > 0}
            fieldId="uetds-destination"
            value={draft.destinationLocation}
            invalid={missing.includes("destination")}
            onChange={(location) => updateLocation("destinationLocation", location)}
          />
          <label data-uetds-field="startDate">
            {copy.startDate}
            <input
              id="uetds-start-date"
              type="date"
              value={draft.startDate}
              onChange={(event) => updateStart({ startDate: event.target.value })}
            />
          </label>
          <label data-uetds-field="startTime">
            {copy.startTime}
            <input
              id="uetds-start-time"
              type="time"
              value={draft.startTime}
              onChange={(event) => updateStart({ startTime: event.target.value })}
            />
          </label>
          <label data-uetds-field="endDate">
            {copy.endDate}
            <input
              id="uetds-end-date"
              type="date"
              min={draft.startDate || undefined}
              value={draft.endDate}
              onChange={(event) => updateEnd({ endDate: event.target.value })}
            />
          </label>
          <label data-uetds-field="endTime">
            {copy.endTime}
            <input
              id="uetds-end-time"
              type="time"
              value={draft.endTime}
              onChange={(event) => updateEnd({ endTime: event.target.value })}
            />
          </label>
          {endBeforeStart && !validation.attempted ? (
            <p className="uetds-span-2 uetds-field-hint" role="alert">
              {copy.endBeforeStart}
            </p>
          ) : null}
          <label>
            {copy.groupName}
            <input value={draft.groupName} onChange={(event) => updateTrip("groupName", event.target.value)} />
          </label>
          <label className="uetds-span-2" data-uetds-field="purpose">
            {copy.purpose}
            <input
              id="uetds-purpose"
              value={draft.purpose}
              onChange={(event) => updateTrip("purpose", event.target.value)}
            />
            <span className="uetds-purpose-chips">
              {(
                [
                  ["transfer", copy.tripTransfer],
                  ["tour", copy.tripTour],
                  ["charter", copy.tripCharter],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  className={purposeChipSelected(kind) ? "uetds-purpose-chip is-selected" : "uetds-purpose-chip"}
                  aria-pressed={purposeChipSelected(kind)}
                  onClick={() => applyPurposeChip(kind)}
                >
                  {label}
                </button>
              ))}
            </span>
          </label>
          <label data-uetds-field="fare">
            {copy.fare}
            <input inputMode="decimal" value={draft.fare} onChange={(event) => updateTrip("fare", event.target.value)} />
          </label>
        </div>
      </div>

      <div className="uetds-form-section">
        <h2 id="uetds-passengers">{copy.passengers}</h2>
        <div className="uetds-passenger-table">
          <div className="uetds-passenger-head">
            <span>{copy.listNo}</span>
            <span>{copy.nationality}</span>
            <span>{copy.identity}</span>
            <span>{copy.firstName}</span>
            <span>{copy.lastName}</span>
            <span>{copy.gender}</span>
            <span />
          </div>
          {draft.passengers.map((passenger, index) => (
            <div key={passenger.key} className="uetds-passenger-row">
              <p className="uetds-passenger-title">{replaceCount(copy.passengerN, index + 1)}</p>
              <span className="uetds-passenger-number" aria-hidden="true">{index + 1}.</span>
              <label data-label={copy.nationality} data-uetds-field={`passenger.${index}.nationality`}>
                <SearchableSelect
                  value={passenger.nationality}
                  options={countryOptions}
                  placeholder={copy.nationality}
                  emptyLabel={copy.missing}
                  onChange={(value) => updatePassenger(index, { nationality: value })}
                />
                <ProvenanceNote value={passenger.provenance.nationality} copy={copy} />
              </label>
              <label data-label={copy.identity} data-uetds-field={`passenger.${index}.identity`}>
                <input
                  value={passenger.identityNumber}
                  placeholder={copy.identity}
                  onChange={(event) => updatePassenger(index, { identityNumber: event.target.value })}
                />
              </label>
              <label data-label={copy.firstName} data-uetds-field={`passenger.${index}.firstName`}>
                <input
                  value={passenger.firstName}
                  placeholder={copy.firstNamePlaceholder}
                  onChange={(event) => updatePassenger(index, { firstName: event.target.value })}
                />
              </label>
              <label data-label={copy.lastName} data-uetds-field={`passenger.${index}.lastName`}>
                <input
                  value={passenger.lastName}
                  placeholder={copy.lastNamePlaceholder}
                  onChange={(event) => updatePassenger(index, { lastName: event.target.value })}
                />
              </label>
              <label data-label={copy.gender} data-uetds-field={`passenger.${index}.gender`}>
                <span className="uetds-gender-toggle" role="group" aria-label={copy.gender}>
                  <button
                    type="button"
                    className={passenger.gender === "female" ? "is-selected" : undefined}
                    aria-pressed={passenger.gender === "female"}
                    onClick={() => updatePassenger(index, { gender: "female" })}
                  >
                    {copy.genderFemale}
                  </button>
                  <span className="uetds-gender-sep" aria-hidden="true">
                    |
                  </span>
                  <button
                    type="button"
                    className={passenger.gender === "male" ? "is-selected" : undefined}
                    aria-pressed={passenger.gender === "male"}
                    onClick={() => updatePassenger(index, { gender: "male" })}
                  >
                    {copy.genderMale}
                  </button>
                </span>
              </label>
              {aiEdit ? null : (
              <UetdsPassengerRemoveButton
                passenger={passenger}
                nationalityLabel={countryOptions.find((country) => country.value === passenger.nationality)?.label ?? passenger.nationality}
                copy={copy}
                onConfirm={() =>
                  setDraft((current) => ({
                    ...current,
                    passengers:
                      current.passengers.length > 1
                        ? current.passengers.filter((item) => item.key !== passenger.key)
                        : [createPassengerDraft()],
                  }))
                }
              />
              )}
            </div>
          ))}
        </div>
        {aiEdit ? null : (
        <button
          type="button"
          className="ops-btn-secondary"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              passengers: [...current.passengers, createPassengerDraft()],
            }))
          }
        >
          {copy.addPassenger}
        </button>
        )}
      </div>

      <div className="uetds-form-section">
        <h2>{copy.driverVehicle}</h2>
        <div className="uetds-grid">
          <label data-uetds-field="driverId">
            {copy.driver}
            <SearchableSelect
              fieldId="uetds-driver"
              value={draft.driverId}
              options={driverOptions}
              placeholder={copy.selectDriver}
              emptyLabel={copy.noDrivers}
              onChange={(value) => {
                const nextDriver = drivers.find((item) => item.id === value);
                const previousDriverId = draft.driverId;
                setAuthorityId((currentAuthority) =>
                  authorityForNotificationForm({
                    previousDriverId,
                    nextDriverId: value,
                    currentAuthorityId: currentAuthority,
                    defaultAuthorityId: nextDriver?.defaultAuthorityId,
                    allowedAuthorityIds: nextDriver ? allowedAuthorityIds(nextDriver, authorities) : [],
                  }),
                );
                setDraft((current) => {
                  const next = applyDriverVehicleDefault(
                    current,
                    value,
                    nextDriver?.defaultVehicleId,
                    vehicles.map((item) => item.id),
                  );
                  if (next === current) {
                    return current;
                  }
                  return {
                    ...next,
                    fieldProvenance: {
                      ...current.fieldProvenance,
                      driverId: markUserEdited(
                        current.fieldProvenance.driverId,
                        next.driverId,
                        current.driverId,
                      ),
                      vehicleId: markUserEdited(
                        current.fieldProvenance.vehicleId,
                        next.vehicleId,
                        current.vehicleId,
                      ),
                    },
                  };
                });
              }}
            />
          </label>
          <label data-uetds-field="vehicleId">
            {copy.vehicle}
            <SearchableSelect
              fieldId="uetds-vehicle"
              value={draft.vehicleId}
              options={vehicleOptions}
              placeholder={copy.selectVehicle}
              emptyLabel={copy.noVehicles}
              onChange={(value) => updateTrip("vehicleId", value)}
            />
          </label>
          <label data-uetds-field="edevletAuthorityId">
            {copy.edevletAuthority}
            <SearchableSelect
              fieldId="uetds-edevlet-authority"
              value={visibleAuthorityId}
              options={authorityOptions}
              placeholder={copy.selectEdevletAuthority}
              emptyLabel={copy.noEdevletAuthorities}
              onChange={setAuthorityId}
            />
            <p className="uetds-field-hint">{copy.edevletAuthorityOptional}</p>
            <span hidden data-edevlet-authority-id={visibleAuthorityId} />
          </label>
        </div>
        {eligibility.ok && eligibility.companyShortName ? (
          <p className="uetds-eligible">{replaceCompany(copy.eligibleVia, eligibility.companyShortName)}</p>
        ) : draft.driverId || draft.vehicleId ? (
          <p className="uetds-notify-reason">{uetdsEligibilityMessage(eligibility.reason, copy)}</p>
        ) : null}
      </div>

      <ul className="uetds-summary">
        <li>
          {["origin", "destination", "startDate", "startTime", "endDate", "endTime", "purpose", "endBeforeStart"].some((key) =>
            blocking.includes(key),
          )
            ? `✕ ${copy.summaryMissing.replace("{n}", "—")}`
            : `✓ ${copy.summaryOkTrip}`}
        </li>
        <li>{eligibility.ok ? `✓ ${copy.summaryOkFleet}` : `✕ ${uetdsEligibilityMessage(eligibility.reason, copy)}`}</li>
        <li>{`✓ ${replaceCount(copy.summaryPassengers, draft.passengers.length)}`}</li>
        {suggested > 0 ? <li>{`⚠ ${replaceCount(copy.summarySuggested, suggested)}`}</li> : null}
        {blocking.length > 0 ? (
          <li>{`✕ ${replaceCount(copy.summaryMissing, blocking.length)}`}</li>
        ) : (
          <li>{`✓ ${copy.summaryOkRequired}`}</li>
        )}
      </ul>

      {visibleFieldErrors.length > 0 ? (
        <div className="ops-form-error" role="alert">
          <p>{copy.fieldErrorsTitle}</p>
          <ul>
            {visibleFieldErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {startAdjustedLabel ? <p className="uetds-form-info" role="status">{startAdjustedLabel}</p> : null}
      {endAdjustedLabel ? <p className="uetds-form-info" role="status">{endAdjustedLabel}</p> : null}

      {state.error ? (
        <p className="ops-form-error" role="alert">
          {state.error === "forbidden"
            ? copy.forbidden
            : state.error === "live-blocked"
              ? copy.liveBlocked
              : state.error === "no-test-credentials"
                ? copy.missingTestCredentials
                : state.error === "no-live-credentials"
                  ? copy.missingLiveCredentials
                  : state.error === "driver-identity"
                    ? copy.missingDriverIdentity
                    : state.error === "subscription"
                      ? actor === "partner"
                        ? copy.reasonSubscriptionPartner
                        : copy.reasonSubscription
                    : state.error === "location" || state.error === "missing"
                      ? copy.fieldErrorsTitle
                      : state.error === "ministry"
                        ? state.ministryMessage ||
                          (ministryEnv === "test" ? copy.ministryFailed : copy.ministryFailedLive)
                        : state.error === "duplicate-reservation"
                          ? copy.duplicateReservation
                          : copy.saveFailed}
        </p>
      ) : null}

      {aiEdit ? (
        <>
          <button
            type="button"
            className="ops-btn-primary"
            data-ai-original-passengers={oldSnapshotRef.current?.passengers.length ?? 0}
            data-ai-change-count={editPlan?.passenger_changes.length ?? 0}
            onClick={() => { void continueAiEdit(); }}
          >
            {copy.aiEditContinue}
          </button>
          {aiContinueHint ? <p className="uetds-field-hint" role="status">{aiContinueHint}</p> : null}
          <AiEditLunaWorkspace
            open={lunaOpen}
            locale={locale}
            notificationId={aiEdit.meta.notificationId}
            authorityId={authorityId}
            nextDraft={lunaDraft}
            onClose={clearEditMemory}
          />
        </>
      ) : (
      <>
      <form ref={formRef} action={action} id="uetds-notification-submit">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="actor" value={actor} />
        <input type="hidden" name="draft" value={JSON.stringify(draft)} />
      </form>
      <button
        type="button"
        className="ops-btn-primary"
        disabled={pending}
        onClick={requestSend}
      >
        {copy.send}
      </button>
      </>
      )}

      {confirmOpen ? (
        <OpsConfirmDialog
          title={copy.confirmTitle}
          pending={pending}
          cancelLabel={copy.confirmNo}
          confirmLabel={copy.confirmYes}
          confirmTone="positive"
          onConfirm={() => { if (validation.validate()) formRef.current?.requestSubmit(); else setConfirmOpen(false); }}
          onClose={() => setConfirmOpen(false)}
        >
          <dl className="uetds-confirm-dl">
            <div>
              <dt>{copy.confirmCompany}</dt>
              <dd>{eligibility.companyShortName}</dd>
            </div>
            <div>
              <dt>{copy.driver}</dt>
              <dd>{selectedDriverLabel}</dd>
            </div>
            <div>
              <dt>{copy.vehicle}</dt>
              <dd>{selectedVehicleLabel}</dd>
            </div>
            <div>
              <dt>{copy.confirmRoute}</dt>
              <dd>
                {draft.originLocation.placeName || draft.origin} → {draft.destinationLocation.placeName || draft.destination}
              </dd>
            </div>
            <div>
              <dt>{copy.confirmWhen}</dt>
              <dd>
                {draft.startDate} {draft.startTime}
              </dd>
            </div>
            <div>
              <dt>{copy.confirmPassengers}</dt>
              <dd>{draft.passengers.length}</dd>
            </div>
          </dl>
          {ministryEnv === "test" ? (
            <p className="uetds-confirm-test-note">{copy.confirmTestPlate}</p>
          ) : ministryEnv === "live" ? (
            <p>{copy.confirmLive}</p>
          ) : null}
        </OpsConfirmDialog>
      ) : null}
    </section>
  );
}
