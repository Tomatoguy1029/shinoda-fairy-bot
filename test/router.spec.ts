import { describe, it, expect } from 'vitest';
import { routeText } from '../src/router';
import type { GroupState } from '../src/types';
import { getConfig } from '../src/config';

function makeState(): GroupState {
	return {
		id: 'test',
		gomi: { bundled: false, done: false },
		laundry: { startedAt: null, naggedAt: null },
		shopping: [],
		invalidStreak: 0,
	};
}

// config の最低限のモック
const cfg = {
	laundryDurationMs: 50 * 60 * 1000,
	laundryAlmostMs: 10 * 60 * 1000,
	laundryNagIntervalMs: 30 * 60 * 1000,
	laundryGiveupMs: 4 * 60 * 60 * 1000,
	shoppingRemindHour: 15,
	gomiNagIntervalMs: 60 * 60 * 1000,
	invalidStreakThreshold: 5,
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
});
