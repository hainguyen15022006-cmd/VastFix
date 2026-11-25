"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProtectedPhotoViewer } from "@/components/shared/protected-photo-viewer";
import { DetailError, fetchManagerDetail, type ManagerDetail } from "@/lib/manager-workflow";

type ViewState = { kind: "loading" } | { kind: "error"; error: DetailError } | { kind: "ready"; issue: ManagerDetail };
type Tab = "report" | "handling" | "photos" | "history" | "merges";

export function ManagerIssueDetail({ id }: { id: string }) {
  const t = useTranslations("ManagerDetail");
  const statusText = useTranslations("Status");
  const locale = useLocale();
  const format = useFormatter();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("report");
  const [categoryCode, setCategoryCode] = useState("");
  const [priority, setPriority] = useState("P1");
  const [dueAt, setDueAt] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetchManagerDetail(id, locale, controller.signal).then(issue => {
      if (controller.signal.aborted) return;
      setState({ kind: "ready", issue });
      setCategoryCode(issue.categoryCode ?? "");
      setPriority(issue.priority ?? "P1");
      setDueAt(issue.dueAt ? new Date(new Date(issue.dueAt).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16) : "");
      setAssigneeId(issue.assigneeId ?? "");
    }).catch(error => { if (!controller.signal.aborted) setState({ kind: "error", error: error instanceof DetailError ? error : new DetailError("unavailable") }); });
    return () => controller.abort();
  }, [id, locale, revision]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/manager/staff", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(body => { if (!controller.signal.aborted && Array.isArray(body?.items)) setStaff(body.items.filter((item: unknown): item is { id: string; name: string } => !!item && typeof item === "object" && "id" in item && "name" in item && typeof item.id === "string" && typeof item.name === "string")); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const date = (value: string | null) => value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }) : t("none");
  const issue = state.kind === "ready" ? state.issue : null;
  const tabs: Tab[] = ["report", "handling", "photos", "history", "merges"];
  const action = issue?.mergedIntoIssueId ? "merged" : issue?.reviewRequired ? "review" : issue?.status === "SUBMITTED" ? "triage" : issue?.status === "TRIAGED" ? "assign" : issue?.status === "AWAITING_REVIEW" ? "reviewWork" : issue?.status === "CLOSED" ? "reopen" : "readOnly";

  return <div className="vf-workflow">
    <Link href="/manager/issues" className="vf-text-button">← {t("back")}</Link>
    <section className="vf-page-heading"><div><p className="vf-eyebrow">{t("eyebrow")}</p><h1>{t("title")}</h1><p className="vf-reference">{id}</p></div><button className="vf-button" type="button" onClick={() => setRevision(n => n + 1)}>{t("refresh")}</button></section>
    {state.kind === "loading" && <div className="vf-state" aria-busy="true" role="status"><span className="vf-spinner" aria-hidden="true" />{t("loading")}</div>}
    {state.kind === "error" && <div className="vf-state vf-error-state" role="alert"><h2>{t(`error_${state.error.kind}`)}</h2><p>{t("errorHelp")}</p>{state.error.requestId && <code>{state.error.requestId}</code>}<button className="vf-button" type="button" onClick={() => setRevision(n => n + 1)}>{t("retry")}</button></div>}
    {issue && <>
      <div className="vf-workflow-summary"><span className={`vf-badge vf-badge-${issue.status.toLowerCase()}`}>{statusText(issue.status)}</span><span>{t("version", { version: issue.version })}</span><span>{t("created")}: {date(issue.createdAt)}</span></div>
      {issue.reviewRequired && <p className="vf-workflow-alert" role="note">{t("reviewRequired")}</p>}
      {issue.mergedIntoIssueId && <p className="vf-workflow-alert" role="note">{t("mergedInto")}: <Link href={`/manager/issues/${issue.mergedIntoIssueId}`}>{issue.mergedIntoIssueId}</Link></p>}
      <nav className="vf-workflow-tabs" aria-label={t("sections")}>{tabs.map(value => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>{t(`tab_${value}`)}</button>)}</nav>
      {tab === "report" && <section className="vf-workflow-panel"><h2>{t("tab_report")}</h2>{issue.reports.length === 0 ? <p>{t("empty")}</p> : issue.reports.map((report, index) => <article key={report.reportId} className="vf-workflow-record"><h3>{index === 0 ? t("originalReport") : t("relatedReport")}</h3><p className="vf-detail-summary">{report.description}</p><dl><dt>{t("location")}</dt><dd>{report.locationLabel}</dd><dt>{t("submitted")}</dt><dd>{date(report.submittedAt)}</dd><dt>{t("reportId")}</dt><dd><code>{report.reportId}</code></dd></dl></article>)}</section>}
      {tab === "handling" && <section className="vf-workflow-panel"><h2>{t("tab_handling")}</h2><dl className="vf-workflow-facts"><dt>{t("category")}</dt><dd>{issue.categoryCode ?? t("none")}</dd><dt>{t("priority")}</dt><dd>{issue.priority ?? t("none")}</dd><dt>{t("dueAt")}</dt><dd>{date(issue.dueAt)}</dd><dt>{t("assignee")}</dt><dd>{issue.assignee?.name ?? t("none")}</dd><dt>{t("closedAt")}</dt><dd>{date(issue.closedAt)}</dd></dl><h3>{t("draftTitle")}</h3><p className="vf-fine-print">{t("draftHelp")}</p><div className="vf-workflow-fields"><label>{t("category")}<input value={categoryCode} onChange={e => setCategoryCode(e.target.value)} /></label><label>{t("priority")}<select value={priority} onChange={e => setPriority(e.target.value)}>{["P0","P1","P2"].map(value => <option key={value}>{value}</option>)}</select></label><label>{t("dueAt")}<input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} /></label><label>{t("assignee")}<select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}><option value="">{t("none")}</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div><p className="vf-workflow-alert">{t(`action_${action}`)}</p><button type="button" className="vf-button" disabled>{t("saveUnavailable")}</button></section>}
      {tab === "photos" && <section className="vf-workflow-panel"><h2>{t("tab_photos")}</h2>{issue.reports.flatMap(report => report.photos.map(photo => <ProtectedPhotoViewer key={photo.photoId} photo={photo} alt={t("reportPhoto")} loading={t("photoLoading")} unavailable={t("photoUnavailable")} />))}{issue.history.flatMap(event => event.evidencePhotos.map(photo => <ProtectedPhotoViewer key={photo.photoId} photo={photo} alt={t("evidencePhoto")} loading={t("photoLoading")} unavailable={t("photoUnavailable")} />))}{issue.reports.every(report => !report.photos.length) && issue.history.every(event => !event.evidencePhotos.length) && <p>{t("emptyPhotos")}</p>}</section>}
      {tab === "history" && <section className="vf-workflow-panel"><h2>{t("tab_history")}</h2>{issue.history.length ? <ol className="vf-workflow-history">{issue.history.map(event => <li key={event.id}><strong>{event.eventType}</strong><time dateTime={event.occurredAt}>{date(event.occurredAt)}</time><dl>{Object.entries(event.details).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value ?? t("none")}</dd></div>)}</dl></li>)}</ol> : <p>{t("empty")}</p>}</section>}
      {tab === "merges" && <section className="vf-workflow-panel"><h2>{t("tab_merges")}</h2><p>{issue.mergedIntoIssueId ? t("mergedInto") : t("relatedCount", { count: Math.max(0, issue.reports.length - 1) })}</p>{issue.reports.slice(1).map(report => <p key={report.issueId}><Link href={`/manager/issues/${report.issueId}`}>{report.issueId}</Link> — {report.description}</p>)}</section>}
    </>}
  </div>;
}
