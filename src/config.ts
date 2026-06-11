import type { Env } from './types';

export interface Config {
	gomiDays: number[]; // 0=日..6=土
	gomiStartHour: number; // JST
	gomiEndHour: number; // JST
	laundryDurationMin: number;
	laundryNagIntervalMin: number;
	laundryGiveupAfterMin: number;
	shoppingHours: number[]; // JST
	invalidStreakThreshold: number;
	invalidRandomRate: number;
}

const intList = (s: string): number[] =>
	s
		.split(',')
		.map((v) => parseInt(v.trim(), 10))
		.filter((n) => !Number.isNaN(n));

export function getConfig(env: Env): Config {
	return {
		gomiDays: intList(env.GOMI_DAYS ?? '2,5'),
		gomiStartHour: parseInt(env.GOMI_START_HOUR ?? '20', 10),
		gomiEndHour: parseInt(env.GOMI_END_HOUR ?? '23', 10),
		laundryDurationMin: parseInt(env.LAUNDRY_DURATION_MIN ?? '50', 10),
		laundryNagIntervalMin: parseInt(env.LAUNDRY_NAG_INTERVAL_MIN ?? '30', 10),
		laundryGiveupAfterMin: parseInt(env.LAUNDRY_GIVEUP_AFTER_MIN ?? '180', 10),
		shoppingHours: intList(env.SHOPPING_HOURS ?? '15,18,21'),
		invalidStreakThreshold: parseInt(env.INVALID_STREAK_THRESHOLD ?? '3', 10),
		invalidRandomRate: parseFloat(env.INVALID_RANDOM_RATE ?? '0.05'),
	};
}
