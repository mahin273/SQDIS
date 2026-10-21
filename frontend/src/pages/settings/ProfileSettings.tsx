import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  User, Shield, Key, 
  Save, AlertTriangle, LogOut, CheckCircle2,
  Copy, CheckCheck, Mail, ShieldCheck, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { authService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { useOrganizationStore } from '@/stores/organizationStore'

export function ProfileSettings() {
  const queryClient = useQueryClient()
  const { user, setUser } = useAuthStore()
  const { currentOrganization } = useOrganizationStore()
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  })
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [copiedUserId, setCopiedUserId] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      return authService.updateProfile(data)
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        setUser(updatedUser)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me })
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 4000)
    },
  })

  const updatePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => {
      return authService.changePassword(data)
    },
    onSuccess: () => {
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordError('')
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update password'
      setPasswordError(msg)
    },
  })

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate({ name: profileData.name })
  }

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords don't match")
      return
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    setPasswordError('')
    updatePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    })
  }

  const handleLogout = () => {
    authService.logout()
    window.location.href = '/login'
  }

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id)
      setCopiedUserId(true)
      setTimeout(() => setCopiedUserId(false), 2000)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      
      {/* Identity Summary Banner */}
      <Card className="bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar 
              name={user.name || user.email} 
              src={user.avatarUrl} 
              className="h-14 w-14 text-xl border border-slate-200 dark:border-slate-700 shadow-sm"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {user.name || 'Engineer'}
                </h3>
                {user.role && (
                  <Badge variant="default" className="text-xs uppercase px-2 py-0.5">
                    {user.role}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            {currentOrganization && (
              <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium">
                Workspace: {currentOrganization.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Verified Account
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <User className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Update your display name, developer handle, and account identifiers.
                </CardDescription>
              </div>
            </div>
            {profileSuccess && (
              <Badge variant="success" className="gap-1.5 py-1 px-2.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Profile Saved
              </Badge>
            )}
          </div>
        </CardHeader>

        <form onSubmit={handleProfileUpdate}>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
              
              <div className="space-y-1.5">
                <label htmlFor="profile-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <Input 
                  id="profile-name"
                  value={profileData.name} 
                  onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                  placeholder="e.g. Alex Morgan"
                  className="bg-white dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="profile-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Primary Email Address
                </label>
                <Input 
                  id="profile-email"
                  value={profileData.email} 
                  disabled
                  className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs"
                />
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                  <Info className="h-3 w-3" />
                  Primary authentication email. Alternate commit emails can be added under Email Aliases.
                </p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  User Account ID (UUID)
                </label>
                <div className="flex items-center gap-2 max-w-md">
                  <Input 
                    value={user.id} 
                    readOnly 
                    disabled 
                    className="font-mono text-xs bg-slate-50 dark:bg-slate-900 text-slate-500"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={copyUserId}
                    className="shrink-0 gap-1.5"
                  >
                    {copiedUserId ? (
                      <>
                        <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="text-xs">Copy ID</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

            </div>
          </CardContent>

          <CardFooter className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 py-3.5 flex justify-end">
            <Button type="submit" isLoading={updateProfileMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" /> Save Profile
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Security & Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Security & Password</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Update account password and review credential security.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handlePasswordUpdate}>
          <CardContent className="space-y-4">
            
            {passwordError && (
              <div className="p-3 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800/30 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{passwordError}</span>
              </div>
            )}

            {updatePasswordMutation.isSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-800/30 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Password changed successfully.</span>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
              
              <div className="space-y-1.5">
                <label htmlFor="current-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Current Password
                </label>
                <Input 
                  id="current-password"
                  type="password"
                  value={passwordData.currentPassword} 
                  onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                  className="bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="new-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <Input 
                  id="new-password"
                  type="password"
                  value={passwordData.newPassword} 
                  onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  placeholder="Min. 8 characters"
                  className="bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Confirm New Password
                </label>
                <Input 
                  id="confirm-password"
                  type="password"
                  value={passwordData.confirmPassword} 
                  onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  className="bg-white dark:bg-slate-900 text-xs"
                />
              </div>

            </div>

          </CardContent>

          <CardFooter className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 py-3.5 flex justify-end">
            <Button type="submit" isLoading={updatePasswordMutation.isPending} className="gap-2" variant="outline">
              <Key className="h-4 w-4" /> Update Password
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Account Session & Termination */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Active Session & Sign Out</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Manage your active authentication token and device session.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Signed in as <span className="font-semibold text-slate-900 dark:text-white">{user.email}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ending your session invalidates the current JWT refresh token on this client.
              </p>
            </div>
            <Button 
              variant="secondary" 
              className="shrink-0 gap-1.5"
              onClick={() => setIsLogoutConfirmOpen(true)}
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logout Dialog */}
      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        description="Are you sure you want to sign out? You will need to re-authenticate with your credentials to access your organizations."
        confirmText="Sign Out"
      />

    </div>
  )
}
