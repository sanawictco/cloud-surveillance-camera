import { LanguageKeysBase } from '../languageKeys.base';

export const farsiValues: LanguageKeysBase = {
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
      added: 'کاربری با شماره تلفن {0} به میزکار اضافه شد',
      deleted: 'کاربری با شماره تلفن {0} از میزکار حذف شد',
      recovered: 'کاربری با شماره تلفن {0} از سطل بازیافت بازیابی شد',
      softDeleted: 'کاربری با شماره تلفن {0} به سطل بازیافت منتقل شد',
      rolesUpdated: 'سطوح دسترسی کاربری با شماره تلفن {0} به‌روزرسانی شد',
    },
    response: {
      http: {
        added: 'کاربر به میزکار اضافه شد',
        deleted: 'کاربر از میزکار حذف شد',
        rolesUpdated: 'سطوح دسترسی کاربر به‌روزرسانی شد',
        recovered: 'کاربر بازیابی شد',
        softDeleted: 'کاربر به سطل بازیافت منتقل شد',
      },
    },
    errorResponse: {
      badRequest: {
        softDeleted: 'کاربر در سطل بازیافت قرار دارد',
        alreadyAddedToWorkspace: 'کاربر هم‌اکنون عضو میزکار است',
        canNotUpdateSoftDeletedEmployees:
          'امکان به‌روزرسانی کاربران در سطل بازیافت وجود ندارد',
        onlySoftDeletedEmployeesCouldBeRecovered:
          'فقط کاربران موجود در سطل بازیافت قابل بازیابی هستند',
        onlySoftDeletedEmployeesCouldBeHardDeleted:
          'فقط کاربران موجود در سطل بازیافت قابل حذف کامل هستند',
        shouldRecoverEmployeeFromTrashBeforeActivation:
          'برای فعال‌سازی مجدد، کاربر را از سطل بازیافت بازیابی کنید',
        inactiveDependentRulechainsBeforeSoftDelete:
          'لطفاً ابتدا زنجیره‌های قواعد وابسته به این کاربر را غیرفعال کنید',
      },
    },
  },
  smsNotifier: {
    actorLog: {
      added: 'تنظیمات اطلاع‌رسانی برای کاربر {0} ثبت شد',
      updated: 'تنظیمات اطلاع‌رسانی برای کاربر {0} به‌روزرسانی شد',
      deleted: 'تنظیمات اطلاع‌رسانی برای کاربر {0} حذف شد',
    },
    response: {
      http: {
        added: 'تنظیمات اطلاع‌رسانی ثبت شد',
        updated: 'تنظیمات اطلاع‌رسانی به‌روزرسانی شد',
        deleted: 'تنظیمات اطلاع‌رسانی حذف شد',
      },
    },
    errorResponse: {
      badRequest: {
        alreadyExists: 'تنظیمات اطلاع‌رسانی برای این کاربر قبلاً ثبت شده است',
        doesNotExists: 'تنظیماتی با این شناسه وجود ندارد',
        phoneNumberShouldBelongToWorkspaceEmployees:
          'شماره تلفن باید متعلق به کارکنان میزکار باشد',
      },
    },
  },
  tenant: {
    actorLog: {
      nameUpdated: 'نام مستاجر به‌روزرسانی شد',
    },
    response: {
      http: {
        added: 'مستاجر ایجاد شد',
        deleted: 'مستاجر حذف شد',
        updated: 'مستاجر به‌روزرسانی شد',
      },
    },
    errorResponse: {
      badRequest: {
        nameIsDuplicated: 'نام مستاجر تکراری است',
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
      created: 'صفحه‌ای با نام {0} ایجاد شد',
      deleted: 'صفحه‌ای با نام {0} حذف شد',
      nameUpdated: 'نام صفحه از {0} به {1} تغییر یافت',
      contentUpdated: 'محتوای صفحه با نام {1} به‌روزرسانی شد',
      pageIndexUpdated: 'ترتیب صفحه با نام {0} به‌روزرسانی شد',
    },
    systemLog: {
      deletionFailed: 'عملیات حذف صفحه {0} با خطا مواجه شد',
      updateFailed: 'عملیات به‌روزرسانی صفحه {0} با خطا مواجه شد',
      createFailed: 'عملیات ایجاد صفحه {0} با خطا مواجه شد',
    },
    response: {
      http: {
        created: 'صفحه ایجاد شد',
        updated: 'صفحه به‌روزرسانی شد',
      },
      socket: {
        created: 'صفحه ایجاد شد',
        updated: 'صفحه به‌روزرسانی شد',
        deleted: 'صفحه حذف شد',
      },
    },
    errorResponse: {
      badRequest: {
        notExists: 'صفحه‌ای با این شناسه وجود ندارد',
        nameIsDuplicated: 'نام صفحه تکراری است',
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

export const farsiSystemLogSections = {
  SYSTEM_LOG_SECTION_DEVICE_LIVE_SIGNAL: 'سیگنال سلامت',
  SYSTEM_LOG_SECTION_DEVICE_CONFIG: 'تنظیمات تجهیز',
  SYSTEM_LOG_SECTION_DEVICE_DATA: 'داده تجهیز',
  SYSTEM_LOG_SECTION_RULE_CHAIN: 'زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_CATEGORY: 'دسته بندی زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_STORAGE_NODE: 'نود ذخیره زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_NODE: 'نود زنجیره قواعد',
};

export const farsiReportFields = {
  EMPLOYEE: 'کارمند',
  RULE_CHAIN: 'زنجیره قواعد',
  EXPOSED_REST_API: 'وب سرویس',
  createdAt: 'تاریخ',
  actorLogType: 'اکتور',
  actorId: 'شناسه اکتور',
  messageKey: 'توضیحات',
};
