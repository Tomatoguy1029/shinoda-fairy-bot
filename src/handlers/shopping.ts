import type { Config } from '../config';
import type { GroupState, LineMessage, ShoppingItem } from '../types';
import { jstDateStr, jstHour, jstPushKey, jstTomorrowStr } from '../time';
import { pick, pickNag } from '../messages';
import { askDayMsg, textMsg } from '../line';

const MAX_ITEMS = 3;

const listNames = (items: ShoppingItem[]): string => items.map((i) => i.name).join('、');

/** 「〇〇を買ってくる」: 登録して今日/明日を質問 */
export function handleShoppingRegister(state: GroupState, name: string): LineMessage[] {
	if (state.shopping.some((i) => i.name === name)) {
		return [textMsg(pick('SHOPPING_DUPLICATE', { item: name }))];
	}
	// 日付未回答の古い質問は破棄して新しい質問を優先(設計書§3)
	state.shopping = state.shopping.filter((i) => i.status !== 'awaiting_day');
	if (state.shopping.length >= MAX_ITEMS) {
		return [textMsg(pick('SHOPPING_FULL'))];
	}
	const item: ShoppingItem = {
		id: crypto.randomUUID(),
		name,
		status: 'awaiting_day',
		startDate: null,
		lastPushKey: null,
		rolledOver: false,
		nagCount: 0,
		createdAt: Date.now(),
	};
	state.shopping.push(item);
	return [askDayMsg(pick('SHOPPING_ASK_DAY', { item: name }), item.id)];
}

/** 今日/明日の確定(テキスト・postback共通)。itemId省略時はawaiting_dayの品目に適用 */
export function confirmShoppingDay(
	state: GroupState,
	cfg: Config,
	nowMs: number,
	day: 'today' | 'tomorrow',
	itemId?: string,
): LineMessage[] {
	const item = itemId
		? state.shopping.find((i) => i.id === itemId && i.status === 'awaiting_day')
		: state.shopping.find((i) => i.status === 'awaiting_day');
	if (!item) return [textMsg(pick('SHOPPING_STALE_CHOICE'))];

	item.status = 'active';
	if (day === 'today') {
		item.startDate = jstDateStr(nowMs);
		// 当日かつ15時以降なら即座に初回リマインド(replyなので無料)
		if (jstHour(nowMs) >= Math.min(...cfg.shoppingHours)) {
			item.lastPushKey = jstPushKey(nowMs);
			return [textMsg(pick('SHOPPING_FIRST_REMIND', { item: item.name }))];
		}
		return [textMsg(pick('SHOPPING_REGISTERED_TODAY'))];
	}
	item.startDate = jstTomorrowStr(nowMs);
	return [textMsg(pick('SHOPPING_REGISTERED_TOMORROW'))];
}

/** 完了処理(品目を特定済み) */
function completeItem(state: GroupState, item: ShoppingItem): LineMessage[] {
	state.shopping = state.shopping.filter((i) => i.id !== item.id);
	let text = pick('SHOPPING_DONE_PRAISE', { item: item.name });
	if (state.shopping.length === 0) {
		text += '\n' + pick('SHOPPING_ALL_CLEAR');
	}
	return [textMsg(text)];
}

/** 「〇〇買った」: 品目名指定の完了 */
export function handleShoppingBoughtNamed(state: GroupState, name: string): LineMessage[] {
	if (state.shopping.length === 0) return [textMsg(pick('SHOPPING_NOTHING'))];
	const item =
		state.shopping.find((i) => i.name === name) ??
		state.shopping.find((i) => i.name.includes(name) || name.includes(i.name));
	if (!item) {
		return [textMsg(pick('SHOPPING_ITEM_NOT_FOUND', { item: name, items: listNames(state.shopping) }))];
	}
	return completeItem(state, item);
}

/** 「買った」のみ: 1件なら完了、複数なら聞き返す */
export function handleShoppingBoughtBare(state: GroupState): LineMessage[] {
	if (state.shopping.length === 0) return [textMsg(pick('SHOPPING_NOTHING'))];
	if (state.shopping.length === 1) return completeItem(state, state.shopping[0]);
	return [textMsg(pick('SHOPPING_WHICH_ONE', { items: listNames(state.shopping) }))];
}

/** 品目名のみの入力(複数登録時の完了報告) */
export function handleShoppingNameOnly(state: GroupState, text: string): LineMessage[] | null {
	const item = state.shopping.find((i) => i.status === 'active' && (i.name === text || text.includes(i.name)));
	if (!item) return null;
	return completeItem(state, item);
}

/** 品目の削除(誤登録時)。nameが空なら1件のみのとき削除、複数なら聞き返す */
export function cancelShopping(state: GroupState, name: string): LineMessage[] {
	if (state.shopping.length === 0) return [textMsg(pick('CANCEL_NOTHING'))];
	if (!name) {
		if (state.shopping.length === 1) {
			const item = state.shopping[0];
			state.shopping = [];
			return [textMsg(pick('CANCEL_SHOPPING_OK', { item: item.name }))];
		}
		return [textMsg(pick('CANCEL_WHICH_ONE', { items: listNames(state.shopping) }))];
	}
	const item =
		state.shopping.find((i) => i.name === name) ??
		state.shopping.find((i) => i.name.includes(name) || name.includes(i.name));
	if (!item) {
		return [textMsg(pick('SHOPPING_ITEM_NOT_FOUND', { item: name, items: listNames(state.shopping) }))];
	}
	state.shopping = state.shopping.filter((i) => i.id !== item.id);
	return [textMsg(pick('CANCEL_SHOPPING_OK', { item: item.name }))];
}

/** postbackによる品目削除 */
export function cancelShoppingById(state: GroupState, id: string): LineMessage[] {
	const item = state.shopping.find((i) => i.id === id);
	if (!item) return [textMsg(pick('SHOPPING_STALE_CHOICE'))];
	state.shopping = state.shopping.filter((i) => i.id !== id);
	return [textMsg(pick('CANCEL_SHOPPING_OK', { item: item.name }))];
}

/** Cron: 設計書§5.3 */
export function cronShopping(state: GroupState, cfg: Config, nowMs: number): string[] {
	const h = jstHour(nowMs);
	const today = jstDateStr(nowMs);

	// 指定日の25時(=翌1時)を過ぎても未完了なら翌日に繰り越し(リマインドは15時から再開)
	if (h >= 1) {
		for (const i of state.shopping) {
			if (i.status === 'active' && i.startDate !== null && i.startDate < today) {
				i.startDate = today;
				i.rolledOver = true;
			}
		}
	}

	if (!cfg.shoppingHours.includes(h)) return [];
	const key = jstPushKey(nowMs);

	const due = state.shopping.filter(
		(i) => i.status === 'active' && i.startDate !== null && i.startDate <= today && i.lastPushKey !== key,
	);
	if (due.length === 0) return [];

	const rolled = due.filter((i) => i.rolledOver);
	const first = due.filter((i) => !i.rolledOver && i.lastPushKey === null);
	const nag = due.filter((i) => !i.rolledOver && i.lastPushKey !== null);
	for (const i of due) {
		i.lastPushKey = key;
		i.rolledOver = false; // 繰り越し文言は再開初回のみ。以降は通常のNAG
	}

	const out: string[] = [];
	if (rolled.length > 0) out.push(pick('SHOPPING_ROLLOVER', { item: rolled.map((i) => i.name).join('と') }));
	if (first.length > 0) out.push(pick('SHOPPING_FIRST_REMIND', { item: first.map((i) => i.name).join('と') }));
	if (nag.length > 0) {
		// 催促回数を増やしてイラつきレベルを上げる（複数品目の場合は最大値を使用）
		for (const i of nag) i.nagCount++;
		const maxNag = Math.max(...nag.map((i) => i.nagCount));
		out.push(pickNag('SHOPPING_NAG', maxNag, { item: nag.map((i) => i.name).join('と') }));
	}
	return out;
}
