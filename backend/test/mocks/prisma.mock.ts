import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Creates a mock model object with standard Prisma CRUD operations.
 */
const createMockModel = () => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
});

export type MockPrismaService = {
  [K in keyof PrismaService]: PrismaService[K] extends (...args: any[]) => any
    ? jest.Mock
    : ReturnType<typeof createMockModel>;
};

/**
 * Generates a full mock of PrismaService for unit and integration testing.
 */
export const createMockPrismaService = () => ({
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn((callback: any) =>
    typeof callback === 'function' ? callback(createMockPrismaService()) : Promise.resolve(callback),
  ),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),

  // Models
  organization: createMockModel(),
  user: createMockModel(),
  organizationMember: createMockModel(),
  invitation: createMockModel(),
  emailAlias: createMockModel(),
  unmappedEmail: createMockModel(),
  refreshToken: createMockModel(),
  gitHubConnection: createMockModel(),
  repository: createMockModel(),
  fileASTMetric: createMockModel(),
  webhookLog: createMockModel(),
  webhookIdempotency: createMockModel(),
  pullRequest: createMockModel(),
  issue: createMockModel(),
  gitHubRelease: createMockModel(),
  commitComment: createMockModel(),
  webhookRateLimit: createMockModel(),
  commit: createMockModel(),
  fileChange: createMockModel(),
  dQSScore: createMockModel(),
  sQSScore: createMockModel(),
  team: createMockModel(),
  teamMembership: createMockModel(),
  project: createMockModel(),
  projectRepository: createMockModel(),
  teamProjectAssignment: createMockModel(),
  review: createMockModel(),
  reviewComment: createMockModel(),
  sprint: createMockModel(),
  sprintReport: createMockModel(),
  release: createMockModel(),
  releaseSprintAssociation: createMockModel(),
  releaseTelemetryAnalysis: createMockModel(),
  sprintGoal: createMockModel(),
  sprintRetrospective: createMockModel(),
  sprintCarryOver: createMockModel(),
  notification: createMockModel(),
  notificationPreference: createMockModel(),
  digestQueue: createMockModel(),
  alert: createMockModel(),
  alertThresholdConfig: createMockModel(),
  goal: createMockModel(),
  goalKeyResult: createMockModel(),
  goalProgressLog: createMockModel(),
  goalTemplate: createMockModel(),
  debtItem: createMockModel(),
  debtResolutionLog: createMockModel(),
  coverageReport: createMockModel(),
  coverageFile: createMockModel(),
  auditLog: createMockModel(),
  auditRetentionPolicy: createMockModel(),
  onboarding: createMockModel(),
  onboardingChecklistItem: createMockModel(),
});
