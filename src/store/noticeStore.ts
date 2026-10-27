import { create } from 'zustand';
import type { NoticeMessageData } from 'pevenmui';

export const useNoticeStore = create<{ notice: NoticeMessageData | null }>(() => ({ notice: null }));

export const notify = (notice: NoticeMessageData) => useNoticeStore.setState({ notice });
export const closeNotice = () => useNoticeStore.setState({ notice: null });
