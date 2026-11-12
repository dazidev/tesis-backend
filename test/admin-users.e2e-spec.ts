import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { Prisma, UserRole, UserStatus } from '../src/generated/prisma/client';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAccessStrategy } from '../src/modules/auth/strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from '../src/modules/auth/strategies/jwt-refresh.strategy';
import { AdminController } from '../src/modules/admin/admin.controller';
import { AdminService } from '../src/modules/admin/admin.service';
import { UserController } from '../src/modules/user/user.controller';
import { UserService } from '../src/modules/user/user.service';
import { ProcessesController } from '../src/modules/processes/processes.controller';
import { ProcessesService } from '../src/modules/processes/processes.service';
import { LogsController } from '../src/modules/logs/logs.controller';
import { LogsService } from '../src/modules/logs/logs.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { BrevoService } from '../src/modules/infrastructure/services/brevo.service';

jest.mock('uuid', () => ({ v4: () => 'admin-users-test-nonce' }));

describe('Administrator user management from web and mobile', () => {
  let app: INestApplication;
  const ids = {
    admin: '11111111-1111-4111-8111-111111111111',
    lawyer: '22222222-2222-4222-8222-222222222222',
    client: '33333333-3333-4333-8333-333333333333',
    otherAdmin: '44444444-4444-4444-8444-444444444444',
    missing: '55555555-5555-4555-8555-555555555555',
  };
  const password = 'AdminUsersTest123!';
  const passwordHash = bcrypt.hashSync(password, 4);
  type TestUser = {
    id: string;
    name: string;
    lastname: string;
    email: string;
    roles: UserRole[];
    status: UserStatus;
    password: string;
  };
  let users: TestUser[];
  let processes: { id: string; managedByID: string; status: string }[];
  let audit: Record<string, unknown>[];
  let invitations: Record<string, unknown>[];
  const sessions = new Map<string, Record<string, unknown>>();
  const select = (record: unknown, fields?: Record<string, boolean>) => {
    if (!record || !fields) return record;
    return Object.fromEntries(
      Object.keys(fields).map((key) => [key, record[key]]),
    );
  };
  const userQueries = {
    findUnique: jest.fn(async ({ where, select: fields }) =>
      select(
        users.find((user) =>
          where.email ? user.email === where.email : user.id === where.id,
        ) ?? null,
        fields,
      ),
    ),
    findMany: jest.fn(async ({ where, select: fields }) =>
      users
        .filter((user) => !where?.roles || user.roles.includes(where.roles.has))
        .map((user) => select(user, fields)),
    ),
    findFirst: jest.fn(async ({ where, select: fields }) =>
      select(
        users.find(
          (user) =>
            (!where.id ||
              (typeof where.id === 'string'
                ? user.id === where.id
                : user.id !== where.id.not)) &&
            (!where.status || user.status === where.status) &&
            (!where.roles || user.roles.includes(where.roles.has)),
        ) ?? null,
        fields,
      ),
    ),
    update: jest.fn(async ({ where, data, select: fields }) => {
      const index = users.findIndex((user) => user.id === where.id);
      if (
        data.email &&
        users.some((user) => user.id !== where.id && user.email === data.email)
      ) {
        throw new Prisma.PrismaClientKnownRequestError('Duplicate email', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['email'] },
        });
      }
      users[index] = { ...users[index], ...data };
      return select(users[index], fields);
    }),
  };
  const processQueries = {
    findFirst: jest.fn(
      async ({ where }) =>
        processes.find(
          (process) =>
            process.managedByID === where.managedByID &&
            where.status.in.includes(process.status),
        ) ?? null,
    ),
    create: jest.fn(async ({ data }) => {
      const process = { id: ids.missing, ...data };
      processes.push(process);
      return process;
    }),
  };
  // Emulate the transaction-scoped advisory lock and rollback, not a real DB.
  // Only calls that acquire a lock are serialized, so assignment/role races are exercised.
  let lockTail = Promise.resolve();
  const prisma = {
    user: userQueries,
    userSession: {
      create: jest.fn(async ({ data }) => {
        const session = {
          id: `session-${sessions.size}`,
          ...data,
          isRevoked: false,
        };
        sessions.set(session.id, session);
        return session;
      }),
      update: jest.fn(async ({ where, data }) => {
        const session = { ...sessions.get(where.id), ...data };
        sessions.set(where.id, session);
        return session;
      }),
      findUnique: jest.fn(async ({ where }) => sessions.get(where.id)),
    },
    userInvitation: { updateMany: jest.fn(async () => ({ count: 1 })) },
    $transaction: jest.fn(async (operation) => {
      let release: (() => void) | undefined;
      let snapshot:
        | {
            users: TestUser[];
            processes: typeof processes;
            audit: typeof audit;
            invitations: typeof invitations;
          }
        | undefined;
      const tx = {
        $queryRaw: async () => {
          if (release) return [];
          const previous = lockTail;
          lockTail = new Promise<void>((resolve) => {
            release = resolve;
          });
          await previous;
          snapshot = structuredClone({ users, processes, audit, invitations });
          return [];
        },
        user: userQueries,
        process: processQueries,
        defendant: { create: async () => ({ id: ids.missing }) },
        log: {
          create: async ({ data }) => {
            audit.push(data);
            return data;
          },
        },
        userInvitation: {
          findFirst: async ({ where }) =>
            invitations.find((item) => item.toEmail === where.toEmail) ?? null,
          create: async ({ data }) => {
            const item = { id: ids.missing, ...data };
            invitations.push(item);
            return item;
          },
        },
      };
      try {
        return await operation(tx);
      } catch (error) {
        if (snapshot) ({ users, processes, audit, invitations } = snapshot);
        throw error;
      } finally {
        release?.();
      }
    }),
  };
  const sendEmail = jest.fn(async () => true);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_ACCESS_SECRET: 'test-access',
              JWT_REFRESH_SECRET: 'test-refresh',
              TIME_ACCESS_TOKEN: '20m',
              TIME_REFRESH_TOKEN: '7d',
              API_LINK: 'https://example.test',
            }),
          ],
        }),
        JwtModule.register({ secret: 'test-access' }),
        PassportModule,
      ],
      controllers: [
        AuthController,
        AdminController,
        UserController,
        ProcessesController,
        LogsController,
      ],
      providers: [
        AuthService,
        AdminService,
        UserService,
        ProcessesService,
        LogsService,
        JwtAccessStrategy,
        JwtRefreshStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: BrevoService, useValue: { sendEmail } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    users = (['admin', 'lawyer', 'client'] as const).map((role) => ({
      id: ids[role],
      name: role,
      lastname: 'Test',
      email: `${role}@example.test`,
      roles: [role],
      status: 'active',
      password: passwordHash,
    }));
    processes = [];
    audit = [];
    invitations = [];
    sessions.clear();
    jest.clearAllMocks();
    lockTail = Promise.resolve();
  });
  const login = async (role = 'admin', platform = 'mobile') =>
    (
      await request(app.getHttpServer())
        .post(`/api/auth/login-${platform}`)
        .send({
          email: `${role}@example.test`,
          password,
          deviceId: ids.admin,
          deviceInfo: 'Automated test',
        })
        .expect(201)
    ).body;
  const input = {
    name: 'Ana',
    lastname: 'Torres',
    email: 'ana@example.test',
    roles: ['lawyer', 'client'],
  };
  const patch = (token: string, id = ids.lawyer, data = input) =>
    request(app.getHttpServer())
      .patch(`/api/admin/users/${id}`)
      .auth(token, { type: 'bearer' })
      .send(data);
  const addAdmin = (status: UserStatus = 'active') =>
    users.push({
      id: ids.otherAdmin,
      name: 'Other',
      lastname: 'Admin',
      email: 'otherAdmin@example.test',
      roles: ['admin'],
      status,
      password: passwordHash,
    });

  it.each(['web', 'mobile'])(
    'edits identity and multiple roles from %s, returning public fields and an audit record',
    async (platform) => {
      const session = await login('admin', platform);
      const result = await patch(session.accessToken, ids.lawyer, {
        ...input,
        name: '  Ana  ',
        email: '  ANA@EXAMPLE.TEST  ',
      }).expect(200);
      expect(result.body).toMatchObject({
        name: 'Ana',
        lastname: 'Torres',
        email: 'ana@example.test',
        roles: ['lawyer', 'client'],
        status: 'active',
      });
      expect(result.body.password).toBeUndefined();
      expect(users.find((user) => user.id === ids.lawyer)?.password).toBe(
        passwordHash,
      );
      expect(audit).toEqual([
        expect.objectContaining({
          userId: ids.admin,
          affected: ids.lawyer,
          entity: 'USER',
          action: 'UPDATE_USER',
        }),
      ]);
    },
  );

  it('never returns credentials in the administrator user list', async () => {
    const session = await login();
    const result = await request(app.getHttpServer())
      .get('/api/user')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(200);
    for (const user of result.body)
      expect(Object.keys(user).sort()).toEqual(
        ['id', 'name', 'lastname', 'email', 'roles', 'status'].sort(),
      );
  });

  it.each(['web', 'mobile'])(
    'rejects user edits by clients and lawyers from %s',
    async (platform) => {
      for (const role of ['client', 'lawyer']) {
        const session = await login(role, platform);
        await patch(session.accessToken).expect(403);
      }
      expect(userQueries.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: '  ' },
    { name: 'x'.repeat(51) },
    { lastname: 'A' },
    { email: 'invalid' },
    { roles: [] },
    { roles: ['unknown'] },
    { roles: ['admin', 'admin'] },
    { password: 'not-allowed' },
    { status: 'active' },
  ])('rejects invalid or unauthorized edit fields: %j', async (invalid) => {
    const session = await login();
    await patch(session.accessToken, ids.lawyer, {
      ...input,
      ...invalid,
    }).expect(400);
    expect(userQueries.update).not.toHaveBeenCalled();
    expect(audit).toHaveLength(0);
  });

  it('rejects duplicate emails without saving identity or role changes', async () => {
    const session = await login();
    await patch(session.accessToken, ids.lawyer, {
      ...input,
      email: 'client@example.test',
    }).expect(409);
    expect(users.find((user) => user.id === ids.lawyer)).toMatchObject({
      name: 'lawyer',
      roles: ['lawyer'],
      email: 'lawyer@example.test',
    });
    expect(audit).toHaveLength(0);
  });

  it('returns not found for a missing user', async () => {
    const session = await login();
    await patch(session.accessToken, ids.missing).expect(404);
  });

  it('prevents demotion or deactivation of the last active administrator', async () => {
    addAdmin('inactive');
    const session = await login();
    const result = await patch(session.accessToken, ids.admin, {
      ...input,
      roles: ['lawyer'],
    }).expect(409);
    expect(result.body.message).toContain('administrador activo');
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${ids.admin}/deactivate`)
      .auth(session.accessToken, { type: 'bearer' })
      .send({ type: 'inactive', reason: 'Motivo de prueba válido' })
      .expect(409);
    expect(userQueries.update).not.toHaveBeenCalled();
  });

  it.each(['created', 'opened'])(
    'prevents removing management access with a %s process',
    async (status) => {
      processes.push({ id: ids.missing, managedByID: ids.lawyer, status });
      const session = await login();
      await patch(session.accessToken, ids.lawyer, {
        ...input,
        roles: ['client'],
      }).expect(409);
      expect(userQueries.update).not.toHaveBeenCalled();
    },
  );

  it('allows removing the lawyer role when the administrator role is retained', async () => {
    processes.push({
      id: ids.missing,
      managedByID: ids.lawyer,
      status: 'opened',
    });
    const session = await login();
    await patch(session.accessToken, ids.lawyer, {
      ...input,
      roles: ['admin'],
    }).expect(200);
  });

  it.each(['closed', 'deleted'])(
    'allows removing lawyer access when only %s processes remain',
    async (status) => {
      processes.push({ id: ids.missing, managedByID: ids.lawyer, status });
      const session = await login();
      await patch(session.accessToken, ids.lawyer, {
        ...input,
        roles: ['client'],
      }).expect(200);
    },
  );

  it('applies edited roles to existing access tokens and refresh responses', async () => {
    addAdmin();
    const original = await login();
    const editor = await login('otherAdmin', 'web');
    await patch(editor.accessToken, ids.admin, {
      ...input,
      roles: ['client'],
    }).expect(200);
    await patch(original.accessToken).expect(403);
    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh-mobile')
      .send({ refreshToken: original.refreshToken })
      .expect(201);
    expect(refreshed.body.user.roles).toEqual(['client']);
    expect(refreshed.body.user.name).toBe('Ana');
  });

  it('preserves an active administrator during concurrent demotions', async () => {
    addAdmin();
    const first = await login();
    const second = await login('otherAdmin');
    const responses = await Promise.all([
      patch(first.accessToken, ids.admin, {
        ...input,
        email: 'one@example.test',
        roles: ['client'],
      }),
      patch(second.accessToken, ids.otherAdmin, {
        ...input,
        email: 'two@example.test',
        roles: ['client'],
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      users.filter(
        (user) => user.status === 'active' && user.roles.includes('admin'),
      ),
    ).toHaveLength(1);
  });

  it('never assigns a pending process to a concurrently demoted lawyer', async () => {
    const session = await login();
    const responses = await Promise.all([
      patch(session.accessToken, ids.lawyer, { ...input, roles: ['client'] }),
      request(app.getHttpServer())
        .post('/api/processes')
        .auth(session.accessToken, { type: 'bearer' })
        .send({
          courtNumber: 'Juzgado de prueba',
          caseFileNumber: 'TEST-2026',
          type: 'testate',
          managedByID: ids.lawyer,
          defendant: {
            name: 'Persona',
            lastname: 'De prueba',
            birthDate: '1950-01-01T00:00:00.000Z',
            deathDate: '2025-01-01T00:00:00.000Z',
          },
        }),
    ]);
    expect([
      [200, 400],
      [409, 201],
    ]).toContainEqual(responses.map((response) => response.status));
    if (processes.length)
      expect(users.find((user) => user.id === ids.lawyer)?.roles).toContain(
        'lawyer',
      );
  });

  it('deactivates a user with an audit entry and rejects their existing session', async () => {
    const admin = await login();
    const lawyer = await login('lawyer');
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${ids.lawyer}/deactivate`)
      .auth(admin.accessToken, { type: 'bearer' })
      .send({ type: 'suspended', reason: 'Motivo de prueba válido' })
      .expect(200);
    expect(users.find((user) => user.id === ids.lawyer)?.status).toBe(
      'suspended',
    );
    expect(audit).toEqual([
      expect.objectContaining({ action: 'DEACTIVATE_USER' }),
    ]);
    await request(app.getHttpServer())
      .post('/api/auth/refresh-mobile')
      .send({ refreshToken: lawyer.refreshToken })
      .expect(401);
  });

  it.each(['admin', 'lawyer', 'client'])(
    'allows the administrator to invite a %s without sending a real email',
    async (role) => {
      const session = await login();
      await request(app.getHttpServer())
        .post('/api/admin/user-invitation')
        .auth(session.accessToken, { type: 'bearer' })
        .send({ toEmail: 'new@example.test', role })
        .expect(201);
      expect(invitations).toEqual([
        expect.objectContaining({
          toEmail: 'new@example.test',
          role,
          processId: null,
        }),
      ]);
      expect(sendEmail).toHaveBeenCalledWith(
        'new@example.test',
        expect.any(String),
        expect.any(String),
      );
    },
  );

  it('includes user editing in the audit filters', async () => {
    const session = await login();
    const result = await request(app.getHttpServer())
      .get('/api/logs/filters')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(200);
    expect(result.body.categories).toContainEqual(
      expect.objectContaining({
        entity: 'USER',
        actions: expect.arrayContaining(['UPDATE_USER']),
      }),
    );
  });
});
