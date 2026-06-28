export type BroadcastDateSortDirection = 'asc' | 'desc';

export function sortBroadcastsByDate<T extends { created_at: string }>(
  broadcasts: T[],
  direction: BroadcastDateSortDirection = 'desc'
) {
  return [...broadcasts].sort((left, right) => {
    const leftDate = new Date(left.created_at).getTime();
    const rightDate = new Date(right.created_at).getTime();
    return direction === 'asc' ? leftDate - rightDate : rightDate - leftDate;
  });
}
