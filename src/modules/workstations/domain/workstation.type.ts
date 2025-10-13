import { Name } from 'src/modules/shared/valueObjects/name.vo';

export interface WorkstationValueObjects {
  name: Name;
}

export interface WorkstationProps {
  name: string;
}

export interface CreateWorkstationProps {
  name: string;
}

export interface UpdateWorkstationProps {
  name?: string;
}

export type WorkstationLanguageKeys = {
  workstation: {
    actorLog: {
      nameUpdated: string;
    };
    response: {
      http: {
        added: string;
        deleted: string;
        updated: string;
      };
    };
    errorResponse: {
      badRequest: {
        nameIsDuplicated: string;
      };
    };
  };
};
