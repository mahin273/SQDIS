/**
 * Example API Usage
 * Demonstrates how to use the API clients and hooks in React components
 */

import { useState } from 'react';
import { authApi, organizationsApi, auditLogsApi } from '../services';
import type { LoginRequest } from '../services';
import { useApi, useMutation } from '../hooks/useApi';

/**
 * Example: Login Component using useApi hook
 */
export const LoginExample = () => {
  const [credentials, setCredentials] = useState<LoginRequest>({
    email: '',
    password: '',
  });

  // Using custom hook for API call
  const { loading, error, call } = useApi(authApi.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await call(credentials);
    if (result) {
      console.log('Login successful:', result.user);
      // Redirect to dashboard
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={credentials.email}
        onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
        placeholder="Email"
      />
      <input
        type="password"
        value={credentials.password}
        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
        placeholder="Password"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
    </form>
  );
};

/**
 * Example: Using authApi directly without hook (for simple one-off calls)
 */
export const GetProfileExample = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={fetchProfile} disabled={loading}>
        {loading ? 'Loading...' : 'Load Profile'}
      </button>
      {user && <p>Hello, {user.email}</p>}
    </div>
  );
};

/**
 * Example: Audit Logs List with filtering
 */
export const AuditLogsExample = () => {
  const { data: auditLogs, loading, error, call } = useApi(auditLogsApi.getAll);

  const fetchAuditLogs = async () => {
    await call({
      page: 1,
      pageSize: 10,
    });
  };

  return (
    <div>
      <button onClick={fetchAuditLogs} disabled={loading}>
        Load Logs
      </button>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
      {auditLogs && (
        <ul>
          {auditLogs.data.map((log) => (
            <li key={log.id}>
              {log.action} - {log.resourceType} ({log.severity})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Example: Create Organization using useMutation hook
 */
export const CreateOrgExample = () => {
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const { mutate, loading, error, data } = useMutation(organizationsApi.create);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await mutate({
      name: orgName,
      slug: orgSlug,
    });
    if (result) {
      console.log('Organization created:', result);
      setOrgName('');
      setOrgSlug('');
    }
  };

  return (
    <form onSubmit={handleCreateOrg}>
      <input
        type="text"
        value={orgName}
        onChange={(e) => setOrgName(e.target.value)}
        placeholder="Organization name"
      />
      <input
        type="text"
        value={orgSlug}
        onChange={(e) => setOrgSlug(e.target.value)}
        placeholder="Organization slug"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Organization'}
      </button>
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
      {data && <p style={{ color: 'green' }}>Created: {data.name}</p>}
    </form>
  );
};

// Import the API clients are already imported at the top

export default {
  LoginExample,
  GetProfileExample,
  AuditLogsExample,
  CreateOrgExample,
};
