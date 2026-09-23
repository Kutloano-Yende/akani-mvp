export function SecurityCard({
  title = "Protected by Enterprise Security",
  description = "Your data is encrypted and protected with industry-leading security standards.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="login-security-card flex items-start gap-3 rounded-xl bg-akani-bg p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-akani-navy">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
            stroke="#d6a000"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="m9 12 2 2 4-4"
            stroke="#d6a000"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div>
        <p className="login-heading text-sm font-semibold text-akani-navy">{title}</p>
        <p className="login-subtext mt-0.5 text-xs text-akani-muted">{description}</p>
      </div>
    </div>
  );
}
