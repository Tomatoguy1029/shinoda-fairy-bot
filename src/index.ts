import type { Env, LineEvent, LineMessage } from './types';
import { getConfig } from './config';
import { pick } from './messages';
import { getDisplayName, push, reply, textMsg, verifySignature } from './line';
import { addGroup, getGroups, loadState, removeGroup, saveState } from './state';
import { routePostback, routeText } from './router';
import { cronGomi } from './handlers/gomi';
import { cronLaundry } from './handlers/laundry';
import { cronShopping } from './handlers/shopping';

/** イベントの送信元ID(グループ/ルーム/1対1)を取得 */
function sourceId(event: LineEvent): string | null {
	const s = event.source;
	if (!s) return null;
	return s.groupId ?? s.roomId ?? s.userId ?? null;
}

/** botへのメンション部分を除去したテキストを返す。メンションされていなければnull */
function extractMentionedText(event: LineEvent): string | null {
	const msg = event.message;
	if (!msg || msg.type !== 'text' || typeof msg.text !== 'string') return null;

	// 1対1トークはメンション不要で処理する
	if (event.source?.type === 'user') return msg.text;

	const mentionees = msg.mention?.mentionees ?? [];
	const selfMentions = mentionees.filter((m) => m.isSelf === true);
	if (selfMentions.length === 0) return null;

	let text = msg.text;
	for (const m of [...selfMentions].sort((a, b) => b.index - a.index)) {
		text = text.slice(0, m.index) + text.slice(m.index + m.length);
	}
	return text;
}

async function handleEvent(env: Env, event: LineEvent): Promise<void> {
	const cfg = getConfig(env);
	const id = sourceId(event);
	if (!id) return;

	if (event.type === 'join') {
		await addGroup(env, id);
		if (event.replyToken) {
			await reply(env, event.replyToken, [textMsg(pick('JOIN_GREETING')), textMsg(pick('HELP'))]);
		}
		return;
	}

	if (event.type === 'leave') {
		await removeGroup(env, id);
		return;
	}

	let messages: LineMessage[] = [];

	if (event.type === 'message') {
		const text = extractMentionedText(event);
		if (text === null) return; // メンションなし→無視
		const state = await loadState(env, id);
		const before = JSON.stringify(state);
		messages = routeText(state, cfg, text, Date.now());
		// グループ一覧への登録漏れを自己修復(join前から居た場合など)
		await addGroup(env, id);
		if (JSON.stringify(state) !== before) await saveState(env, state);
	} else if (event.type === 'postback' && event.postback) {
		const state = await loadState(env, id);
		const before = JSON.stringify(state);
		messages = routePostback(state, cfg, event.postback.data, Date.now());
		if (JSON.stringify(state) !== before) await saveState(env, state);
	} else {
		return;
	}

	if (messages.length > 0 && event.replyToken) {
		// {name} プレースホルダがある場合、発言者の表示名を取得して置換する
		const hasNamePlaceholder = messages.some((m) => m.type === 'text' && m.text.includes('{name}'));
		if (hasNamePlaceholder) {
			const displayName = await getDisplayName(
				env,
				event.source?.type,
				event.source?.groupId ?? event.source?.roomId,
				event.source?.userId,
			);
			for (const m of messages) {
				if (m.type === 'text') m.text = m.text.replaceAll('{name}', displayName);
			}
		}
		await reply(env, event.replyToken, messages);
	}
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
	const body = await request.text();
	const ok = await verifySignature(env.LINE_CHANNEL_SECRET, body, request.headers.get('x-line-signature'));
	if (!ok) return new Response('invalid signature', { status: 403 });

	let events: LineEvent[] = [];
	try {
		events = (JSON.parse(body) as { events?: LineEvent[] }).events ?? [];
	} catch {
		return new Response('bad request', { status: 400 });
	}

	for (const event of events) {
		try {
			await handleEvent(env, event);
		} catch (e) {
			console.error('event handling failed:', e);
		}
	}
	return new Response('ok');
}

async function runCron(env: Env): Promise<void> {
	const cfg = getConfig(env);
	const nowMs = Date.now();
	const groups = await getGroups(env);

	for (const groupId of groups) {
		try {
			const state = await loadState(env, groupId);
			const before = JSON.stringify(state);

			const texts: string[] = [
				...cronGomi(state, cfg, nowMs),
				...cronLaundry(state, cfg, nowMs),
				...cronShopping(state, cfg, nowMs),
			];

			if (texts.length > 0) {
				// 同一Cron実行内のpushは1リクエストに集約(設計書§5)
				await push(env, groupId, texts.map(textMsg));
			}
			if (JSON.stringify(state) !== before) await saveState(env, state);
		} catch (e) {
			console.error(`cron failed for ${groupId}:`, e);
		}
	}
}

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		if (request.method === 'POST') {
			return handleWebhook(request, env);
		}
		return new Response('shinoda-fairy-bot is alive');
	},

	async scheduled(_controller, env, ctx): Promise<void> {
		ctx.waitUntil(runCron(env));
	},
} satisfies ExportedHandler<Env>;
