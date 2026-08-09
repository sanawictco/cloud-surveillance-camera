import { LanguageKeysBase } from '../languageKeys.base';

export const kurdiValues: LanguageKeysBase = {
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
      added: 'بەکارهێنەرێک بە ژمارەی مۆبایل {0} بۆ میزکار زیادکرا',
      deleted: 'بەکارهێنەرێک بە ژمارەی مۆبایل {0} لە میزکار سڕایەوە',
      recovered: 'بەکارهێنەرێک بە ژمارەی مۆبایل {0} لە زبڵخانە گەڕێندرایەوە',
      softDeleted: 'بەکارهێنەرێک بە ژمارەی مۆبایل {0} بۆ زبڵخانە گواسترایەوە',
      rolesUpdated:
        'ئاستی دەسترسییەکانی بەکارهێنەر بە ژمارەی مۆبایل {0} نوێکرایەوە',
    },
    response: {
      http: {
        added: 'بەکارهێنەر بۆ میزکار زیادکرا',
        deleted: 'بەکارهێنەر لە میزکار سڕایەوە',
        rolesUpdated: 'ئاستی دەسترسییەکانی بەکارهێنەر نوێکرایەوە',
        recovered: 'بەکارهێنەر گەڕێندرایەوە',
        softDeleted: 'بەکارهێنەر بۆ زبڵخانە گواسترایەوە',
      },
    },
    errorResponse: {
      badRequest: {
        softDeleted: 'بەکارهێنەر لە زبڵخانەیە',
        alreadyAddedToWorkspace: 'بەکارهێنەر پێشتر ئەندامی میزکارە',
        canNotUpdateSoftDeletedEmployees:
          'ناتوانیت بەکارهێنەرانی لە زبڵخانە نوێبکەیتەوە',
        onlySoftDeletedEmployeesCouldBeRecovered:
          'تەنها بەکارهێنەرانی لە زبڵخانە دەتوانرێت گەڕێنرێنەوە',
        onlySoftDeletedEmployeesCouldBeHardDeleted:
          'تەنها بەکارهێنەرانی لە زبڵخانە دەتوانرێت بە تەواوی بسڕێنەوە',
        shouldRecoverEmployeeFromTrashBeforeActivation:
          'بۆ چالاککردنەوە، تکایە بەکارهێنەر لە زبڵخانە گەڕێنەوە',
        inactiveDependentRulechainsBeforeSoftDelete:
          'تکایە یەکەم زنجیرە یاساکانی پەیوەست بەم بەکارهێنەرە ناچالاک بکە',
      },
    },
  },
  smsNotifier: {
    actorLog: {
      added: 'ڕێکخستنی ئاگادارکردنەوە بۆ بەکارهێنەری {0} تۆمارکرا',
      updated: 'ڕێکخستنی ئاگادارکردنەوە بۆ بەکارهێنەری {0} نوێکرایەوە',
      deleted: 'ڕێکخستنی ئاگادارکردنەوە بۆ بەکارهێنەری {0} سڕایەوە',
    },
    response: {
      http: {
        added: 'ڕێکخستنی ئاگادارکردنەوە تۆمارکرا',
        updated: 'ڕێکخستنی ئاگادارکردنەوە نوێکرایەوە',
        deleted: 'ڕێکخستنی ئاگادارکردنەوە سڕایەوە',
      },
    },
    errorResponse: {
      badRequest: {
        alreadyExists:
          'ڕێکخستنی ئاگادارکردنەوە پێشتر بۆ ئەم بەکارهێنەرە تۆمارکراوە',
        doesNotExists: 'هیچ ڕێکخستنێک بەم ناسنامەیە بوونی نییە',
        phoneNumberShouldBelongToWorkspaceEmployees:
          'ژمارەی مۆبایل دەبێت بەکارهێنەرێکی میزکار بێت',
      },
    },
  },
  tenant: {
    actorLog: {
      nameUpdated: 'ناوی کرێگرتە نوێکرایەوە',
    },
    response: {
      http: {
        added: 'کرێگرتە دروستکرا',
        deleted: 'کرێگرتە سڕایەوە',
        updated: 'کرێگرتە نوێکرایەوە',
      },
    },
    errorResponse: {
      badRequest: {
        nameIsDuplicated: 'ناوی کرێگرتە دووبارەیە',
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
      created: 'پەڕەیەک بە ناوی {0} دروستکرا',
      deleted: 'پەڕەیەک بە ناوی {0} سڕایەوە',
      nameUpdated: 'ناوی پەڕە لە {0} بۆ {1} گۆڕا',
      contentUpdated: 'ناوەڕۆکی پەڕە بە ناوی {1} نوێکرایەوە',
      pageIndexUpdated: 'ڕیزبەندی پەڕە بە ناوی {0} نوێکرایەوە',
    },
    systemLog: {
      deletionFailed: 'کرداری سڕینەوەی پەڕەی {0} بە هەڵە ڕووبەڕووبوویەوە',
      updateFailed: 'کرداری نوێکردنەوەی پەڕەی {0} بە هەڵە ڕووبەڕووبوویەوە',
      createFailed: 'کرداری دروستکردنی پەڕەی {0} ڕووبەڕووی هەڵەیەک بووەوە',
    },
    response: {
      http: {
        created: 'پەڕە دروستکرا',
        updated: 'پەڕە نوێکرایەوە',
      },
      socket: {
        created: 'پەڕە دروستکرا',
        updated: 'پەڕە نوێکرایەوە',
        deleted: 'پەڕە سڕایەوە',
      },
    },
    errorResponse: {
      badRequest: {
        notExists: 'پەڕەیەک بەم ناسنامەیە بوونی نییە',
        nameIsDuplicated: 'ناوی پەڕە دووبارەیە',
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

export const kurdiSystemLogSections = {
  SYSTEM_LOG_SECTION_DEVICE_LIVE_SIGNAL: 'سیگنال سلامت',
  SYSTEM_LOG_SECTION_DEVICE_CONFIG: 'تنظیمات تجهیز',
  SYSTEM_LOG_SECTION_DEVICE_DATA: 'داده تجهیز',
  SYSTEM_LOG_SECTION_RULE_CHAIN: 'زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_CATEGORY: 'دسته بندی زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_STORAGE_NODE: 'نود ذخیره زنجیره قواعد',
  SYSTEM_LOG_SECTION_RULE_CHAIN_NODE: 'نود زنجیره قواعد',
};

export const kurdiReportFields = {
  EMPLOYEE: 'کارمند',
  RULE_CHAIN: 'زنجیره قواعد',
  EXPOSED_REST_API: 'وب سرویس',
  createdAt: 'تاریخ',
  actorLogType: 'اکتور',
  actorId: 'شناسه اکتور',
  messageKey: 'توضیحات',
};
