import type { Env, GroupState } from './types';

const GROUPS_KEY = 'groups';

export function defaultState(groupId: string): GroupState {
	return {
		groupId,
		gomi: { date: '', status: 'pending', announced: false, lastPushHour: null, nagCount: 0 },
		laundry: null,
		shopping: [],
		invalidStreak: 0,
	};
}

/** KVから状態を読み込み、既存データに欠けているフィールドを補完する */
export async function loadState(env: Env, groupId: string): Promise<GroupState> {
	const raw = await env.STATE.get(`g:${groupId}`);
	if (!raw) return defaultState(groupId);
	try {
		const state = { ...defaultState(groupId), ...(JSON.parse(raw) as GroupState) };
		// nagCountが存在しない既存データのマイグレーション
		if (state.gomi.nagCount === undefined) state.gomi.nagCount = 0;
		if (state.laundry && state.laundry.nagCount === undefined) state.laundry.nagCount = 0;
		for (const item of state.shopping) {
			if (item.nagCount === undefined) item.nagCount = 0;
		}
		return state;
	} catch {
		return defaultState(groupId);
	}
}

export async function saveState(env: Env, state: GroupState): Promise<void> {
	await env.STATE.put(`g:${state.groupId}`, JSON.stringify(state));
}

export async function getGroups(env: Env): Promise<string[]> {
	const raw = await env.STATE.get(GROUPS_KEY);
	if (!raw) return [];
	try {
		return JSON.parse(raw) as string[];
	} catch {
		return [];
	}
}

export async function addGroup(env: Env, groupId: string): Promise<void> {
	const groups = await getGroups(env);
	if (!groups.includes(groupId)) {
		groups.push(groupId);
		await env.STATE.put(GROUPS_KEY, JSON.stringify(groups));
	}
}

export async function removeGroup(env: Env, groupId: string): Promise<void> {
	const groups = await getGroups(env);
	const next = groups.filter((g) => g !== groupId);
	if (next.length !== groups.length) {
		await env.STATE.put(GROUPS_KEY, JSON.stringify(next));
	}
	await env.STATE.delete(`g:${groupId}`);
}
