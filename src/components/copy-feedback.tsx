type Props = {
  message: string | null;
};

export const CopyFeedback = ({ message }: Props) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 px-5 py-2.5 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-sm font-medium animate-pulse shadow-lg">
      {message}
    </div>
  );
};
