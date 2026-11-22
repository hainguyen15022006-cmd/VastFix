"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/shared/icon";
import { getReportOptions, getSuggestions, submitReport, ReportApiError,
  type Named, type Receipt, type ReportInput, type ReportOptions, type Suggestions } from "@/lib/reporter-api";

type Draft = { description: string; kind: "INDOOR" | "OUTDOOR"; buildingId: string; floorId: string; areaId: string;
  detail: string; category: string; latitude: string; longitude: string };
const emptyDraft: Draft = { description: "", kind: "INDOOR", buildingId: "", floorId: "", areaId: "", detail: "", category: "", latitude: "", longitude: "" };
type HintState = { kind: "idle" | "loading" } | { kind: "ready"; data: Suggestions } | { kind: "error"; error: ReportApiError };
const failure = (error: unknown) => error instanceof ReportApiError ? error : new ReportApiError("NETWORK_ERROR");

export function ReportForm() {
  const t = useTranslations("Report");
  const common = useTranslations("Common");
  const reasons = useTranslations("DuplicateReasons");
  const locale = useLocale();
  const formatter = useFormatter();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [catalogError, setCatalogError] = useState<ReportApiError | null>(null);
  const [reload, setReload] = useState(0);
  const [hints, setHints] = useState<HintState>({ kind: "idle" });
  const [submitError, setSubmitError] = useState<ReportApiError | null>(null);
  const [validation, setValidation] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const hintRequest = useRef<AbortController | null>(null);
  const submitRequest = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const generation = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const name = (entry: Named) => locale === "en" ? entry.nameEn : entry.nameVi;
  const floors = options?.buildings.find(b => b.id === draft.buildingId)?.floors ?? [];
  const areas = floors.find(f => f.id === draft.floorId)?.areas ?? [];

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    setCatalogError(null);
    getReportOptions(controller.signal).then(data => { if (active) setOptions(data); })
      .catch(error => { if (active) setCatalogError(failure(error)); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [reload]);

  useEffect(() => () => { hintRequest.current?.abort(); submitRequest.current?.abort(); }, []);
  useEffect(() => { if (receipt) successHeading.current?.focus(); }, [receipt]);

  function change(patch: Partial<Draft>) {
    generation.current++;
    hintRequest.current?.abort();
    setHints({ kind: "idle" });
    setValidation("");
    // Preserve an uncertain submission warning until an explicit new attempt.
    setDraft(old => ({ ...old, ...patch }));
  }

  function payload(): ReportInput | null {
    const invalidCoordinate = form.current?.querySelector<HTMLInputElement>('.vf-coordinate-details input:invalid');
    if (invalidCoordinate) {
      const details = invalidCoordinate.closest("details");
      if (details) details.open = true;
    }
    if (!form.current?.reportValidity()) return null;
    if (!draft.description.trim()) {
      setValidation(t("descriptionRequired"));
      form.current.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      return null;
    }
    if (draft.kind === "OUTDOOR" && !draft.detail.trim()) {
      setValidation(t("detailRequired"));
      form.current.querySelector<HTMLInputElement>("#location-detail")?.focus();
      return null;
    }
    const lat = draft.latitude.trim(), lon = draft.longitude.trim();
    if (draft.kind === "OUTDOOR" && (Boolean(lat) !== Boolean(lon))) {
      setValidation(t("coordinatePair"));
      form.current.querySelector<HTMLInputElement>(lat ? "#longitude" : "#latitude")?.focus();
      return null;
    }
    setValidation("");
    return {
      description: draft.description,
      ...(draft.category ? { proposedCategoryCode: draft.category } : {}),
      location: draft.kind === "INDOOR"
        ? { kind: "INDOOR", buildingId: draft.buildingId, floorId: draft.floorId, areaId: draft.areaId, detail: draft.detail }
        : { kind: "OUTDOOR", detail: draft.detail, ...(lat && lon ? { latitude: Number(lat), longitude: Number(lon) } : {}) },
    };
  }

  async function suggest() {
    const input = payload();
    if (!input || submitting.current || !options) return;
    hintRequest.current?.abort();
    const controller = new AbortController();
    hintRequest.current = controller;
    const current = ++generation.current;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    setHints({ kind: "loading" });
    try {
      const data = await getSuggestions(input, controller.signal, locale);
      if (current === generation.current) setHints({ kind: "ready", data });
    } catch (error) {
      if (current === generation.current) setHints({ kind: "error", error: failure(error) });
    } finally { clearTimeout(timeout); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !options) return;
    const input = payload();
    if (!input) return;
    submitting.current = true;
    setBusy(true); setSubmitError(null);
    generation.current++; hintRequest.current?.abort(); setHints({ kind: "idle" });
    const controller = new AbortController();
    submitRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try { setReceipt(await submitReport(input, controller.signal)); }
    catch (error) { setSubmitError(failure(error)); }
    finally { clearTimeout(timeout); submitting.current = false; setBusy(false); }
  }

  function errorMessage(error: ReportApiError, sending = false) {
    if (error.code === "UNAUTHENTICATED") return t("authError");
    if (error.code === "FORBIDDEN") return t("forbiddenError");
    if (error.code === "INVALID_LOCATION") return t("locationError");
    if (error.code === "INVALID_CATEGORY") return t("categoryError");
    if (error.code === "VALIDATION_ERROR" || error.code === "BAD_REQUEST") return t("validationError");
    return t(sending ? "uncertainError" : "loadError");
  }

  function errorPanel(error: ReportApiError, sending = false) {
    return <div className="vf-report-notice vf-report-error" role="alert">
      <p>{errorMessage(error, sending)}</p>
      {(error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN") && <a href="/login" target="_blank" rel="noreferrer">{t("loginTab")}</a>}
      {error.requestId && <p className="vf-fine-print">{common("requestId")}: <code>{error.requestId}</code></p>}
    </div>;
  }

  if (receipt) return <section className="vf-report-success">
    <span className="vf-icon-tile"><Icon name="shield" /></span>
    <p className="vf-eyebrow">{t("successEyebrow")}</p>
    <h1 ref={successHeading} tabIndex={-1}>{t("successTitle")}</h1>
    <p className="vf-lead">{t("successBody")}</p>
    <span className="vf-badge vf-badge-submitted">{t("submitted")}</span>
    <dl className="vf-report-receipt">
      <dt>{t("reportId")}</dt><dd><code>{receipt.report.id}</code></dd>
      <dt>{t("issueId")}</dt><dd><code>{receipt.issue.id}</code></dd>
      <dt>{t("submittedAt")}</dt><dd>{formatter.dateTime(new Date(receipt.report.submittedAt), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" })}</dd>
    </dl>
    <div className="vf-report-actions"><button type="button" className="vf-button vf-primary" onClick={() => {
      setReceipt(null); setDraft(emptyDraft); setHints({ kind: "idle" }); setSubmitError(null); setValidation("");
    }}>{t("another")}</button><Link className="vf-button" href="/">{common("home")}</Link></div>
  </section>;

  return <>
    <section className="vf-page-heading"><div><p className="vf-eyebrow">{t("eyebrow")}</p><h1>{t("title")}</h1><p className="vf-lead">{t("intro")}</p></div></section>
    {!options && !catalogError && <p role="status" className="vf-report-notice">{t("loading")}</p>}
    {catalogError && <div className="vf-report-catalog-error">{errorPanel(catalogError)}<button className="vf-button" type="button" onClick={() => setReload(n => n + 1)}>{t("reloadOptions")}</button></div>}
    <div className="vf-report-grid">
      <form ref={form} className="vf-report-form" noValidate onSubmit={submit}>
        <fieldset disabled={busy || !options} className="vf-report-fields">
          <section className="vf-report-section">
            <h2>{t("whatTitle")}</h2><p className="vf-report-help">{t("whatHelp")}</p>
            <label className="vf-field" htmlFor="description"><span>{t("description")}</span></label>
            <textarea id="description" name="description" required maxLength={5000} rows={5} value={draft.description} placeholder={t("descriptionPlaceholder")}
              aria-describedby="description-help description-count" onChange={e => change({ description: e.target.value })} />
            <div className="vf-report-caption"><p id="description-help">{t("descriptionHelp")}</p><span id="description-count">{draft.description.length}/5000</span></div>
            <label className="vf-field"><span>{t("category")}</span><select value={draft.category} onChange={e => change({ category: e.target.value })}>
              <option value="">{t("categoryUnknown")}</option>{options?.categories.map(c => <option key={c.code} value={c.code}>{name(c)}</option>)}
            </select></label>
          </section>
          <section className="vf-report-section">
            <h2>{t("whereTitle")}</h2><p className="vf-report-help">{t("whereHelp")}</p>
            <fieldset className="vf-location-kind"><legend>{t("locationKind")}</legend>
              {(["INDOOR", "OUTDOOR"] as const).map(kind => <label key={kind} className={draft.kind === kind ? "vf-kind-selected" : ""}>
                <input type="radio" name="kind" value={kind} checked={draft.kind === kind} onChange={() => change({ kind, detail: "", latitude: "", longitude: "" })} /><Icon name="pin" />{t(kind === "INDOOR" ? "indoor" : "outdoor")}
              </label>)}
            </fieldset>
            {draft.kind === "INDOOR" && <>
              {options?.buildings.length === 0 && <p className="vf-report-notice">{t("noBuildings")}</p>}
              <div className="vf-location-selects">
                <label className="vf-field"><span>{t("building")}</span><select required value={draft.buildingId} onChange={e => change({ buildingId: e.target.value, floorId: "", areaId: "" })}>
                  <option value="">{t("chooseBuilding")}</option>{options?.buildings.map(b => <option key={b.id} value={b.id}>{name(b)}</option>)}
                </select></label>
                <label className="vf-field"><span>{t("floor")}</span><select required disabled={!draft.buildingId} value={draft.floorId} onChange={e => change({ floorId: e.target.value, areaId: "" })}>
                  <option value="">{t("chooseFloor")}</option>{floors.map(f => <option key={f.id} value={f.id}>{name(f)}</option>)}
                </select></label>
                <label className="vf-field"><span>{t("area")}</span><select required disabled={!draft.floorId} value={draft.areaId} onChange={e => change({ areaId: e.target.value })}>
                  <option value="">{t("chooseArea")}</option>{areas.map(a => <option key={a.id} value={a.id}>{name(a)}</option>)}
                </select></label>
              </div>
            </>}
            <label className="vf-field"><span>{t(draft.kind === "INDOOR" ? "indoorDetail" : "outdoorDetail")}</span><input id="location-detail" value={draft.detail} required={draft.kind === "OUTDOOR"} placeholder={t(draft.kind === "INDOOR" ? "indoorPlaceholder" : "outdoorPlaceholder")} onChange={e => change({ detail: e.target.value })} /></label>
            {draft.kind === "OUTDOOR" && <details className="vf-coordinate-details"><summary>{t("coordinates")}</summary><p className="vf-report-help">{t("coordinateHelp")}</p><div className="vf-coordinate-grid">
              <label className="vf-field"><span>{t("latitude")}</span><input id="latitude" type="number" min={-90} max={90} step="any" value={draft.latitude} onChange={e => change({ latitude: e.target.value })} /></label>
              <label className="vf-field"><span>{t("longitude")}</span><input id="longitude" type="number" min={-180} max={180} step="any" value={draft.longitude} onChange={e => change({ longitude: e.target.value })} /></label>
            </div></details>}
          </section>
        </fieldset>
        {validation && <p role="alert" className="vf-report-notice vf-report-error">{validation}</p>}
        {submitError && errorPanel(submitError, true)}
        <div className="vf-report-submit"><p>{t("submitHelp")}</p><button type="submit" className="vf-button vf-primary" disabled={busy || !options}>{busy ? t("sending") : t("submit")}</button></div>
      </form>
      <aside className="vf-report-aside" aria-label={t("suggestionsTitle")}>
        <section className="vf-suggestion-panel">
          <span className="vf-icon-tile"><Icon name="search" /></span><h2>{t("suggestionsTitle")}</h2><p className="vf-report-help">{t("suggestionsHelp")}</p>
          <button type="button" className="vf-button" disabled={busy || !options || hints.kind === "loading"} onClick={() => void suggest()}>{hints.kind === "loading" ? t("checking") : t("check")}</button>
          <div aria-live="polite" aria-busy={hints.kind === "loading"}>
            {hints.kind === "idle" && <p className="vf-hint-placeholder">{t("suggestionsIdle")}</p>}
            {hints.kind === "loading" && <p className="vf-report-notice">{t("checkingHelp")}</p>}
            {hints.kind === "error" && <div className="vf-report-notice"><p>{hints.error.code === "UNAUTHENTICATED" || hints.error.code === "FORBIDDEN" ? errorMessage(hints.error) : t("unavailable")}</p>{hints.error.requestId && <p className="vf-fine-print">{common("requestId")}: {hints.error.requestId}</p>}</div>}
            {hints.kind === "ready" && (hints.data.aiStatus === "unavailable"
              ? <p className="vf-report-notice">{t("unavailable")}</p>
              : hints.data.suggestions.length === 0 ? <p className="vf-report-notice">{t("noSuggestions")}</p>
              : <><p className="vf-suggestion-count">{t("suggestionCount", { count: hints.data.suggestions.length })}</p><ul className="vf-suggestion-list">{hints.data.suggestions.map(item => <li key={item.reportId}>
                <h3>{item.summary}</h3><p className="vf-suggestion-location"><Icon name="pin" />{item.locationLabel}</p>
                <time dateTime={item.createdAt}>{formatter.dateTime(new Date(item.createdAt), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" })}</time>
                <ul className="vf-reason-list">{[...new Set(item.reasonCodes)].map(code => <li key={code}>{reasons(code)}</li>)}</ul>
              </li>)}</ul><p className="vf-report-help">{t("suggestionNote")}</p></>)}
          </div>
        </section>
        <section className="vf-report-tip"><Icon name="shield" /><div><h2>{t("privacyTitle")}</h2><p>{t("privacyBody")}</p></div></section>
      </aside>
    </div>
  </>;
}
