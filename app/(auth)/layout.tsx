export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <div className="flex items-center gap-2 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="DTAN Learn" className="h-9 w-auto" />
        <span className="text-2xl font-semibold tracking-tight">DTAN Learn</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
