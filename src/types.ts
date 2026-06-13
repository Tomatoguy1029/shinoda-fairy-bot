export interface Env {
	STATE: KVNamespace;
	LINE_CHANNEL_SECRET: string;
	LINE_CHANNEL_ACCESS_TOKEN: string;
	GOMI_DAYS: string;
	GOMI_START_HOUR: string;
	GOMI_END_HOUR: string;
	LAUNDRY_DURATION_MIN: string;
	LAUNDRY_NAG_INTERVAL_MIN: string;
	LAUNDRY_GIVEUP_AFTER_MIN: string;
	SHOPPING_HOURS: string;
	INVALID_STREAK_THRESHOLD: string;
	INVALID_RANDOM_RATE: string;
}

export interface GomiState {
	date: string; // "YYYY-MM-DD" (JST)
	status: 'pending' | 'bundled' | 'done';
	announced: boolean;
	lastPushHour: number | null;
	nagCount: number; // 当日の催促回数（イラつきレベル判定用）
}

export interface LaundryState {
	startedAt: number; // epoch ms
	almostNotified: boolean;
	doneNotified: boolean;
	lastNagAt: number | null;
	nagCount: number; // 干し催促の回数（イラつきレベル判定用）
}

export interface ShoppingItem {
	id: string;
	name: string;
	status: 'awaiting_day' | 'active';
	startDate: string | null; // "YYYY-MM-DD" (JST)
	lastPushKey: string | null; // "YYYY-MM-DD-HH" (JST)
	rolledOver: boolean; // 前日から繰り越された品目か
	nagCount: number; // 催促回数（イラつきレベル判定用）
	createdAt: number;
}

export interface GroupState {
	groupId: string;
	gomiEnabled: boolean; // ゴミ捨てアナウンスを送るか(個人チャットはデフォルトfalse)
	gomi: GomiState;
	laundry: LaundryState | null;
	shopping: ShoppingItem[];
	invalidStreak: number;
	lastInvalidAt: number | null; // 最後の無効入力の時刻 (epoch ms)
	lastInvalidMsg: string | null; // 直前に送信した無効入力メッセージ
}

// ---- LINE message objects (必要分のみ) ----

export interface LineTextMessage {
	type: 'text';
	text: string;
	quickReply?: {
		items: Array<{
			type: 'action';
			action: { type: 'postback'; label: string; data: string; displayText?: string };
		}>;
	};
}

export type LineMessage = LineTextMessage;

export interface LineMentionee {
	index: number;
	length: number;
	type?: string;
	userId?: string;
	isSelf?: boolean;
}

export interface LineEvent {
	type: string;
	replyToken?: string;
	source?: { type: 'user' | 'group' | 'room'; userId?: string; groupId?: string; roomId?: string };
	message?: {
		type: string;
		id?: string;
		text?: string;
		mention?: { mentionees?: LineMentionee[] };
	};
	postback?: { data: string };
}
