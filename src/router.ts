import type { Config } from './config';
import type { GroupState, LineMessage } from './types';
import { pick } from './messages';
import { textMsg } from './line';
import { handleGomiBundled, handleGomiDone } from './handlers/gomi';
import { cancelLaundry, handleLaundryHung, handleLaundryStart } from './handlers/laundry';
import {
	cancelShopping,
	cancelShoppingById,
	confirmShoppingDay,
	handleShoppingBoughtBare,
	handleShoppingBoughtNamed,
	handleShoppingNameOnly,
	handleShoppingRegister,
} from './handlers/shopping';
import { handleDebug } from './handlers/debug';

const RE_GREETING = /^(こんにちは|こんにちわ|おはよう|おはようございます|こんばんは|やあ|ども|どうも|はじめまして|よろしく|ヨロシク)[\s！!]*$/i;
const RE_HELP = /^(help|ヘルプ|へるぷ)$/i;
const RE_DEBUG = /^(debug|デバッグ|でばっぐ)$/i;
const RE_CANCEL = /キャンセル|やめる|やめた|取り消し|取消|削除|消して/;
const RE_TODAY = /今日|きょう/;
const RE_TOMORROW = /明日|あした|あす/;
const RE_HUNG = /干した|ほした|乾かした/;
const RE_LAUNDRY = /洗濯|せんたく/;
const RE_GOMI_DONE = /捨てた|すてた|出した|だした/;
const RE_GOMI_BUNDLED = /まとめた|縛った|しばった/;
const RE_BOUGHT_NAMED = /^(.+?)を?(買った|かった|買ってきた)$/;
const RE_BOUGHT_BARE = /^(買った|かった|買ってきた)$/;
const RE_REGISTER = /^(.+?)を?(買ってくる|買いに行く|買いにいく|買う|買っとく|買わなきゃ|買わんと)$/;

/**
 * メンション除去済みテキストをコマンド判定して返答を生成する(設計書§4の優先順)。
 * stateは破壊的に更新される。
 */
export function routeText(state: GroupState, cfg: Config, rawText: string, nowMs: number): LineMessage[] {
	const t = rawText.normalize('NFKC').trim();
	const valid = (msgs: LineMessage[]): LineMessage[] => {
		state.invalidStreak = 0;
		return msgs;
	};

	// 0. 挨拶 → 挨拶 + 使い方紹介
	if (RE_GREETING.test(t)) return valid([textMsg(pick('GREETING')), textMsg(pick('HELP'))]);

	// 1. ヘルプ
	if (RE_HELP.test(t)) return valid([textMsg(pick('HELP'))]);

	// 1.5. デバッグ(登録状況の確認+削除ボタン)
	if (RE_DEBUG.test(t)) return valid([handleDebug(state, cfg, nowMs)]);

	// 1.6. キャンセル(洗濯タイマー/買い出し品目の削除)
	if (RE_CANCEL.test(t)) {
		if (RE_LAUNDRY.test(t)) return valid([textMsg(cancelLaundry(state))]);
		const name = t.replace(/(を|の)?(キャンセル|やめる|やめた|取り消し|取消|削除|消して)/g, '').trim();
		return valid(cancelShopping(state, name));
	}

	// 2. 買い出しの日選択(テキスト)
	if (state.shopping.some((i) => i.status === 'awaiting_day')) {
		if (RE_TODAY.test(t)) return valid(confirmShoppingDay(state, cfg, nowMs, 'today'));
		if (RE_TOMORROW.test(t)) return valid(confirmShoppingDay(state, cfg, nowMs, 'tomorrow'));
	}

	// 3. 干した
	if (RE_HUNG.test(t)) return valid([textMsg(handleLaundryHung(state))]);

	// 4. 洗濯開始
	if (RE_LAUNDRY.test(t)) return valid([textMsg(handleLaundryStart(state, cfg, nowMs))]);

	// 5. ゴミ捨て完了
	if (RE_GOMI_DONE.test(t)) return valid([textMsg(handleGomiDone(state, cfg, nowMs))]);

	// 6. ゴミまとめ完了
	if (RE_GOMI_BUNDLED.test(t)) return valid([textMsg(handleGomiBundled(state, cfg, nowMs))]);

	// 7. 買い出し完了(品目指定) ※「買った」単体は8へ
	const boughtNamed = !RE_BOUGHT_BARE.test(t) && t.match(RE_BOUGHT_NAMED);
	if (boughtNamed) return valid(handleShoppingBoughtNamed(state, boughtNamed[1]));

	// 8. 買い出し完了(無指定)
	if (RE_BOUGHT_BARE.test(t)) return valid(handleShoppingBoughtBare(state));

	// 9. 買い出し登録
	const register = t.match(RE_REGISTER);
	if (register) return valid(handleShoppingRegister(state, register[1]));

	// 10. 品目名のみの完了報告
	const nameOnly = handleShoppingNameOnly(state, t);
	if (nameOnly) return valid(nameOnly);

	// 11. 無効入力（3段階: BASIC → ANGRY → RAGE）
	state.invalidStreak++;
	const rageThreshold = cfg.invalidStreakThreshold + 2; // デフォルト: 3 + 2 = 5
	if (state.invalidStreak >= rageThreshold) {
		// 妖精崩壊モード: {name} は index.ts 側で発言者の表示名に置換される
		return [textMsg(pick('INVALID_RAGE'))];
	}
	const angry = state.invalidStreak >= cfg.invalidStreakThreshold || Math.random() < cfg.invalidRandomRate;
	return [textMsg(pick(angry ? 'INVALID_ANGRY' : 'INVALID_BASIC'))];
}

/** postback (shopping_day?id=...&day=today|tomorrow) */
export function routePostback(state: GroupState, cfg: Config, data: string, nowMs: number): LineMessage[] {
	if (data.startsWith('shopping_day?')) {
		const params = new URLSearchParams(data.slice(data.indexOf('?') + 1));
		const id = params.get('id') ?? undefined;
		const day = params.get('day') === 'tomorrow' ? 'tomorrow' : 'today';
		return confirmShoppingDay(state, cfg, nowMs, day, id);
	}
	if (data.startsWith('cancel?')) {
		const params = new URLSearchParams(data.slice(data.indexOf('?') + 1));
		if (params.get('target') === 'laundry') return [textMsg(cancelLaundry(state))];
		if (params.get('target') === 'shopping') return cancelShoppingById(state, params.get('id') ?? '');
	}
	return [];
}
