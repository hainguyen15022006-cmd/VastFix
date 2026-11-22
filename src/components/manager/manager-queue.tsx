"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/shared/icon";
import { fetchManagerIssues, normalizeSearch, QueueError, type IssueStatus, type ManagerIssue, type ManagerIssuesResponse } from "@/lib/manager-issues";

type QueueState = { kind: "loading" } | { kind: "ready"; data: ManagerIssuesResponse } | { kind: "error"; error: QueueError };

export function ManagerQueue() {
  const t = useTranslations("Queue");
  const common = useTranslations("Common");
  const statuses = useTranslations("Status");
  const format = useFormatter();
  const locale = useLocale();
  const status: IssueStatus = "SUBMITTED";
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<QueueState>({ kind: "loading" });
  const [selected, setSelected] = useState<ManagerIssue | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const pageRequest = useRef<AbortController | null>(null);
  const paging = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<QueueError | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    pageRequest.current?.abort();
    paging.current = false;
    setLoadingMore(false);
    setPageError(null);
    let active = true;
    // A finite timeout prevents an indefinitely spinning queue when the network stalls.
    const timeout = setTimeout(() => {
      if (active) { active = false; controller.abort(); setState({ kind: "error", error: new QueueError("unavailable") }); }
    }, 15_000);
    setState({ kind: "loading" });
    setSelected(null);
    fetchManagerIssues(status, controller.signal, { locale }).then((data) => {
      if (active) setState({ kind: "ready", data });
    }).catch((error: unknown) => {
      if (active) setState({ kind: "error", error: error instanceof QueueError ? error : new QueueError("unavailable") });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; generation.current++; clearTimeout(timeout); controller.abort(); pageRequest.current?.abort(); };
  }, [status, locale, revision]);

  async function loadMore() {
    if (state.kind !== "ready" || !state.data.nextCursor || paging.current) return;
    const cursor = state.data.nextCursor;
    const current = generation.current;
    const controller = new AbortController();
    pageRequest.current = controller;
    paging.current = true;
    setLoadingMore(true); setPageError(null);
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const page = await fetchManagerIssues(status, controller.signal, { locale, cursor });
      if (current !== generation.current) return;
      if (page.nextCursor === cursor) throw new QueueError("unavailable", page.requestId);
      setState(previous => {
        if (previous.kind !== "ready") return previous;
        const ids = new Set(previous.data.items.map(item => item.issueId));
        return { kind: "ready", data: { ...page, items: [
          ...previous.data.items, ...page.items.filter(item => !ids.has(item.issueId)),
        ] } };
      });
    } catch (cause) {
      if (current !== generation.current) return;
      const error = cause instanceof QueueError ? cause : new QueueError("unavailable");
      if (error.kind === "unauthenticated" || error.kind === "forbidden") {
        setSelected(null); setState({ kind: "error", error });
      } else setPageError(error);
    } finally {
      clearTimeout(timeout);
      if (current === generation.current) { paging.current = false; setLoadingMore(false); }
    }
  }

  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);

  const items = state.kind === "ready" ? state.data.items : [];
  const query = normalizeSearch(search);
  const visible = items.filter((item) => normalizeSearch(`${item.summary} ${item.locationLabel}`).includes(query));
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
  const errorPrefix = state.kind === "error" ? state.error.kind === "unauthenticated" ? "auth" : state.error.kind === "forbidden" ? "forbidden" : "error" : "error";

  return (
    <>
      <section className="vf-page-heading">
        <div><p className="vf-eyebrow">{t("eyebrow")}</p><h1>{t("title")}</h1><p className="vf-lead">{t("description")}</p></div>
        <button type="button" className="vf-button" disabled={state.kind === "loading"} onClick={() => setRevision((value) => value + 1)}><Icon name="refresh" />{t("refresh")}</button>
      </section>
      <section className="vf-queue" aria-label={t("listTitle")}>
        <div className="vf-filters">
          <div className="vf-field vf-status-filter"><label htmlFor="queue-status">{t("statusFilter")}</label><select id="queue-status" value={status} aria-describedby="queue-status-scope" disabled><option value="SUBMITTED">{statuses("SUBMITTED")}</option></select><span id="queue-status-scope">{t("statusScope")}</span></div>
          <label className="vf-field vf-search"><span>{t("searchLabel")}</span><span className="vf-input-wrap"><Icon name="search" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlaceholder")} /></span></label>
        </div>
        <div aria-live="polite" aria-atomic="true" className="vf-result-line">
          {state.kind === "ready" ? t("results", { visible: visible.length, loaded: items.length }) : state.kind === "loading" ? t("loadingTitle") : t(`${errorPrefix}Title`)}
        </div>
        {state.kind === "loading" && <div className="vf-state" aria-busy="true"><span className="vf-spinner" aria-hidden="true" /><h2>{t("loadingTitle")}</h2><p>{t("loadingDescription")}</p></div>}
        {state.kind === "error" && <div className="vf-state vf-error-state"><span className="vf-state-icon"><Icon name={state.error.kind === "unavailable" ? "inbox" : "shield"} /></span><h2>{t(`${errorPrefix}Title`)}</h2><p>{t(`${errorPrefix}Description`)}</p><button className="vf-button" type="button" onClick={() => setRevision((value) => value + 1)}>{common("retry")}</button>{state.error.requestId && <p className="vf-reference">{common("requestId")}: <code>{state.error.requestId}</code></p>}</div>}
        {state.kind === "ready" && visible.length === 0 && <div className="vf-state"><span className="vf-state-icon"><Icon name={items.length ? "search" : "inbox"} /></span><h2>{t(items.length ? "noMatchesTitle" : "emptyTitle")}</h2><p>{t(items.length ? "noMatchesDescription" : "emptyDescription")}</p>{search && <button className="vf-button" type="button" onClick={() => setSearch("")}>{t("clearSearch")}</button>}</div>}
        {state.kind === "ready" && visible.length > 0 && <div className="vf-table-wrap"><table className="vf-issue-table"><caption className="vf-sr-only">{t("listTitle")}</caption><thead><tr><th scope="col">{t("summary")}</th><th scope="col">{t("location")}</th><th scope="col">{t("status")}</th><th scope="col">{t("createdAt")}</th><th scope="col"><span className="vf-sr-only">{t("actions")}</span></th></tr></thead><tbody>{visible.map((issue) => <tr key={issue.issueId}>
          <td data-label={t("summary")}><p className="vf-issue-summary">{issue.summary}</p><span className="vf-short-id" title={issue.issueId}>#{issue.issueId.slice(0, 8)}</span></td>
          <td data-label={t("location")}><span className="vf-location"><Icon name="pin" />{issue.locationLabel}</span></td>
          <td data-label={t("status")}><span className={`vf-badge vf-badge-${issue.status.toLowerCase()}`}>{statuses(issue.status)}</span></td>
          <td data-label={t("createdAt")}><time dateTime={issue.createdAt}>{date(issue.createdAt)}</time></td>
          <td><button type="button" className="vf-text-button" aria-label={t("viewIssue", { summary: issue.summary })} onClick={() => setSelected(issue)}>{t("view")}<Icon name="arrow" /></button></td>
        </tr>)}</tbody></table></div>}
        {state.kind === "ready" && state.data.nextCursor !== null && <div className="vf-pagination">
          <p className="vf-partial" role="note">{t("partial")}</p>
          {pageError && <p role="alert">{t("pageError")}{pageError.requestId && <> · {common("requestId")}: <code>{pageError.requestId}</code></>}</p>}
          <button type="button" className="vf-button" disabled={loadingMore} onClick={() => void loadMore()}>{t(loadingMore ? "loadingMore" : "loadMore")}</button>
        </div>}
        <div className="vf-queue-footnote"><Icon name="shield" /><span>{t("privacy")}</span></div>
      </section>
      <p className="vf-timezone">{t("timezone")}</p>
      <dialog className="vf-dialog" ref={dialog} aria-labelledby="issue-detail-title" onClose={() => setSelected(null)}>
        <div className="vf-dialog-header"><h2 id="issue-detail-title">{t("detailTitle")}</h2><button type="button" className="vf-icon-button" aria-label={common("close")} onClick={() => setSelected(null)}><Icon name="close" /></button></div>
        {selected && <><p className="vf-detail-summary">{selected.summary}</p><span className={`vf-badge vf-badge-${selected.status.toLowerCase()}`}>{statuses(selected.status)}</span><dl className="vf-detail-list"><dt>{t("location")}</dt><dd>{selected.locationLabel}</dd><dt>{t("createdAt")}</dt><dd>{date(selected.createdAt)}</dd><dt>{t("issueId")}</dt><dd><code>{selected.issueId}</code></dd><dt>{t("reportId")}</dt><dd><code>{selected.originReportId}</code></dd></dl><p className="vf-fine-print">{t("detailNote")}</p></>}
      </dialog>
    </>
  );
}
