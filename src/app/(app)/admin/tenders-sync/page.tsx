import { SyncTendersForm } from "./sync-tenders-form";

export default function TenderSyncPage() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-akani-text-secondary">
        Manually trigger a sync of South African government tenders from National Treasury&apos;s
        eTenders bulk files. This also runs automatically every day via Vercel Cron (05:00 UTC) --
        use this page to backfill a specific month or re-run one on demand.
      </p>
      <SyncTendersForm />
    </div>
  );
}
