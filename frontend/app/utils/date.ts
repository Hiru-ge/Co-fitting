const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatMonth(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function groupByMonth<T>(
  items: T[],
  getDate: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = formatMonth(getDate(item));
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

export function getWeekRange(date: Date): {
  from: string;
  until: string;
  label: string;
} {
  const nowJST = new Date(date.getTime() + JST_OFFSET_MS);
  const dayOfWeek = nowJST.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // 直近月曜 00:00 JST
  const mondayMidnightUTC =
    Date.UTC(
      nowJST.getUTCFullYear(),
      nowJST.getUTCMonth(),
      nowJST.getUTCDate() - daysFromMonday,
    ) - JST_OFFSET_MS;

  const lastMondayMidnightUTC = mondayMidnightUTC - 7 * 24 * 60 * 60 * 1000;
  const from = new Date(lastMondayMidnightUTC).toISOString();
  const until = new Date(mondayMidnightUTC).toISOString();

  const mondayDate = new Date(lastMondayMidnightUTC + JST_OFFSET_MS);
  const sundayDate = new Date(
    lastMondayMidnightUTC + JST_OFFSET_MS + 6 * 24 * 60 * 60 * 1000,
  );
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  const label = `${fmt(mondayDate)}（月）〜 ${fmt(sundayDate)}（日）`;

  return { from, until, label };
}

export function getYearMonthRange(date: Date): {
  from: string;
  until: string;
  label: string;
} {
  const nowJST = new Date(date.getTime() + JST_OFFSET_MS);

  const year = nowJST.getUTCFullYear();
  const month = nowJST.getUTCMonth(); // 0-indexed

  // 先月1日 00:00 JST
  const fromUTC = Date.UTC(year, month - 1, 1) - JST_OFFSET_MS;
  // 今月1日 00:00 JST
  const untilUTC = Date.UTC(year, month, 1) - JST_OFFSET_MS;

  // labelは fromUTC から計算（1月の場合に前年12月を正しく表示するため）
  const fromDate = new Date(fromUTC + JST_OFFSET_MS);
  const label = `${fromDate.getUTCFullYear()}年${fromDate.getUTCMonth() + 1}月`;

  return {
    from: new Date(fromUTC).toISOString(),
    until: new Date(untilUTC).toISOString(),
    label,
  };
}
