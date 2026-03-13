export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col safe-area-top safe-area-bottom">
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
