const JST_OFFSET_MS = 9 * 3600 * 1000;

/** JSTの壁時計をUTCメソッドで読めるDateを返す */
function jstDate(nowMs: number): Date {
	return new Date(nowMs + JST_OFFSET_MS);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" (JST) */
export function jstDateStr(nowMs: number): string {
	const d = jstDate(nowMs);
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 翌日の "YYYY-MM-DD" (JST) */
export function jstTomorrowStr(nowMs: number): string {
	return jstDateStr(nowMs + 24 * 3600 * 1000);
}

/** JSTの時 (0-23) */
export function jstHour(nowMs: number): number {
	return jstDate(nowMs).getUTCHours();
}

/** JSTの曜日 (0=日 .. 6=土) */
export function jstDow(nowMs: number): number {
	return jstDate(nowMs).getUTCDay();
}

/** "HH:MM" (JST) */
export function jstTimeStr(epochMs: number): string {
	const d = jstDate(epochMs);
	return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** push重複防止キー "YYYY-MM-DD-HH" (JST) */
export function jstPushKey(nowMs: number): string {
	return `${jstDateStr(nowMs)}-${pad(jstHour(nowMs))}`;
}
