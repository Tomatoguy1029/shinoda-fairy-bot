import type { Env, LineMessage } from './types';

const API_BASE = 'https://api.line.me/v2/bot';

/** x-line-signature の検証 (HMAC-SHA256 + Base64) */
export async function verifySignature(secret: string, body: string, signature: string | null): Promise<boolean> {
	if (!signature) return false;
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
	const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
	return expected === signature;
}

async function callApi(env: Env, path: string, payload: unknown): Promise<void> {
	const res = await fetch(`${API_BASE}${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		// 月間上限超過(429)等はリトライしない(設計書§8)。ログのみ。
		console.error(`LINE API ${path} failed: ${res.status} ${await res.text()}`);
	}
}

/** 応答メッセージ(無料・無制限)。最大5件 */
export async function reply(env: Env, replyToken: string, messages: LineMessage[]): Promise<void> {
	if (messages.length === 0) return;
	await callApi(env, '/message/reply', { replyToken, messages: messages.slice(0, 5) });
}

/** プッシュメッセージ(月200通枠を人数分消費)。最大5件を1リクエストに集約 */
export async function push(env: Env, to: string, messages: LineMessage[]): Promise<void> {
	if (messages.length === 0) return;
	await callApi(env, '/message/push', { to, messages: messages.slice(0, 5) });
}

/** ユーザーの表示名を取得する(失敗時は「キミ」にフォールバック) */
export async function getDisplayName(
	env: Env,
	sourceType: string | undefined,
	sourceId: string | undefined,
	userId: string | undefined,
): Promise<string> {
	if (!userId) return 'キミ';
	try {
		// グループの場合はグループメンバープロフィールAPI、それ以外はプロフィールAPI
		const path =
			sourceType === 'group' && sourceId
				? `/group/${sourceId}/member/${userId}`
				: `/profile/${userId}`;
		const res = await fetch(`${API_BASE}${path}`, {
			headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
		});
		if (!res.ok) return 'キミ';
		const data = (await res.json()) as { displayName?: string };
		return data.displayName ?? 'キミ';
	} catch {
		return 'キミ';
	}
}

export function textMsg(text: string): LineMessage {
	return { type: 'text', text };
}

/** 買い出しの今日/明日クイックリプライ付きメッセージ */
export function askDayMsg(text: string, itemId: string): LineMessage {
	return {
		type: 'text',
		text,
		quickReply: {
			items: [
				{
					type: 'action',
					action: { type: 'postback', label: '今日', data: `shopping_day?id=${itemId}&day=today`, displayText: '今日' },
				},
				{
					type: 'action',
					action: { type: 'postback', label: '明日', data: `shopping_day?id=${itemId}&day=tomorrow`, displayText: '明日' },
				},
			],
		},
	};
}
