/** Shown instead of a blank screen when the app can't start. */
export function StartupError({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-8">
      <h1 className="m-0 font-display text-3xl font-extrabold">{title}</h1>
      <p className="m-0 text-[15px] text-muted">{detail}</p>
    </div>
  );
}
