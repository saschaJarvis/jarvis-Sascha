export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <img src="/icon.svg" alt="" width={44} height={44} className="rounded-xl" />
        <div>
          <p className="text-2xl font-bold tracking-tight">Jarvis</p>
          <p className="text-sm text-muted">Eins nach dem anderen.</p>
        </div>
      </div>
      {children}
    </main>
  );
}
