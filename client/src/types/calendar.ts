export type CalendarFeedType = "personal_due_dates" | "manager_due_dates";

export interface CalendarFeedSummary {
  type: CalendarFeedType;
  url: string;
  createdAt: string;
}

export interface CalendarFeedsResponse {
  personal: CalendarFeedSummary;
  manager: CalendarFeedSummary | null;
}
