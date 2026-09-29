import { PendingSubmitButton } from "@/components/pending-submit-button";

export function PermissionButton({
  value,
  label,
  emphasized,
}: {
  value: "yes" | "no";
  label: string;
  emphasized: boolean;
}) {
  return (
    <PendingSubmitButton
      name="answer"
      value={value}
      className={
        emphasized
          ? "rounded-md bg-akani-gold px-5 py-2.5 text-sm font-semibold text-akani-navy hover:bg-akani-gold-bright"
          : "rounded-md border-2 border-akani-navy px-5 py-2.5 text-sm font-semibold text-akani-navy hover:bg-akani-page-bg"
      }
    >
      {label}
    </PendingSubmitButton>
  );
}
