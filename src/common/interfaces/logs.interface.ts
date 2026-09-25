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
  folder: {
    create: 'CREATE_FOLDER',
    update: 'UPDATE_FOLDER',
    deactivate: 'DEACTIVATE_FOLDER',
    delete: 'DELETE_FOLDER',
  },
  file: {
    create: 'CREATE_FILE',
    view: 'VIEW_FILE',
    download: 'DOWNLOAD_FILE',
    update: 'UPDATE_FILE',
    deactivate: 'DEACTIVATE_FILE',
    delete: 'DELETE_FILE',
  },
  task: {
    create: 'CREATE_TASK',
    update: 'UPDATE_TASK',
    complete: 'COMPLETE_TASK',
    reopen: 'REOPEN_TASK',
    deactivate: 'DEACTIVATE_TASK',
  },
};

export const LogEntities = {
  user: 'USER',
  process: 'PROCESS',
  stage: 'STAGE',
  substage: 'SUBSTAGE',
  folder: 'FOLDER',
  file: 'FILE',
  task: 'TASK',
};
