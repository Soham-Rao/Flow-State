import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { SettingsPageHeader, SettingsPanel, StateNotice, ListRow, templateInputClass } from "@/components/ui/templates";
import { createBugReport, getBugReportSummary, listAdminBugReports, listMyBugReports, updateBugReportStatus } from "@/lib/bug-reports-api";
import { useAuthStore } from "@/stores/auth-store";
import type { BugReportStatus, BugReportSummary } from "@/types/bug-report";

const ADMIN_FILTERS: Array<BugReportStatus | "all"> = ["all", "open", "triaged", "closed"];

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function getReporterLabel(report: BugReportSummary): string {
  return report.reporter.displayName || report.reporter.username || report.reporter.name || report.reporter.email;
}

export function AdvancedSettingsPage(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const location = useLocation();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done">("idle");

  const [myReports, setMyReports] = useState<BugReportSummary[]>([]);
  const [myReportsStatus, setMyReportsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [myReportsError, setMyReportsError] = useState<string | null>(null);

  const [adminReports, setAdminReports] = useState<BugReportSummary[]>([]);
  const [adminFilter, setAdminFilter] = useState<BugReportStatus | "all">("open");
  const [adminStatus, setAdminStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState<number | null>(null);

  const reportPath = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);

  const loadMine = async (): Promise<void> => {
    setMyReportsStatus("loading");
    setMyReportsError(null);
    try {
      const [mine, summary] = await Promise.all([listMyBugReports(), getBugReportSummary()]);
      setMyReports(mine);
      setOpenCount(summary.openCount);
      setMyReportsStatus("ready");
    } catch (error) {
      setMyReportsStatus("error");
      setMyReportsError(error instanceof Error ? error.message : "Failed to load your bug reports.");
    }
  };

  const loadAdmin = async (): Promise<void> => {
    if (!isAdmin) return;
    setAdminStatus("loading");
    setAdminError(null);
    try {
      const response = await listAdminBugReports(adminFilter);
      setAdminReports(response.items);
      setOpenCount(response.openCount);
      setAdminStatus("ready");
    } catch (error) {
      setAdminStatus("error");
      setAdminError(error instanceof Error ? error.message : "Failed to load team bug reports.");
    }
  };

  useEffect(() => {
    void loadMine();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void loadAdmin();
  }, [isAdmin, adminFilter]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (title.trim().length < 4) {
      setFormError("Please add a short title with at least 4 characters.");
      return;
    }

    if (message.trim().length < 10) {
      setFormError("Please describe the bug in at least 10 characters.");
      return;
    }

    setFormError(null);
    setSubmitState("submitting");

    try {
      await createBugReport({
        title: title.trim(),
        message: message.trim(),
        pagePath: reportPath
      });
      setTitle("");
      setMessage("");
      setSubmitState("done");
      await loadMine();
      if (isAdmin) {
        await loadAdmin();
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to submit bug report.");
      setSubmitState("idle");
      return;
    }

    window.setTimeout(() => {
      setSubmitState("idle");
    }, 1500);
  };

  const onStatusChange = async (reportId: string, status: BugReportStatus): Promise<void> => {
    try {
      await updateBugReportStatus(reportId, status);
      await Promise.all([loadMine(), loadAdmin()]);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Failed to update bug report status.");
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Advanced settings"
        helper="Bug reporting and operational review tools live here until SMTP-backed support workflows arrive."
        actions={isAdmin && openCount !== null ? (
          <div className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            {openCount} open reports
          </div>
        ) : undefined}
      />

      <SettingsPanel
        title="Report a bug"
        description="Send a lightweight issue report directly into FlowState so it can be reviewed before email support is available."
        helper={`Current page: ${reportPath}`}
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            className={templateInputClass}
            placeholder="Short issue title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (formError) setFormError(null);
            }}
            maxLength={200}
          />
          <textarea
            className={`${templateInputClass} min-h-[140px]`}
            placeholder="What happened, what you expected, and how to reproduce it."
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (formError) setFormError(null);
            }}
            maxLength={4000}
          />

          {formError && <StateNotice tone="error" title="Could not submit bug report" description={formError} />}
          {submitState === "done" && <StateNotice title="Bug report sent" description="Your report is now visible in the internal bug inbox." />}

          <div className="flex items-center justify-end">
            <Button type="submit" disabled={submitState === "submitting"} className="gap-2">
              <Send className="h-4 w-4" />
              {submitState === "submitting" ? "Sending..." : "Send report"}
            </Button>
          </div>
        </form>
      </SettingsPanel>

      <SettingsPanel
        title="Your recent reports"
        description="Review your own recently submitted bug reports and their current status."
      >
        {myReportsStatus === "loading" ? (
          <StateNotice tone="loading" title="Loading your reports" description="Pulling the latest items from the bug inbox." />
        ) : myReportsStatus === "error" ? (
          <StateNotice tone="error" title="Unable to load your reports" description={myReportsError ?? undefined} />
        ) : myReports.length === 0 ? (
          <StateNotice title="No reports yet" description="Once you send a bug report, it will appear here with its current status." />
        ) : (
          <div className="space-y-3">
            {myReports.map((report) => (
              <ListRow
                key={report.id}
                title={report.title}
                subtitle={`${report.status.toUpperCase()} • ${formatTimestamp(report.createdAt)}`}
                description={report.message}
                leading={report.status === "closed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                className="items-start"
              />
            ))}
          </div>
        )}
      </SettingsPanel>

      {isAdmin && (
        <SettingsPanel
          title="Team bug inbox"
          description="Review reports from all signed-in users and triage them without leaving FlowState."
          actions={
            <div className="flex flex-wrap gap-2">
              {ADMIN_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  variant={adminFilter === filter ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setAdminFilter(filter)}
                >
                  {filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
          }
        >
          {adminStatus === "loading" ? (
            <StateNotice tone="loading" title="Loading team reports" description="Refreshing the internal bug inbox." />
          ) : adminStatus === "error" ? (
            <StateNotice tone="error" title="Unable to load team reports" description={adminError ?? undefined} />
          ) : adminReports.length === 0 ? (
            <StateNotice title="No reports in this view" description="Change the filter or wait for new reports to arrive." />
          ) : (
            <div className="space-y-3">
              {adminReports.map((report) => (
                <div key={report.id} className="rounded-xl border border-border/60 bg-card/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{report.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {getReporterLabel(report)} • {report.reporter.role} • {formatTimestamp(report.createdAt)}
                      </p>
                      {report.pagePath && (
                        <p className="text-xs text-muted-foreground">Page: {report.pagePath}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["open", "triaged", "closed"] as BugReportStatus[]).map((status) => (
                        <Button
                          key={status}
                          type="button"
                          size="sm"
                          variant={report.status === status ? "default" : "secondary"}
                          onClick={() => {
                            void onStatusChange(report.id, status);
                          }}
                        >
                          {status[0].toUpperCase() + status.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{report.message}</p>
                </div>
              ))}
            </div>
          )}
        </SettingsPanel>
      )}

      {!isAdmin && (
        <SettingsPanel
          title="Support workflow"
          description="Email-backed support and notifications are planned for a later phase."
        >
          <StateNotice
            title="In-app bug reports are active"
            description="Use the report form above for product issues until SMTP-backed support and alerts are configured."
          />
        </SettingsPanel>
      )}
    </div>
  );
}

