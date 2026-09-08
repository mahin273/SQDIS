import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { notificationsService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatDate } from '@/lib/utils'
import { MetricTile, PageHeader, QueryState } from '../pageUtils'

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.all({ page: 1, pageSize: 50 }),
    queryFn: () => notificationsService.getAll({ page: 1, pageSize: 50 }),
  })
  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => notificationsService.getUnreadCount(),
  })

  const notifications = notificationsQuery.data?.data ?? []

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="System alerts, score changes, and workspace activity."
        action={
          <Button
            variant="outline"
            leftIcon={<CheckCheck className="h-4 w-4" />}
            onClick={async () => {
              await notificationsService.markAllAsRead()
              invalidateNotifications()
            }}
          >
            Mark all read
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricTile label="Total" value={notificationsQuery.data?.total ?? notifications.length} icon={<Bell className="h-5 w-5" />} />
        <MetricTile label="Unread" value={unreadQuery.data?.count ?? notifications.filter((item) => !(item.isRead ?? item.read)).length} />
        <MetricTile label="Types" value={new Set(notifications.map((item) => item.type)).size} />
      </div>

      <QueryState isLoading={notificationsQuery.isLoading} error={notificationsQuery.error} onRetry={() => notificationsQuery.refetch()}>
        <Card>
          <CardContent className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
            {notifications.map((notification) => {
              const isRead = notification.isRead ?? notification.read;

              return (
                <div key={notification.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-950 dark:text-white">{notification.title}</h2>
                      <Badge variant={isRead ? 'secondary' : 'info'}>{isRead ? 'Read' : 'Unread'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {notification.type} · {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!isRead && (
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Mark as read"
                        onClick={async () => {
                          await notificationsService.markAsRead(notification.id)
                          invalidateNotifications()
                        }}
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Delete notification"
                      onClick={async () => {
                        await notificationsService.delete(notification.id)
                        invalidateNotifications()
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {notifications.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center p-6">
                <Bell className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">No notifications</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  You are all caught up! New alerts and updates will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </QueryState>
    </div>
  )
}
