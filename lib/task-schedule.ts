export type TaskScheduleBlock = {
  taskId?: string | null;
  duration: number;
  startAt?: string;
};

export function aggregateTaskSchedule(taskId: string, blocks: TaskScheduleBlock[]) {
  const sessions = blocks.filter((block) => block.taskId === taskId);
  return {
    sessionCount: sessions.length,
    totalScheduledMinutes: sessions.reduce((sum, block) => sum + Math.max(0, block.duration), 0),
    scheduledDays: [...new Set(sessions.flatMap((block) => block.startAt
      ? [new Date(block.startAt).toLocaleDateString("en-US", { weekday: "short" })]
      : []))],
  };
}

export function formatScheduledMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}
