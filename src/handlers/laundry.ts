import type { Config } from '../config';
import type { GroupState } from '../types';
import { jstTimeStr } from '../time';
import { pick, pickNag } from '../messages';

const MIN = 60 * 1000;

/** 「洗濯」タイマー開始 */
export function handleLaundryStart(state: GroupState, cfg: Config, nowMs: number): string {
	if (state.laundry) return pick('LAUNDRY_ALREADY');
	state.laundry = { startedAt: nowMs, almostNotified: false, doneNotified: false, lastNagAt: null, nagCount: 0 };
	return pick('LAUNDRY_START', { time: jstTimeStr(nowMs + cfg.laundryDurationMin * MIN) });
}

/** 洗濯タイマーの削除(誤登録時) */
export function cancelLaundry(state: GroupState): string {
	if (!state.laundry) return pick('CANCEL_NOTHING');
	state.laundry = null;
	return pick('CANCEL_LAUNDRY_OK');
}

/** 「干した」 */
export function handleLaundryHung(state: GroupState): string {
	if (!state.laundry) return pick('LAUNDRY_NOT_RUNNING');
	state.laundry = null;
	return pick('LAUNDRY_HUNG_PRAISE');
}

/** Cron: 設計書§5.2 */
export function cronLaundry(state: GroupState, cfg: Config, nowMs: number): string[] {
	const l = state.laundry;
	if (!l) return [];
	const out: string[] = [];
	const elapsed = nowMs - l.startedAt;
	const doneAfter = cfg.laundryDurationMin * MIN;
	const almostAfter = doneAfter - 10 * MIN;

	if (!l.doneNotified && elapsed >= doneAfter) {
		// +40分と+50分が同一実行で両方期限到来した場合は完了通知のみ
		l.almostNotified = true;
		l.doneNotified = true;
		l.lastNagAt = nowMs;
		out.push(pick('LAUNDRY_DONE'));
		return out;
	}
	if (!l.almostNotified && elapsed >= almostAfter) {
		l.almostNotified = true;
		out.push(pick('LAUNDRY_ALMOST'));
		return out;
	}
	if (l.doneNotified) {
		// 完了から一定時間(デフォルト3時間)経っても干されなければ自動停止
		if (elapsed - doneAfter >= cfg.laundryGiveupAfterMin * MIN) {
			state.laundry = null;
			out.push(pick('LAUNDRY_GIVEUP'));
			return out;
		}
		if (l.lastNagAt !== null && nowMs - l.lastNagAt >= cfg.laundryNagIntervalMin * MIN) {
			l.lastNagAt = nowMs;
			// 催促回数を増やしてイラつきレベルを上げる
			l.nagCount++;
			out.push(pickNag('LAUNDRY_NAG', l.nagCount));
		}
	}
	return out;
}
