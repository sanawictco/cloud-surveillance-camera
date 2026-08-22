import { LanguageKeysBase } from '../languageKeys.base';

export const arabicValues: LanguageKeysBase = {
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
      added: 'تمت إضافة مستخدم برقم الهاتف {0} إلى مساحة العمل',
      deleted: 'تم حذف مستخدم برقم الهاتف {0} من مساحة العمل',
      recovered: 'تم استعادة مستخدم برقم الهاتف {0} من سلة المحذوفات',
      softDeleted: 'تم نقل مستخدم برقم الهاتف {0} إلى سلة المحذوفات',
      rolesUpdated: 'تم تحديث مستويات صلاحية المستخدم برقم الهاتف {0}',
    },
    response: {
      http: {
        added: 'تمت إضافة المستخدم إلى مساحة العمل',
        deleted: 'تم حذف المستخدم من مساحة العمل',
        rolesUpdated: 'تم تحديث مستويات صلاحية المستخدم',
        recovered: 'تم استعادة المستخدم',
        softDeleted: 'تم نقل المستخدم إلى سلة المحذوفات',
      },
    },
    errorResponse: {
      badRequest: {
        softDeleted: 'المستخدم موجود في سلة المحذوفات',
        alreadyAddedToWorkspace: 'المستخدم عضو بالفعل في مساحة العمل',
        canNotUpdateSoftDeletedEmployees:
          'لا يمكن تحديث المستخدمين في سلة المحذوفات',
        onlySoftDeletedEmployeesCouldBeRecovered:
          'يمكن استعادة المستخدمين الموجودين في سلة المحذوفات فقط',
        onlySoftDeletedEmployeesCouldBeHardDeleted:
          'يمكن حذف المستخدمين الموجودين في سلة المحذوفات فقط بشكل دائم',
        shouldRecoverEmployeeFromTrashBeforeActivation:
          'لاستعادة التفعيل، يرجى استعادة المستخدم من سلة المحذوفات',
        inactiveDependentRulechainsBeforeSoftDelete:
          'يرجى تعطيل سلاسل القواعد التابعة لهذا المستخدم أولاً',
      },
    },
  },
  smsNotifier: {
    actorLog: {
      added: 'تم تسجيل إعدادات الإشعار للمستخدم {0}',
      updated: 'تم تحديث إعدادات الإشعار للمستخدم {0}',
      deleted: 'تم حذف إعدادات الإشعار للمستخدم {0}',
    },
    response: {
      http: {
        added: 'تم تسجيل إعدادات الإشعار',
        updated: 'تم تحديث إعدادات الإشعار',
        deleted: 'تم حذف إعدادات الإشعار',
      },
    },
    errorResponse: {
      badRequest: {
        alreadyExists: 'تم تسجيل إعدادات الإشعار لهذا المستخدم مسبقاً',
        doesNotExists: 'لا توجد إعدادات بهذا المعرف',
        phoneNumberShouldBelongToWorkspaceEmployees:
          'يجب أن ينتمي رقم الهاتف إلى موظفي مساحة العمل',
      },
    },
  },
  tenant: {
    actorLog: {
      nameUpdated: 'تم تحديث اسم المستأجر',
    },
    response: {
      http: {
        added: 'تم إنشاء المستأجر',
        deleted: 'تم حذف المستأجر',
        updated: 'تم تحديث المستأجر',
      },
    },
    errorResponse: {
      badRequest: {
        nameIsDuplicated: 'اسم المستأجر مكرر',
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
      created: 'تم إنشاء صفحة باسم {0}',
      deleted: 'تم حذف صفحة باسم {0}',
      nameUpdated: 'تم تغيير اسم الصفحة من {0} إلى {1}',
      contentUpdated: 'تم تحديث محتوى الصفحة المسماة {1}',
      pageIndexUpdated: 'تم تحديث ترتيب الصفحة المسماة {0}',
    },
    systemLog: {
      deletionFailed: 'فشلت عملية حذف الصفحة {0}',
      updateFailed: 'فشلت عملية تحديث الصفحة {0}',
      createFailed: 'فشلت عملية انشاء الصفحة {0}',
    },
    response: {
      http: {
        created: 'تم إنشاء الصفحة',
        updated: 'تم تحديث الصفحة',
      },
      socket: {
        created: 'تم إنشاء الصفحة',
        updated: 'تم تحديث الصفحة',
        deleted: 'تم حذف الصفحة',
      },
    },
    errorResponse: {
      badRequest: {
        notExists: 'لا توجد صفحة بهذا المعرف',
        nameIsDuplicated: 'اسم الصفحة مكرر',
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

export const arabicSystemLogSections = {
  SYSTEM_LOG_SECTION_DEVICE_LIVE_SIGNAL: 'سیگنال سلامت',
  SYSTEM_LOG_SECTION_DEVICE_CONFIG: 'تنظیمات تجهیز',
  SYSTEM_LOG_SECTION_DEVICE_DATA: 'داده تجهیز',
  SYSTEM_LOG_SECTION_RULE_CHAIN: 'زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_CATEGORY: 'دسته بندی زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_STORAGE_NODE: 'نود ذخیره زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_NODE: 'نود زنجیره قواعد',
};

export const arabicReportFields = {
  EMPLOYEE: 'کارمند',
  RULE_CHAIN: 'زنجیره قواعد',
  EXPOSED_REST_API: 'وب سرویس',
  createdAt: 'تاریخ',
  actorLogType: 'اکتور',
  actorId: 'شناسه اکتور',
  messageKey: 'توضیحات',
};
