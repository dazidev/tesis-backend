export const LogActions = {
  admin: {
    deactivateUser: 'DEACTIVATE_USER',
  },
  common: {
    invitationUser: 'INVITATION_USER',
  },
  process: {
    create: 'CREATE_PROCESS',
    deactivate: 'DEACTIVATE_PROCESS',
    delete: 'DELETE_PROCESS',
    init: 'INIT_PROCESS',
    stage: {
      create: 'CREATE_STAGE',
      delete: 'DELETE_STAGE',
    },
    substage: {
      create: 'CREATE_SUBSTAGE',
      delete: 'DELETE_SUBSTAGE',
    },
  },
};

export const LogEntities = {
  user: 'USER',
  process: 'PROCESS',
  stage: 'STAGE',
  substage: 'SUBSTAGE',
};
