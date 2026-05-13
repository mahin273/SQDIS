# Frontend API Client Setup

Complete Axios-based API client for the SQDIS React frontend with JWT authentication, automatic token refresh, and TypeScript support.

## 📁 Project Structure

```
frontend/src/
├── services/
│   ├── apiClient.ts         # Axios instance with interceptors
│   ├── authApi.ts           # Auth API endpoints
│   ├── organizationsApi.ts  # Organizations API endpoints
│   ├── auditLogsApi.ts      # Audit Logs API endpoints
│   └── index.ts             # Centralized exports
├── hooks/
│   └── useApi.ts            # Custom React hooks for API calls
├── types/
│   └── api.types.ts         # TypeScript type definitions
└── examples/
    └── apiExamples.tsx      # Usage examples
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create a `.env` file (or copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env`:
```
REACT_APP_API_URL=http://localhost:3000
```

### 3. Start the Frontend

```bash
npm run dev
```

## 📚 Usage Guide

### Authentication Flow

#### Login Example

```typescript
import { authApi } from '@/services';

const handleLogin = async () => {
  try {
    const response = await authApi.login({
      email: 'user@example.com',
      password: 'password123',
    });
    console.log('User:', response.user);
    // Tokens are automatically stored in localStorage
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

#### Using the `useApi` Hook

```typescript
import { useApi, authApi } from '@/services';

function LoginComponent() {
  const { data, loading, error, call } = useApi(authApi.login);

  const handleLogin = async (credentials) => {
    const result = await call(credentials);
    if (result) {
      // Login successful
    }
  };

  return (
    <div>
      <button onClick={() => handleLogin({...})} disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

### Token Management

Tokens are automatically managed:
- **Login/Register**: Tokens stored in `localStorage`
- **API Requests**: Access token attached to all requests via `Authorization` header
- **Token Refresh**: Automatic refresh on 401 response
- **Logout**: Tokens cleared from storage

```typescript
import { authApi } from '@/services';

// Logout
await authApi.logout(); // Clears tokens and redirects to login

// Check authentication
if (authApi.isAuthenticated()) {
  // User is logged in
}

// Check if token expired
if (authApi.isTokenExpired()) {
  // Token needs refresh or re-login
}
```

### Using API Clients

#### Auth API

```typescript
import { authApi } from '@/services';

// Get current user
const user = await authApi.getProfile();

// Refresh token manually
const tokens = await authApi.refreshToken({
  refreshToken: localStorage.getItem('refreshToken'),
});

// Password reset
await authApi.forgotPassword({ email: 'user@example.com' });
await authApi.resetPassword({
  token: 'reset-token',
  newPassword: 'newpassword123',
});

// OAuth
const googleUrl = await authApi.getGoogleAuthUrl();
const githubUrl = await authApi.getGitHubAuthUrl();
```

#### Organizations API

```typescript
import { organizationsApi } from '@/services';

// Get all organizations
const orgs = await organizationsApi.getAll();

// Create organization
const newOrg = await organizationsApi.create({
  name: 'My Company',
  description: 'Company description',
});

// Get organization members
const members = await organizationsApi.getMembers(orgId);

// Invite user
const invitation = await organizationsApi.inviteUser(orgId, {
  email: 'newuser@example.com',
  role: 'MEMBER',
});

// Update member role
await organizationsApi.updateMember(orgId, userId, {
  role: 'ADMIN',
});

// Remove member
await organizationsApi.removeMember(orgId, userId);
```

#### Audit Logs API

```typescript
import { auditLogsApi } from '@/services';

// Get audit logs with filters
const logs = await auditLogsApi.getAll({
  organizationId: 'org-123',
  page: 1,
  limit: 20,
  severity: 'HIGH',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});

// Get specific log
const log = await auditLogsApi.getById(logId);

// Export audit logs
const exportJob = await auditLogsApi.export({
  organizationId: 'org-123',
  format: 'CSV',
  startDate: '2024-01-01',
});

// Check export status
const exportStatus = await auditLogsApi.getExport(exportId);

// Get analytics
const actionCounts = await auditLogsApi.getActionCounts('org-123');
const activeUsers = await auditLogsApi.getActiveUsers('org-123');
const timeline = await auditLogsApi.getTimeline('org-123', {
  granularity: 'day',
});

// GDPR operations
const userData = await auditLogsApi.getGDPRDataAccess(userId);
await auditLogsApi.anonymizeUserData(userId);

// Compliance report
const report = await auditLogsApi.generateComplianceReport({
  organizationId: 'org-123',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});
```

### Advanced: Using `useMutation` Hook

For mutations (POST, PUT, PATCH, DELETE):

```typescript
import { useMutation, organizationsApi } from '@/services';

function CreateOrgForm() {
  const { mutate, loading, error, data } = useMutation(
    organizationsApi.create
  );

  const handleSubmit = async (formData) => {
    const result = await mutate(formData);
    if (result) {
      console.log('Created:', result);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={loading}>
        {loading ? 'Creating...' : 'Create'}
      </button>
      {error && <p>{error.message}</p>}
      {data && <p>Success!</p>}
    </form>
  );
}
```

### Error Handling

All API calls return or throw `ApiError` with:
- `message`: Human-readable error message
- `statusCode`: HTTP status code
- `error`: Error type/code
- `details`: Additional error details

```typescript
try {
  await authApi.login(credentials);
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  }
}

// Using hook
const { error } = useApi(authApi.login);
if (error) {
  console.error(`[${error.statusCode}] ${error.message}`, error.details);
}
```

## 🔐 Security

- **Token Storage**: JWT tokens stored in `localStorage`
- **Auto-Refresh**: 401 responses automatically trigger token refresh
- **Authorization Header**: Tokens automatically attached to requests
- **CORS**: Handled automatically by Axios
- **XSS Protection**: Use React's built-in escaping, avoid `dangerouslySetInnerHTML`

## 🛠️ TypeScript Support

All API clients and types are fully typed:

```typescript
import {
  User,
  Organization,
  AuditLog,
  LoginRequest,
  LoginResponse,
  // ... all types exported from api.types.ts
} from '@/services';

// Full type safety
const handleLogin = async (creds: LoginRequest): Promise<LoginResponse> => {
  return await authApi.login(creds);
};
```

## 📋 Type Definitions

### Common Types

- `User`: User profile with role and metadata
- `Organization`: Organization data
- `AuditLog`: Audit log entry
- `ApiError`: API error response
- `AuthTokens`: JWT tokens (access + refresh)

### Enums

- `UserRole`: ADMIN, USER, VIEWER
- `MemberRole`: OWNER, ADMIN, MEMBER
- `AuditAction`: CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT
- `AuditStatus`: SUCCESS, FAILURE, PENDING
- `AuditSeverity`: LOW, MEDIUM, HIGH, CRITICAL
- `ExportFormat`: CSV, JSON, PDF
- `ExportStatus`: PENDING, COMPLETED, FAILED, EXPIRED

## 🐛 Troubleshooting

### "No refresh token available"
- Make sure you're logged in before making API calls
- Check that `localStorage` is not disabled

### CORS errors
- Ensure backend is running at `REACT_APP_API_URL`
- Check CORS headers in backend configuration

### 401 errors
- Token may have expired; the client will auto-refresh
- If refresh fails, you'll be redirected to login
- Check that refresh endpoint is working

### TypeScript errors
- Run `npm run build` to check for type errors
- Check that all API responses match the type definitions

## 📖 Documentation

- [Axios Documentation](https://axios-http.com/)
- [React Hooks Documentation](https://react.dev/reference/react)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Integration with Components

Example: Dashboard with Authentication Check

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/services';
import { useApi } from '@/hooks/useApi';

export function Dashboard() {
  const navigate = useNavigate();
  const { data: user, loading, call: getProfile } = useApi(authApi.getProfile);

  useEffect(() => {
    if (!authApi.isAuthenticated()) {
      navigate('/login');
      return;
    }
    getProfile();
  }, []);

  if (loading) return <p>Loading profile...</p>;
  if (!user) return <p>Failed to load profile</p>;

  return (
    <div>
      <h1>Welcome, {user.firstName}!</h1>
      {/* Dashboard content */}
    </div>
  );
}
```

## 🚀 Next Steps

1. **Connect to Backend**: Ensure backend is running and `REACT_APP_API_URL` is correct
2. **Test Login**: Use the LoginExample component to test authentication
3. **Build Features**: Use the API clients to build your app features
4. **Handle Errors**: Implement proper error handling and user feedback
5. **Deploy**: Build frontend and backend, deploy to production

```bash
# Build for production
npm run build
```

---

**Happy Coding! 🎉**
