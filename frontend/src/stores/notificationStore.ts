import { create } from 'zustand'
import type { Notification } from '@/types'
import { notificationsService } from '@/services'

interface NotificationState {
    notifications: Notification[]
    unreadCount: number
    isLoading: boolean
    error: string | null

    // Actions
    fetchNotifications: () => Promise<void>
    fetchUnreadCount: () => Promise<void>
    markAsRead: (id: string) => Promise<void>
    markAllAsRead: () => Promise<void>
    removeNotification: (id: string) => Promise<void>
    clearError: () => void
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,

    fetchNotifications: async () => {
        set({ isLoading: true, error: null })
        try {
            const data = await notificationsService.getAll()
            const items = Array.isArray(data) ? data : data.data
            set({
                notifications: items,
                unreadCount: items.filter((notification: Notification) => !(notification.isRead ?? notification.read)).length,
                isLoading: false,
            })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to fetch notifications'
            set({ error: message, isLoading: false })
        }
    },

    fetchUnreadCount: async () => {
        try {
            const data = await notificationsService.getUnreadCount()
            set({ unreadCount: typeof data === 'number' ? data : data.count ?? 0 })
        } catch {
            // Silently fail — unread badge is non‑critical
        }
    },

    markAsRead: async (id: string) => {
        try {
            await notificationsService.markAsRead(id)
            const notification = get().notifications.find((item: Notification) => item.id === id)
            set({
                notifications: get().notifications.map((n: Notification) =>
                    n.id === id ? { ...n, read: true, isRead: true, readAt: n.readAt ?? new Date().toISOString() } : n,
                ),
                unreadCount: notification && !(notification.isRead ?? notification.read)
                    ? Math.max(0, get().unreadCount - 1)
                    : get().unreadCount,
            })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to mark notification as read'
            set({ error: message })
        }
    },

    markAllAsRead: async () => {
        try {
            await notificationsService.markAllAsRead()
            const readAt = new Date().toISOString()
            set({
                notifications: get().notifications.map((n: Notification) => ({ ...n, read: true, isRead: true, readAt: n.readAt ?? readAt })),
                unreadCount: 0,
            })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to mark all as read'
            set({ error: message })
        }
    },

    removeNotification: async (id: string) => {
        try {
            await notificationsService.delete(id)
            const removed = get().notifications.find((n: Notification) => n.id === id)
            set({
                notifications: get().notifications.filter((n: Notification) => n.id !== id),
                unreadCount: removed && !(removed.isRead ?? removed.read)
                    ? Math.max(0, get().unreadCount - 1)
                    : get().unreadCount,
            })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to delete notification'
            set({ error: message })
        }
    },

    clearError: () => {
        set({ error: null })
    },
}))
