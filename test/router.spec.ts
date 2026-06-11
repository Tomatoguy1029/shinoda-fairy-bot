import { describe, it, expect } from 'vitest';
import { routeText } from '../src/router';
import type { GroupState } from '../src/types';
import { getConfig } from '../src/config';

function makeState(): GroupState {
	return {
		groupId: 'test',
		gomi: { date: '', status: 'pending', announced: false, lastPushHour: null, nagCount: 0 },
		laundry: null,
		shopping: [],
		invalidStreak: 0,
		lastInvalidAt: null,
		lastInvalidMsg: null,
	};
}

// config の最低限のモック
const cfg = {
	gomiDays: [2, 5],
	gomiStartHour: 20,
	gomiEndHour: 23,
	laundryDurationMin: 50,
	laundryNagIntervalMin: 30,
	laundryGiveupAfterMin: 180,
	shoppingHours: [15, 18, 21],
	invalidStreakThreshold: 3,
	invalidRandomRate: 0,
} as ReturnType<typeof getConfig>;

describe('routeText - greeting', () => {
	const now = Date.now();

	it('「こんにちは」で挨拶 + ヘルプ の2メッセージを返す', () => {
		const msgs = routeText(makeState(), cfg, 'こんにちは', now);
		expect(msgs).toHaveLength(2);
	});

	it('「おはよう」でも挨拶を返す', () => {
		const msgs = routeText(makeState(), cfg, 'おはよう', now);
		expect(msgs).toHaveLength(2);
	});

	it('「こんばんは」でも挨拶を返す', () => {
		const msgs = routeText(makeState(), cfg, 'こんばんは', now);
		expect(msgs).toHaveLength(2);
	});

	it('無効入力ストリークはリセットされる', () => {
		const state = makeState();
		state.invalidStreak = 3;
		routeText(state, cfg, 'こんにちは', now);
		expect(state.invalidStreak).toBe(0);
	});

	it('無効入力は1分経過するとストリークがリセットされる', () => {
		const state = makeState();
		state.invalidStreak = 4;
		state.lastInvalidAt = now - 61 * 1000; // 61秒前
		routeText(state, cfg, '意味不明', now);
		// 0にリセットされてから+1されるので結果1
		expect(state.invalidStreak).toBe(1);
	});

	it('連投時に同じ無効入力メッセージが連続で選ばれない', () => {
		const state = makeState();
		
		// 1回目
		const msgs1 = routeText(state, cfg, '意味不明1', now);
		const text1 = msgs1[0].type === 'text' ? msgs1[0].text : '';
		
		// 2回目 (直前のセリフは除外されるはず)
		const msgs2 = routeText(state, cfg, '意味不明2', now);
		const text2 = msgs2[0].type === 'text' ? msgs2[0].text : '';
		
		expect(text1).not.toBe(text2);
	});
});
