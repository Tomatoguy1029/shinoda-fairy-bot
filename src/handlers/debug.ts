import type { Config } from '../config';
import type { GroupState, LineMessage } from '../types';
import { jstTimeStr } from '../time';
import { ensureGomiToday } from './gomi';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const MIN = 60 * 1000;

/** 「debug」「デバッグ」: 登録状況の一覧と削除ボタンを返す */
export function handleDebug(state: GroupState, cfg: Config, nowMs: number): LineMessage {
	const lines: string[] = ['今の状況を教えてあげるね'];

	// ゴミ出し
	if (ensureGomiToday(state, cfg, nowMs)) {
		const m = {
			pending: '今日はゴミの日！まだまとめてないみたいだよ',
			bundled: '今日はゴミの日！まとめ済み、あとは捨てるだけ',
			done: '今日はゴミの日だったけど、もう捨て済み。えらい',
		} as const;
		lines.push(`【ゴミ出し】${m[state.gomi.status]}`);
	} else {
		lines.push(`【ゴミ出し】今日はゴミの日じゃないよ(${cfg.gomiDays.map((d) => DOW[d] ?? '?').join('・')}曜日にやるよ)`);
	}

	// 洗濯
	if (!state.laundry) {
		lines.push('【洗濯】タイマーは動いてないよ');
	} else if (!state.laundry.doneNotified) {
		const end = jstTimeStr(state.laundry.startedAt + cfg.laundryDurationMin * MIN);
		lines.push(`【洗濯】${jstTimeStr(state.laundry.startedAt)}開始 → ${end}ごろ完了予定`);
	} else {
		lines.push('【洗濯】洗濯は終わってるよ。干されるのを待ってるところ');
	}

	// 買い出し
	if (state.shopping.length === 0) {
		lines.push('【買い出し】リストは空っぽだよ');
	} else {
		const hours = cfg.shoppingHours.map((h) => `${h}時`).join('/');
		lines.push('【買い出し】');
		for (const i of state.shopping) {
			const when = i.status === 'awaiting_day' ? '今日か明日か返事待ち' : `${i.startDate}から ${hours}にリマインド`;
			lines.push(`・${i.name} … ${when}`);
		}
	}

	// 削除ボタン(クイックリプライ)
	const items: NonNullable<LineMessage['quickReply']>['items'] = [];
	if (state.laundry) {
		items.push({
			type: 'action',
			action: { type: 'postback', label: '洗濯タイマー削除', data: 'cancel?target=laundry', displayText: '洗濯キャンセル' },
		});
	}
	for (const i of state.shopping) {
		items.push({
			type: 'action',
			action: {
				type: 'postback',
				label: `${i.name}を削除`.slice(0, 20),
				data: `cancel?target=shopping&id=${i.id}`,
				displayText: `${i.name}キャンセル`,
			},
		});
	}

	if (items.length > 0) {
		lines.push('', '間違って登録したものは下のボタンで消せるよ');
		return { type: 'text', text: lines.join('\n'), quickReply: { items } };
	}
	return { type: 'text', text: lines.join('\n') };
}
