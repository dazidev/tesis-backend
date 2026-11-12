import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAccessStrategy } from '../src/modules/auth/strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from '../src/modules/auth/strategies/jwt-refresh.strategy';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { ProcessesController } from '../src/modules/processes/processes.controller';
import { ProcessesService } from '../src/modules/processes/processes.service';
import { MobileProcessesController } from '../src/modules/processes/mobile-processes.controller';
import { FolderController } from '../src/modules/folder/folder.controller';
import { FolderService } from '../src/modules/folder/folder.service';
import { TaskController } from '../src/modules/task/task.controller';
import { TaskService } from '../src/modules/task/task.service';
import { LogsController } from '../src/modules/logs/logs.controller';
import { LogsService } from '../src/modules/logs/logs.service';
import { UserController } from '../src/modules/user/user.controller';
import { UserService } from '../src/modules/user/user.service';
import { AdminController } from '../src/modules/admin/admin.controller';
import { AdminService } from '../src/modules/admin/admin.service';

jest.mock('uuid', () => ({ v4: () => 'test-refresh-nonce' }));

describe('Web and mobile access and existing permissions', () => {
  let app: INestApplication;
  let filesRoot: string;
  const resourceId = '11111111-1111-4111-8111-111111111111';
  const password = 'MobileAccessTest123!';
  const users = ['lawyer', 'client', 'admin', 'inactive'].map((role) => ({
    id: role,
    email: `${role}@example.test`,
    name: role,
    lastname: 'Test',
    roles: role === 'inactive' ? ['lawyer'] : [role],
    status: role === 'inactive' ? 'inactive' : 'active',
    password: bcrypt.hashSync(password, 4),
  }));
  const sessions = new Map<string, Record<string, unknown>>();
  const creationTransaction = {
    defendant: {
      create: jest.fn(async () => ({ id: resourceId })),
    },
    process: {
      create: jest.fn(async ({ data }) => ({ id: resourceId, ...data })),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (operation) =>
      operation({
        ...creationTransaction,
        user: prisma.user,
        $queryRaw: jest.fn(async () => []),
      }),
    ),
    user: {
      findFirst: jest.fn(async (_query: unknown): Promise<unknown> => null),
      findMany: jest.fn(async ({ where, select }) =>
        users
          .filter((user) => user.roles.includes(where.roles.has))
          .map((user) =>
            Object.fromEntries(
              Object.keys(select).map((key) => [key, user[key]]),
            ),
          ),
      ),
      findUnique: jest.fn(async ({ where }) =>
        users.find((user) =>
          where.email ? user.email === where.email : user.id === where.id,
        ),
      ),
    },
    userSession: {
      create: jest.fn(async ({ data }) => {
        const session = {
          ...data,
          id: `session-${sessions.size}`,
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
    process: {
      findMany: jest.fn(async (_query: unknown): Promise<unknown[]> => []),
      findFirst: jest.fn(async (_query: unknown): Promise<unknown> => null),
    },
    digitalFile: {
      findFirst: jest.fn(async (_query: unknown): Promise<unknown> => null),
    },
  };

  beforeAll(async () => {
    filesRoot = await mkdtemp(join(tmpdir(), 'tesis-client-access-'));
    await writeFile(
      join(filesRoot, 'closed-stage.pdf'),
      '%PDF-1.4\nTest document\n',
    );
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
              FILES_DIR: filesRoot,
            }),
          ],
        }),
        JwtModule.register({ secret: 'test-access' }),
        PassportModule,
      ],
      controllers: [
        AuthController,
        ProcessesController,
        MobileProcessesController,
        FolderController,
        TaskController,
        LogsController,
        UserController,
        AdminController,
      ],
      providers: [
        AuthService,
        ProcessesService,
        FolderService,
        JwtAccessStrategy,
        JwtRefreshStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: LogsService, useValue: { create: jest.fn() } },
        { provide: TaskService, useValue: {} },
        UserService,
        { provide: AdminService, useValue: {} },
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
    if (filesRoot) await rm(filesRoot, { recursive: true, force: true });
  });

  const login = (role: string, platform = 'mobile') =>
    request(app.getHttpServer())
      .post(`/api/auth/login-${platform}`)
      .send({
        email: `${role}@example.test`,
        password,
        deviceId: resourceId,
        deviceInfo: 'Automated test',
      });

  it.each(['lawyer', 'client', 'admin'])(
    'allows active %s mobile login, refresh and logout',
    async (role) => {
      const result = await login(role).expect(201);
      expect(result.body.user.roles).toContain(role);
      expect(result.body.user.password).toBeUndefined();
      const refreshed = await request(app.getHttpServer())
        .post('/api/auth/refresh-mobile')
        .send({ refreshToken: result.body.refreshToken })
        .expect(201);
      expect(refreshed.body.user.roles).toContain(role);
      await request(app.getHttpServer())
        .post('/api/auth/logout-mobile')
        .send({ refreshToken: refreshed.body.refreshToken })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/auth/refresh-mobile')
        .send({ refreshToken: refreshed.body.refreshToken })
        .expect(401);
    },
  );

  it('rejects inactive accounts on mobile', async () => {
    await login('inactive').expect(401);
  });

  it.each(['lawyer', 'admin', 'client'])(
    'allows active %s web login, refresh and logout',
    async (role) => {
      const result = await login(role, 'web').expect(201);
      const refreshed = await request(app.getHttpServer())
        .post('/api/auth/refresh-web')
        .send({ refreshToken: result.body.refreshToken })
        .expect(201);
      expect(refreshed.body.user.roles).toContain(role);
      await request(app.getHttpServer())
        .post('/api/auth/logout-web')
        .send({ refreshToken: refreshed.body.refreshToken })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/auth/refresh-web')
        .send({ refreshToken: refreshed.body.refreshToken })
        .expect(401);
    },
  );

  it('rejects inactive accounts on web', async () => {
    await login('inactive', 'web').expect(401);
  });

  it('filters client queries by ProcessClient even with a web session', async () => {
    const result = await login('client', 'web').expect(201);
    await request(app.getHttpServer())
      .get('/api/mobile/processes')
      .auth(result.body.accessToken, { type: 'bearer' })
      .expect(200);
    expect(prisma.process.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          status: { not: 'deleted' },
          linkedClients: { some: { clientId: 'client' } },
        },
      }),
    );
    for (const suffix of ['', '/documents']) {
      await request(app.getHttpServer())
        .get(`/api/mobile/processes/${resourceId}${suffix}`)
        .auth(result.body.accessToken, { type: 'bearer' })
        .expect(404);
      expect(prisma.process.findFirst.mock.calls.at(-1)?.[0]).toMatchObject({
        where: {
          id: resourceId,
          status: { not: 'deleted' },
          linkedClients: { some: { clientId: 'client' } },
        },
      });
    }
  });

  it('checks the linked client before reading a PDF', async () => {
    const result = await login('client', 'web').expect(201);
    await request(app.getHttpServer())
      .get(`/api/folder/file/${resourceId}/view`)
      .auth(result.body.accessToken, { type: 'bearer' })
      .expect(404);
    expect(prisma.digitalFile.findFirst.mock.calls.at(-1)?.[0]).toMatchObject({
      where: {
        id: resourceId,
        deletedAt: null,
        digitalFolder: {
          is: {
            deletedAt: null,
            stage: {
              is: {
                status: { not: 'deleted' },
                process: {
                  is: {
                    status: { not: 'deleted' },
                    OR: [{ linkedClients: { some: { clientId: 'client' } } }],
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  it('serves a linked client PDF from closed containers without allowing edits', async () => {
    const result = await login('client', 'web').expect(201);
    prisma.digitalFile.findFirst.mockResolvedValueOnce({
      id: resourceId,
      name: 'Closed document',
      storagePath: 'closed-stage.pdf',
      mimeType: 'application/pdf',
      digitalFolder: {
        stage: { status: 'closed', process: { managedByID: 'lawyer' } },
        substage: { status: 'closed' },
      },
    });
    await request(app.getHttpServer())
      .get(`/api/folder/file/${resourceId}/view`)
      .auth(result.body.accessToken, { type: 'bearer' })
      .expect(200)
      .expect('Content-Type', 'application/pdf')
      .expect('Cache-Control', 'private, no-store');
    await request(app.getHttpServer())
      .patch(`/api/folder/file/${resourceId}`)
      .auth(result.body.accessToken, { type: 'bearer' })
      .send({ name: 'Changed', description: 'Not allowed' })
      .expect(403);
  });

  it('keeps web clients out of management and administrative endpoints', async () => {
    const result = await login('client', 'web').expect(201);
    for (const path of [
      '/api/processes',
      `/api/processes/${resourceId}`,
      `/api/processes/${resourceId}/clients`,
      '/api/user',
      '/api/logs',
      '/api/logs/filters',
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .auth(result.body.accessToken, { type: 'bearer' })
        .expect(403);
    }
  });

  it('lists only processes managed by the lawyer and checks ownership on detail', async () => {
    const result = await login('lawyer').expect(201);
    await request(app.getHttpServer())
      .get('/api/processes')
      .auth(result.body.accessToken, { type: 'bearer' })
      .expect(200);
    expect(prisma.process.findMany).toHaveBeenLastCalledWith({
      where: { managedByID: 'lawyer', status: { not: 'deleted' } },
    });
    await request(app.getHttpServer())
      .get(`/api/processes/${resourceId}`)
      .auth(result.body.accessToken, { type: 'bearer' })
      .expect(404);
    expect(prisma.process.findFirst.mock.calls.at(-1)?.[0]).toMatchObject({
      where: {
        id: resourceId,
        managedByID: 'lawyer',
        status: { not: 'deleted' },
      },
    });
  });

  it('keeps administrative endpoints inaccessible to the lawyer', async () => {
    const result = await login('lawyer').expect(201);
    for (const path of ['/api/user', '/api/logs', '/api/logs/filters']) {
      await request(app.getHttpServer())
        .get(path)
        .auth(result.body.accessToken, { type: 'bearer' })
        .expect(403);
    }
  });

  it('allows a mobile admin to query all processes without a lawyer ownership filter', async () => {
    const result = await login('admin').expect(201);
    await request(app.getHttpServer())
      .get('/api/processes')
      .auth(result.body.accessToken, { type: 'bearer' })
      .expect(200);
    expect(prisma.process.findMany).toHaveBeenLastCalledWith({ where: {} });
    await request(app.getHttpServer())
      .get(`/api/processes/${resourceId}`)
      .auth(result.body.accessToken, { type: 'bearer' })
      .expect(404);
    const query = prisma.process.findFirst.mock.calls.at(-1)?.[0];
    expect(query).toMatchObject({
      where: { id: resourceId, status: { not: 'deleted' } },
    });
    expect(query).not.toHaveProperty('where.managedByID');
  });

  it('keeps mobile clients out of management and administrative endpoints', async () => {
    const result = await login('client').expect(201);
    for (const path of ['/api/processes', '/api/user', '/api/logs']) {
      await request(app.getHttpServer())
        .get(path)
        .auth(result.body.accessToken, { type: 'bearer' })
        .expect(403);
    }
    await request(app.getHttpServer())
      .post('/api/processes')
      .auth(result.body.accessToken, { type: 'bearer' })
      .send({})
      .expect(403);
  });

  it('returns lawyer status without credentials for the admin responsible picker', async () => {
    const result = await login('admin').expect(201);
    const response = await request(app.getHttpServer())
      .get('/api/user?role=lawyer')
      .auth(result.body.accessToken, { type: 'bearer' })
      .expect(200);
    expect(response.body).toEqual([
      expect.objectContaining({ id: 'lawyer', status: 'active' }),
      expect.objectContaining({ id: 'inactive', status: 'inactive' }),
    ]);
    for (const user of response.body) {
      expect(Object.keys(user).sort()).toEqual(
        ['id', 'name', 'lastname', 'email', 'roles', 'status'].sort(),
      );
    }
  });

  const processInput = {
    caseFileNumber: 'TEST-2026',
    courtNumber: 'Juzgado de prueba',
    type: 'testate',
    defendant: {
      name: 'Persona',
      lastname: 'De prueba',
      birthDate: '1950-01-01T00:00:00.000Z',
      deathDate: '2025-01-01T00:00:00.000Z',
    },
  };

  it('uses the admin account when no responsible lawyer is selected', async () => {
    const result = await login('admin').expect(201);
    const response = await request(app.getHttpServer())
      .post('/api/processes')
      .auth(result.body.accessToken, { type: 'bearer' })
      .send(processInput)
      .expect(201);
    expect(response.body).toMatchObject({
      managedByID: 'admin',
      createdById: 'admin',
      status: 'created',
    });
  });

  it('lets an admin assign a new process to an active lawyer', async () => {
    const result = await login('admin').expect(201);
    prisma.user.findFirst.mockResolvedValueOnce({ id: resourceId });
    const response = await request(app.getHttpServer())
      .post('/api/processes')
      .auth(result.body.accessToken, { type: 'bearer' })
      .send({ ...processInput, managedByID: resourceId })
      .expect(201);
    expect(prisma.user.findFirst).toHaveBeenLastCalledWith({
      where: { id: resourceId, status: 'active', roles: { has: 'lawyer' } },
      select: { id: true },
    });
    expect(response.body).toMatchObject({
      managedByID: resourceId,
      createdById: 'admin',
      status: 'created',
    });
  });

  it('rejects a responsible user who is no longer an active lawyer before creating anything', async () => {
    const result = await login('admin').expect(201);
    const previousCreations =
      creationTransaction.defendant.create.mock.calls.length;
    const response = await request(app.getHttpServer())
      .post('/api/processes')
      .auth(result.body.accessToken, { type: 'bearer' })
      .send({ ...processInput, managedByID: resourceId })
      .expect(400);
    expect(response.body.message).toBe(
      'El responsable seleccionado debe ser un abogado activo.',
    );
    expect(creationTransaction.defendant.create).toHaveBeenCalledTimes(
      previousCreations,
    );
  });

  it('prevents a lawyer from assigning a new process to another user', async () => {
    const result = await login('lawyer').expect(201);
    const previousCreations =
      creationTransaction.defendant.create.mock.calls.length;
    await request(app.getHttpServer())
      .post('/api/processes')
      .auth(result.body.accessToken, { type: 'bearer' })
      .send({ ...processInput, managedByID: resourceId })
      .expect(403);
    expect(creationTransaction.defendant.create).toHaveBeenCalledTimes(
      previousCreations,
    );
  });

  it.each([
    ['post', '/api/processes'],
    ['post', `/api/processes/${resourceId}/init`],
    ['patch', `/api/processes/stage/${resourceId}/close`],
    ['post', `/api/folder/${resourceId}`],
    ['delete', `/api/folder/file/${resourceId}`],
    ['post', `/api/task/${resourceId}`],
    ['post', '/api/admin/user-invitation'],
  ] as const)('web client cannot %s %s', async (method, path) => {
    const result = await login('client', 'web').expect(201);
    await request(app.getHttpServer())
      [method](path)
      .auth(result.body.accessToken, { type: 'bearer' })
      .send({})
      .expect(403);
  });
});
