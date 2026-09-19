import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-lg font-bold text-white">
            A
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Sign in to Akani</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sales intelligence for B-BBEE prospecting
          </p>
        </div>
        <LoginForm next={next ?? "/dashboard"} />
      </div>
    </div>
  );
}
