import { BusinessId } from 'src/dddLib/core/businessId.vo';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { DefaultTimezone } from './valueObjects/defaultTimezone.vo';
import { Slug } from './valueObjects/slug.vo';
import { TenantStatus, TenantStatuses } from './valueObjects/tenantStatus.vo';

export interface TenantValueObjects {
  readonly ownerId: BusinessId;
  name: Name;
  slug: Slug;
  status: TenantStatus;
  defaultTimezone: DefaultTimezone;
}

export interface TenantProps {
  ownerId: string;
  name: string;
  slug: string;
  status: TenantStatuses;
  defaultTimezone: string;
}

export interface CreateTenantProps {
  ownerId: string;
  name: string;
  slug: string;
  status: TenantStatuses;
  defaultTimezone: string;
}

export interface UpdateTenantProps {
  name?: string;
  slug?: string;
  status?: TenantStatuses;
  defaultTimezone?: string;
}

export type TenantLanguageKeys = {
  tenant: {
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
