import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { organizationService } from '@/services/organization.service'
import { PageLoader } from '@/components/common/PageLoader'
import { useAuthStore } from '@/stores/authStore'
import type { Invitation } from '@/types'

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link.')
      setLoading(false)
      return
    }

    organizationService
      .getInvitation(token)
      .then((data) => setInvitation(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch invitation details.'))
      .finally(() => setLoading(false))
  }, [token])

  const handleAccept = async () => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    try {
      await organizationService.acceptInvitation(token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Join Workspace</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {invitation
            ? `You have been invited to join ${invitation.organization?.name || 'an organization'} as a ${invitation.role}.`
            : 'Accept your invitation to get started.'}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
          {error}
        </div>
      )}

      {invitation && (
        <div className="space-y-4">
          <div className="rounded-md bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Invited Email</p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{invitation.email}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Target Workspace</p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{invitation.organization?.name || 'SQDIS Workspace'}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Role</p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{invitation.role}</p>
          </div>

          {!isAuthenticated ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                To join this workspace, create an account or sign in with your email:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to={`/register?email=${encodeURIComponent(invitation.email)}&invitationToken=${token}`}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm text-center"
                >
                  Create Account
                </Link>
                <Link
                  to={`/login?email=${encodeURIComponent(invitation.email)}&invitationToken=${token}`}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm text-center"
                >
                  Sign In
                </Link>
              </div>
            </div>
          ) : (
            <Button onClick={handleAccept} className="w-full" isLoading={submitting}>
              Accept Invitation
            </Button>
          )}
        </div>
      )}

      <div className="text-center">
        <Link to="/login" className="text-sm font-medium text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
