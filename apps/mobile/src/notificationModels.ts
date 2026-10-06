export type NotificationKind = 'invitation' | 'event_changed' | 'event_cancelled' | 'reminder_24h' | 'reminder_1h' | 'chat_message';

export type Notice = {
  id: string;
  event_id: string | null;
  conversation_id: string | null;
  kind: NotificationKind;
  title: string;
  created_at: string;
  read_at: string | null;
};

export type NotificationInbox = {items: Notice[]; page: number; page_size: number; total: number; unread: number};
