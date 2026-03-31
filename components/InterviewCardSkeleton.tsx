export function InterviewCardSkeleton() {
  return (
    <div className="card-border w-[360px] max-sm:w-full min-h-96 animate-pulse">
      <div className="card-interview">
        <div>
          <div className="absolute top-0 right-0 h-8 w-20 rounded-bl-lg bg-dark-300" />
          <div className="size-[90px] rounded-full bg-dark-300" />
          <div className="mt-5 h-6 w-40 rounded bg-dark-300" />
          <div className="mt-3 flex gap-5">
            <div className="h-5 w-24 rounded bg-dark-300" />
            <div className="h-5 w-14 rounded bg-dark-300" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="h-4 w-full rounded bg-dark-300" />
            <div className="h-4 w-3/4 rounded bg-dark-300" />
          </div>
        </div>
        <div className="flex justify-between pt-4">
          <div className="flex gap-2">
            <div className="size-9 rounded-full bg-dark-300" />
            <div className="size-9 rounded-full bg-dark-300" />
            <div className="size-9 rounded-full bg-dark-300" />
          </div>
          <div className="h-9 w-28 rounded-md bg-dark-300" />
        </div>
      </div>
    </div>
  );
}
