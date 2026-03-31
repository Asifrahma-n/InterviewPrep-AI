export default function FeedbackLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="h-9 w-48 animate-pulse rounded bg-dark-300" />
      <div className="h-32 animate-pulse rounded-2xl bg-dark-200" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl bg-dark-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-dark-200" />
      </div>
    </div>
  );
}
