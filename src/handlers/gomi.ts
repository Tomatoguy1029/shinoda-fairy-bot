import type { Config } from '../config';
import type { GroupState } from '../types';
import { jstDateStr, jstDow, jstHour } from '../time';
import { pick, pickNag } from '../messages';

/** 今日がゴミの日なら当日分の状態を保証(日付が変わっていたらリセット)する。戻り値=今日がゴミの日か */
export function ensureGomiToday(state: GroupState, cfg: Config, nowMs: number): boolean {
	if (!cfg.gomiDays.includes(jstDow(nowMs))) return false;
	const today = jstDateStr(nowMs);
	if (state.gomi.date !== today) {
		state.gomi = { date: today, status: 'pending', announced: false, lastPushHour: null, nagCount: 0 };
	}
	return true;
}

/** 「まとめた」 */
export function handleGomiBundled(state: GroupState, cfg: Config, nowMs: number): string {
	if (!ensureGomiToday(state, cfg, nowMs)) return pick('GOMI_NOT_TODAY');
	if (state.gomi.status === 'done') return pick('GOMI_ALREADY_DONE');
	state.gomi.status = 'bundled';
	return pick('GOMI_BUNDLED_ACK');
}

/** 「捨てた」(まとめ報告を飛ばした直接doneも許可) */
export function handleGomiDone(state: GroupState, cfg: Config, nowMs: number): string {
	if (!ensureGomiToday(state, cfg, nowMs)) return pick('GOMI_NOT_TODAY');
	if (state.gomi.status === 'done') return pick('GOMI_ALREADY_DONE');
	state.gomi.status = 'done';
	return pick('GOMI_DONE_PRAISE');
}

/** Cron: 設計書§5.1 */
export function cronGomi(state: GroupState, cfg: Config, nowMs: number): string[] {
	if (!state.gomiEnabled) return [];
	if (!ensureGomiToday(state, cfg, nowMs)) return [];
	if (state.gomi.status === 'done') return [];
	const h = jstHour(nowMs);
	if (h < cfg.gomiStartHour || h > cfg.gomiEndHour) return [];
	if (state.gomi.lastPushHour === h) return []; // 1時間に1回だけ
	state.gomi.lastPushHour = h;
	if (!state.gomi.announced) {
		state.gomi.announced = true;
		return [pick('GOMI_ANNOUNCE')];
	}
	// 催促回数を増やしてイラつきレベルを上げる
	state.gomi.nagCount++;
	const nagId = state.gomi.status === 'pending' ? 'GOMI_NAG_PRE_BUNDLE' : 'GOMI_NAG_POST_BUNDLE';
	return [pickNag(nagId, state.gomi.nagCount)];
}
