import { LanguageKeysBase } from '../languageKeys.base';

export const englishValues: LanguageKeysBase = {
  camera: {
    actorLog: {
      created: 'دوربین با نام {0} ایجاد شد',
      deleted: 'دوربین با نام {0} حذف شد',
      nameUpdated: 'نام دوربین از {0} به {1} تغییر یافت',
      recoveredFromTrash: 'دوربین با نام {0} از سطل بازیافت بازیابی شد',
      activated: 'دوربین با نام {0} فعال شد',
      inactivated: 'دوربین با نام {0} غیرفعال شد',
    },
    systemLog: {
      creationFailed: 'عملیات ایجاد دوربین {0} با خطا مواجه شد',
      updateFailed: 'عملیات به‌روزرسانی دوربین {0} با خطا مواجه شد',
      deletionFailed: 'عملیات حذف دوربین {0} با خطا مواجه شد',
    },
    response: {
      socket: {
        created: 'دوربین ایجاد شد',
        updated: 'دوربین به‌روزرسانی شد',
        deleted: 'دوربین حذف شد',
        activated: 'دوربین فعال شد',
        inactivated: 'دوربین غیرفعال شد',
        softDeleted: 'دوربین به سطل بازیافت منتقل شد',
        hardDeleted: 'Camera deleted',
        multiHardDeleted: 'Cameras deleted',
      },
    },
    errorResponse: {
      badRequest: {
        nameIsDuplicated: 'نام دوربین تکراری است',
        isInactive: 'دوربین غیرفعال است',
        liveSignalIsDisconnected: 'سیگنال سلامت دوربین قطع شده است',
        doesNotExists: 'دوربین وجود ندارد',
        hasAlreadyActivated: 'دوربین هم اکنون فعال است',
        hasAlreadyInactivated: 'دوربین هم اکنون غیرفعال است',
        hasNoChange: 'هیچ تغییری در وضعیت دوربین ها اعمال نشد',
        autoRegisterTimeout:
          'زمان اعمال تغییرات به پایان رسید. لطفاً مجدداً تلاش کنید',
      },
    },
  },
  employee: {
    actorLog: {
      added: 'User with phone number {0} was added to workspace',
      deleted: 'User with phone number {0} was removed from workspace',
      recovered: 'User with phone number {0} was restored from trash',
      softDeleted: 'User with phone number {0} was moved to trash',
      rolesUpdated: 'Access levels for user with phone number {0} were updated',
    },
    response: {
      http: {
        added: 'User added to workspace',
        deleted: 'User removed from workspace',
        rolesUpdated: 'User access levels updated',
        recovered: 'User restored',
        softDeleted: 'User moved to trash',
      },
    },
    errorResponse: {
      badRequest: {
        softDeleted: 'User is in trash',
        alreadyAddedToWorkspace: 'User is already a workspace member',
        canNotUpdateSoftDeletedEmployees: 'Cannot update users in trash',
        onlySoftDeletedEmployeesCouldBeRecovered:
          'Only users in trash can be restored',
        onlySoftDeletedEmployeesCouldBeHardDeleted:
          'Only users in trash can be permanently deleted',
        shouldRecoverEmployeeFromTrashBeforeActivation:
          'To reactivate, please restore user from trash',
        inactiveDependentRulechainsBeforeSoftDelete:
          'Please first deactivate rulechains dependent on this user',
      },
    },
  },
  smsNotifier: {
    actorLog: {
      added: 'Notification settings for user {0} were registered',
      updated: 'Notification settings for user {0} were updated',
      deleted: 'Notification settings for user {0} were deleted',
    },
    response: {
      http: {
        added: 'Notification settings registered',
        updated: 'Notification settings updated',
        deleted: 'Notification settings deleted',
      },
    },
    errorResponse: {
      badRequest: {
        alreadyExists: 'Notification settings already exist for this user',
        doesNotExists: 'No settings exist with this ID',
        phoneNumberShouldBelongToWorkspaceEmployees:
          'Phone number must belong to workspace employees',
      },
    },
  },
  tenant: {
    actorLog: {
      nameUpdated: 'Tenant name was updated',
    },
    response: {
      http: {
        added: 'Tenant was created',
        deleted: 'Tenant was deleted',
        updated: 'Tenant was updated',
      },
    },
    errorResponse: {
      badRequest: {
        nameIsDuplicated: 'Tenant name is duplicated',
      },
    },
  },
  nvr: {
    actorLog: {
      created: 'nvr با نام {0} (سریال {1}) ثبت شد',
      deleted: 'nvr با نام {0} (سریال {1}) حذف شد',
      active: 'nvr با نام {0} (سریال {1}) فعال شد',
      inactive: 'nvr با نام {0} (سریال {1}) غیرفعال شد',
      nameUpdated: 'نام nvr از {0} به {2} (سریال {1}) تغییر یافت',
      passwordUpdated: 'رمز عبور nvr {0} (سریال {1}) تغییر کرد',
      langUpdated: {
        toFa: 'زبان nvr {0} (سریال {1}) به فارسی تغییر یافت',
        toEn: 'زبان nvr {0} (سریال {1}) به انگلیسی تغییر یافت',
        toAr: 'زبان nvr {0} (سریال {1}) به عربی تغییر یافت',
        toKu: 'زبان nvr {0} (سریال {1}) به کردی تغییر یافت',
      },
    },
    systemLog: {
      updateFailed: 'عملیات به‌روزرسانی nvr {0} با خطا مواجه شد',
      activationFailed: 'عملیات فعال‌سازی nvr {0} با خطا مواجه شد',
      inactivationFailed: 'عملیات غیرفعال‌سازی nvr {0} با خطا مواجه شد',
      liveSignalFailed: 'سیگنال سلامت nvr {0} با خطا مواجه شد',
      recoverySucceeded: 'nvr {0} بازیابی شد',
    },
    response: {
      socket: {
        created: 'nvr ثبت شد',
        updated: 'nvr به‌روزرسانی شد',
        deleted: 'nvr حذف شد',
        activated: 'nvr فعال شد',
        inactivated: 'nvr غیرفعال شد',
        startAutoRegisterProccessing: 'درخواست ارسال شد',
        allConnectedCamerasAreUpToDate: 'تمام اکسس پوینت‌های متصل به‌روز هستند',
        multiCameraInactivated: 'چند دوربین غیرفعال شدند',
        multiCameraActivated: 'چند دوربین فعال شدند',
      },
    },
    errorResponse: {
      badRequest: {
        isNotActive: 'nvr فعال نیست',
        nameIsDuplicated: 'نام nvr تکراری است',
        liveSignalFailed: 'سیگنال سلامت nvr قطع شده است',
        hasAlreadyActivated: 'nvr هم‌اکنون فعال است',
        hasAlreadyInactivated: 'nvr هم‌اکنون غیرفعال است',
        duplicatedNvr: 'nvr هم‌اکنون در میزکار ثبت شده است',
        camerasExceedsNvrCapacity:
          'تعداد دوربین های متصل به nvr بیش از حد مجاز است',
      },
    },
  },
  dashboard: {
    actorLog: {
      created: 'A page named {0} was created',
      deleted: 'A page named {0} was deleted',
      nameUpdated: 'Page name changed from {0} to {1}',
      contentUpdated: 'Content of page named {1} was updated',
      pageIndexUpdated: 'Page order for page named {0} was updated',
    },
    systemLog: {
      deletionFailed: 'Page deletion operation for page {0} failed',
      updateFailed: 'Page update operation for page {0} failed',
      createFailed: 'Page creation operaton for page {0} failed',
    },
    response: {
      http: {
        created: 'Page created',
        updated: 'Page updated',
      },
      socket: {
        created: 'Page created',
        updated: 'Page updated',
        deleted: 'Page deleted',
      },
    },
    errorResponse: {
      badRequest: {
        notExists: 'No page exists with this ID',
        nameIsDuplicated: 'Page name is duplicated',
      },
    },
  },
  others: {
    errorResponse: {
      badRequest: {
        wrongPassword: 'رمز عبور نامعتبر است',
        accessDenied: 'دسترسی غیرمجاز',
        invalidInput: 'ورودی نامعتبر',
        invalidRequest: 'درخواست نامعتبر',
        invalidCmdStructures: 'فرمت داده ارسالی نامعتبر است',
        configIsRunning: 'پیکربندی در حال اجراست',
      },
    },
    geo: {
      lat: 'طول',
      lng: 'عرض',
      alt: 'ارتفاع',
    },
    time: 'زمان',
    true: 'صحیح',
    false: 'غلط',
    internalServerError: 'خطای داخلی سرور رخ داد',
  },
};

export const englishSystemLogSections = {
  SYSTEM_LOG_SECTION_DEVICE_LIVE_SIGNAL: 'سیگنال سلامت',
  SYSTEM_LOG_SECTION_DEVICE_CONFIG: 'تنظیمات تجهیز',
  SYSTEM_LOG_SECTION_DEVICE_DATA: 'داده تجهیز',
  SYSTEM_LOG_SECTION_RULE_CHAIN: 'زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_CATEGORY: 'دسته بندی زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_STORAGE_NODE: 'نود ذخیره زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_NODE: 'نود زنجیره قواعد',
};

export const englishReportFields = {
  EMPLOYEE: 'کارمند',
  RULE_CHAIN: 'زنجیره قواعد',
  EXPOSED_REST_API: 'وب سرویس',
  createdAt: 'تاریخ',
  actorLogType: 'اکتور',
  actorId: 'شناسه اکتور',
  messageKey: 'توضیحات',
};
