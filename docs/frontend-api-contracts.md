# Frontend API Contracts — cloud-surveillance-camera

Complete reference of every contract the frontend talks to: HTTP request/response DTOs and WebSocket
(Socket.IO) event payloads, extracted from `src/**/controllers`, `src/**/contracts`, and
`src/extensions/websocket`.

> Source of truth is the code. Every type below is transcribed from a real file; the file path is
> given under each block. Architecture background lives in [`AGENTS.md`](../AGENTS.md).

---

## Table of contents

1. [Transport & conventions](#1-transport--conventions)
2. [Authentication & tenancy](#2-authentication--tenancy)
3. [Error contract](#3-error-contract)
4. [The async command pattern (`msgId`)](#4-the-async-command-pattern-msgid)
5. [Shared enums & base DTOs](#5-shared-enums--base-dtos)
6. [HTTP API](#6-http-api)
   - [6.1 NVRs](#61-nvrs----video-devicesnvrs)
   - [6.2 Cameras (end devices)](#62-cameras-end-devices----devicesend-devices)
   - [6.3 Dashboard pages](#63-dashboard-pages----dashboardpages)
   - [6.4 Dashboard PTZ data](#64-dashboard-ptz-data----dashboarddata)
   - [6.5 Employees / tenant access](#65-employees--tenant-access----employees)
   - [6.6 Tenants](#66-tenants----tenants)
   - [6.7 SMS notifiers](#67-sms-notifiers----employeessms-notifiers)
   - [6.8 System logs](#68-system-logs----system-logs)
   - [6.9 Actor logs](#69-actor-logs----actor-logs)
   - [6.10 Trash](#610-trash----trash)
   - [6.11 System monitor](#611-system-monitor----system-monitor)
7. [WebSocket API](#7-websocket-api)
   - [7.1 Connecting](#71-connecting)
   - [7.2 Envelope](#72-envelope)
   - [7.3 `VIDEO_DevicesSocket`](#73-channel-video_devicessocket)
   - [7.4 `PagesSocket`](#74-channel-pagessocket)
   - [7.5 `SystemLogsSocket`](#75-channel-systemlogssocket)
   - [7.6 Lifecycle events](#76-lifecycle-events)
8. [Device-facing endpoints (not for the browser)](#8-device-facing-endpoints-not-for-the-browser)
9. [Defined but not exposed](#9-defined-but-not-exposed)
10. [Behavioural notes & known quirks](#10-behavioural-notes--known-quirks)

---

## 1. Transport & conventions

| Aspect           | Value                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Base URL         | `http(s)://<host>:<NODE_PORT>` — **no global path prefix** (`main.ts` never calls `setGlobalPrefix`)                              |
| Swagger UI       | `/<SWAGGER_BASE_PATH>` (default `/api`), **disabled in production** (`src/utilities/swaggerRegisteration.ts`)                     |
| Content type     | `application/json` everywhere except the fog backup upload (`multipart/form-data`)                                                |
| CORS             | production: only `CORS_ORIGINS`; dev: any origin. `credentials: true` in both (`src/main.ts:58`)                                  |
| Cookies          | `credentials: 'include'` is required — the refresh flow reads/writes an `httpOnly` `refreshToken` cookie scoped to `.sanawict.ir` |
| Security headers | `helmet()` is applied globally                                                                                                    |

### Global validation pipe

`src/main.ts:24`

```ts
new ValidationPipe({
  whitelist: true, // strips properties with no decorator
  transform: true, // applies @Type() conversions (query strings -> numbers)
  forbidNonWhitelisted: true, // 400 if the body carries an unknown property
  forbidUnknownValues: true,
});
```

**Consequence for the frontend:** sending any field that is not in the request DTO is a `400`, not a
silent ignore. Do not send `id`, `createdAt`, `tenantId`, etc. back in update bodies.

### Response body families

Endpoints do **not** share one envelope. There are three shapes, and which one you get is per-route:

| Family                  | Shape                                            | Used by                                            |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------- |
| **Bare value**          | `"3421991055"` (a raw JSON string — the `msgId`) | every `202 Accepted` async command                 |
| **Raw DTO**             | `NvrResponseDto`, `CameraResponseDto[]`, …       | all read endpoints                                 |
| **`{ data, message }`** | `{ data: <DTO \| {id}>, message: string }`       | employees, sms-notifiers, camera multi-hard-delete |

---

## 2. Authentication & tenancy

### 2.1 Bearer token (`ProtectionMiddleware`)

`src/utilities/auth/protection.middleware.ts`, wired in `src/app.module.ts:93`.

Applies to **every route** except three:

- `POST /fog-communication-manager/configs`
- `POST /fog-communication-manager/restore-fog-backup-to-cloud`
- `GET /system-monitor/health`

Send:

```
Authorization: Bearer <keycloak access token>
```

The middleware calls Keycloak's `/protocol/openid-connect/userinfo` on **every request** to confirm
the token is still live, then checks the token grants access to the configured client
(`resource_access[clientId]`, or `aud` contains it, or `azp === clientId`).

It then populates `request.user`:

```ts
{ id: sub, phoneNumber: preferred_username, name: name, lang: lang }
```

`lang` comes from a custom `lang` claim on the JWT and drives every translated string the API returns.

#### The silent-refresh response — `206 Partial Content`

If the access token is missing **or** rejected and a valid `refreshToken` cookie is present, the
middleware **does not** run the route. It refreshes with Keycloak and answers:

```jsonc
// HTTP 206 Partial Content
{
  "access_token": "eyJhbGciOi...",
  "id": "0f1f6b1e-....", // sub of the refresh token
}
```

…and sets a new `refreshToken` cookie. **The original request was not executed.** Frontend HTTP
clients must treat `206` as "store the new token and replay the request".

Failure codes from the middleware itself are plain JSON strings, not the standard error envelope:

| Status | Body                                                           | Meaning                                    |
| ------ | -------------------------------------------------------------- | ------------------------------------------ |
| `401`  | `"not authorized"` / `"not authorized2"` / `"not authorized4"` | no token and no usable refresh cookie      |
| `403`  | `"forbidden"`                                                  | token valid but not issued for this client |

### 2.2 Tenant header (`ActiveTenantGuard`)

`src/modules/tenantAccess/guards/activeTenant.guard.ts`

Every tenant-scoped controller requires:

```
X-Tenant-Id: <uuid v4>
```

| Status | Condition                                                                    |
| ------ | ---------------------------------------------------------------------------- |
| `401`  | no `request.user`                                                            |
| `400`  | `X-Tenant-Id` missing, repeated, or not a UUID v4                            |
| `403`  | `"tenant access denied"` — the user is not an active employee of that tenant |

The bootstrap call is `GET /tenants`, which needs **only** the bearer token — call it first to
learn which tenant ids the user may send.

### 2.3 Roles (`EmployeeRolesGuard`)

`src/modules/tenantAccess/guards/employeeRoles.guard.ts`

```ts
enum EmployeeRoles {
  Employee = 'E',
  Wallet = 'W',
  Device_Dashboard = 'DD',
  Only_View = 'OV',
  Report = 'R',
}
```

`src/extensions/sanawApi/dtos/employees/employeeRoles.enum.ts`

Rules:

- The tenant **owner** bypasses every role check.
- `@RequireTenantOwner()` (POST `/employees`, PUT `/employees/:id`) is owner-only — no role satisfies it.
- Otherwise the employee needs **at least one** of the controller's required roles.
- `403 "employee role does not allow this operation"` on failure.

Per-controller requirement:

| Controller                                                                             | Required role                   |
| -------------------------------------------------------------------------------------- | ------------------------------- |
| `/video-devices/nvrs`, `/video-devices/cameras`, `/dashboard/pages`, `/dashboard/data` | `Device_Dashboard`              |
| `/employees`, `/employees/sms-notifiers`                                               | `Employee`                      |
| `/trash`                                                                               | none (any active tenant member) |
| `/system-logs` (GET `/`)                                                               | none, but tenant guard applies  |
| `/system-logs/dictionary`, `/actor-logs/dictionary`, `/tenants`                        | none, auth only                 |

---

## 3. Error contract

`GlobalExceptionFilter` (`src/utilities/exception.filter.ts`) is registered as `APP_FILTER` and
normalises everything that reaches a controller into `ApiErrorResponse`.

```ts
class ApiErrorResponse {
  statusCode: number; // 400
  message: string; // 'Validation Error'
  error: string; // 'Bad Request'
  correlationId: string; // 'YevPQs' — echo this in bug reports
  timestamp: number; // epoch ms
  path: string; // '/video-devices/nvrs'
  subErrors?: string[]; // ['name must be shorter than or equal to 60 characters']
}
```

`src/dddLib/contracts/apiError.response.ts`

Two shapes in practice:

**`400` (validation)** — `subErrors` carries the class-validator messages:

```jsonc
{
  "statusCode": 400,
  "message": "Bad Request Exception",
  "error": "Validation error",
  "correlationId": "6f2c1b9e-...",
  "timestamp": 1757030400000,
  "path": "/video-devices/nvrs",
  "subErrors": [
    "serialNumber must be longer than or equal to 8 characters",
    "property foo should not exist",
  ],
}
```

**Any other status** — `error` is the stringified original response, `subErrors` is absent:

```jsonc
{
  "statusCode": 403,
  "message": "tenant access denied",
  "error": "{\"message\":\"tenant access denied\",\"error\":\"Forbidden\",\"statusCode\":403}",
  "correlationId": "6f2c1b9e-...",
  "timestamp": 1757030400000,
  "path": "/video-devices/nvrs",
}
```

> Errors raised by `ProtectionMiddleware` (§2.1) bypass this filter — they are bare JSON strings.

Business rejections (`BadRequestException`) carry a **translated, user-displayable** `message` in the
caller's `lang` — e.g. duplicate NVR name, NVR is offline, a config is already running.

---

## 4. The async command pattern (`msgId`)

Most writes to NVR/camera/page state are **not** finished when the HTTP call returns. The cloud
queues a config for the fog NVR, answers `202 Accepted` with a `msgId`, and the real outcome arrives
later on the WebSocket carrying **the same `msgId`** in `metadata.msgId`.

```
POST /video-devices/nvrs        ──▶ 202  "3421991055"
                                          │
   (cloud → BullMQ → MQTT → fog NVR → MQTT → cloud)
                                          ▼
socket.on('VIDEO_DevicesSocket') ◀── { type:'config', data:{…},
                                       metadata:{ configType:'create', msgId:'3421991055' } }
```

**Frontend rule:** keep a pending map keyed by `msgId`; resolve it when a WS message with that
`metadata.msgId` lands; time it out yourself — the server sends no failure ack on this channel
(failures surface on `SystemLogsSocket` instead).

`msgId` format — `generateRandomMsgId()` in `src/dddLib/utils/randomIdGenerator.ts`:

> A decimal **string** of a random uint32, `"1"` … `"4294967295"` (never `"0"`).
> It is a string on the wire. Do not parse it to a number and back.

Endpoints returning a `msgId`: NVR create/update/active/inactive/delete/auto-search/auto-register,
camera update, page create/update/delete, PTZ move/zoom.

---

## 5. Shared enums & base DTOs

### 5.1 `ResponseBase` / `IdResponse`

Every entity response extends this, so `id`, `createdAt`, `updatedAt` are always present.

```ts
class IdResponse {
  id: string; // uuid v4
}

class ResponseBase extends IdResponse {
  createdAt: string; // ISO 8601 — new Date(...).toISOString()
  updatedAt: string; // ISO 8601
}
```

`src/dddLib/contracts/id.response.dto.ts`, `src/dddLib/contracts/response.base.ts`

### 5.2 `Paginated<T>`

```ts
class Paginated<T> {
  totalDocs: number;
  limit: number;
  page: number;
  docs: readonly T[];
}
```

`src/dddLib/infra/repository.base.ts:10`

### 5.3 `PaginatedQueryRequestDto`

```ts
class PaginatedQueryRequestDto {
  limit?: number; // @IsInt @Min(0) @Max(99999)
  page?: number; // @IsInt @Min(0) @Max(99999)
}
```

`src/dddLib/contracts/paginatedQuery.request.dto.ts`

### 5.4 `OnlyIdParamRequestDto`

The `:id` path param on nearly every route.

```ts
class OnlyIdParamRequestDto {
  id: string; // @IsString @IsUUID (v4)
}
```

`src/modules/shared/dtos/onlyIdParam.request.dto.ts`

### 5.5 Enums

```ts
enum LanguageCode {
  EN = 'en',
  FA = 'fa',
  AR = 'ar',
  KU = 'ku',
}
```

`src/extensions/translation/languageCode.enum.ts`

```ts
enum LiveSignalStatuses {
  CONNECTING = 0,
  CONNECTED = 1,
  DIS_CONNECTED = 2,
} // numeric!
```

`src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo.ts`

```ts
enum WebSocketTypes {
  CONFIG = 'config',
  DATA = 'data',
}
```

`src/modules/shared/websocket.types.ts`

```ts
enum PageTypes {
  WIDGET = 'widget',
}
```

`src/modules/dashboard/domain/valueObjects/pageType.vo.ts`

```ts
enum SystemLogTypes {
  ERROR = 'error',
  WARNING = 'warning',
  INFORMATION = 'information',
}
enum SystemLogSections {
  VIDEO_DEVICES_CONFIG = 'SYSTEM_LOG_SECTION_VIDEO_DEVICES_CONFIG',
  VIDEO_DEVICES_LIVE_SIGNAL = 'SYSTEM_LOG_SECTION_VIDEO_DEVICES_LIVE_SIGNAL',
  PAGE = 'SYSTEM_LOG_SECTION_PAGE',
}
```

`src/modules/systemLogs/domain/systemLog.type.ts`

```ts
enum TenantStatuses {
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DECOMMISSIONING = 'decommissioning',
  DECOMMISSIONED = 'decommissioned',
}
```

`src/modules/tenants/domain/valueObjects/tenantStatus.vo.ts`

```ts
enum NotificationLevel {
  ERROR = 'error',
  WARNING = 'warning',
  INFORMATION = 'information',
}
```

`src/modules/systemLogs/contracts/fogNotification/notificationLevel.enum.ts`

### 5.6 Custom validators used in request DTOs

| Validator                        | Rejects                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `AvoidUsingSpecialCharacters`    | special characters in names / serial numbers                                                           |
| `AvoidUsingWhiteSpaceCharacters` | any whitespace                                                                                         |
| `RequireAtLeastOneFieldPipe`     | a body where every field is `null`/`undefined` → `400 "Request body must contain at least one field."` |
| `IsDeviceMsgId`                  | anything that is not `"1"`–`"4294967295"`                                                              |

---

## 6. HTTP API

### 6.1 NVRs — `/video-devices/nvrs`

`src/modules/videoDevices/controllers/nvr.http.controller.ts`
Guards: `ActiveTenantGuard` + `EmployeeRolesGuard`, role `Device_Dashboard`.

| Method | Path                                   | Success | Response                       |
| ------ | -------------------------------------- | ------- | ------------------------------ |
| GET    | `/video-devices/nvrs`                  | 200     | `NvrResponseDto[]`             |
| GET    | `/video-devices/nvrs/:id`              | 200     | `NvrResponseDto`               |
| GET    | `/video-devices/nvrs/:id/dependencies` | 200     | `GetNvrDependenciesResposeDto` |
| POST   | `/video-devices/nvrs`                  | 202     | `string` (msgId)               |
| PUT    | `/video-devices/nvrs/:id`              | 202     | `string` (msgId)               |
| PATCH  | `/video-devices/nvrs/:id/active`       | 202     | `string` (msgId)               |
| PATCH  | `/video-devices/nvrs/:id/inactive`     | 202     | `string` (msgId)               |
| DELETE | `/video-devices/nvrs/:id`              | 202     | `string` (msgId)               |
| GET    | `/video-devices/nvrs/:id/auto-search`  | 202     | `string` (msgId)               |
| POST   | `/video-devices/nvrs/auto-register`    | 202     | `string` (msgId)               |

#### `NvrResponseDto` (response)

```ts
class NvrResponseDto extends ResponseBase {
  id: string;
  name: string;
  tenantId: string;
  productModel: string;
  serialNumber: string;
  password: string; // NVR login credential — shown to the user on purpose
  lang: LanguageCode;
  isActive: boolean;
  liveSignalStatus: LiveSignalStatuses; // 0 | 1 | 2
  cloudIsRecovering: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
```

`src/modules/videoDevices/contracts/nvr/http/response/nvr.response.dto.ts`

#### `CreateNvrRequestDto` (POST body)

```ts
class ScanNvrRequestDto {
  serialNumber: string; // @Length(8,8) + no special chars + no whitespace
}

class CreateNvrRequestDto extends ScanNvrRequestDto {
  name: string; // @Length(1,60) + no special chars
}
```

`src/modules/videoDevices/contracts/nvr/http/request/createNvr.request.dto.ts`

Create flow: the cloud calls the Sanaw device-registry to register the serial number, persists the
NVR, then pushes a `create` config event on `VIDEO_DevicesSocket` **~1 s later**.

#### `UpdateNvrRequestDto` (PUT body)

All optional, but `RequireAtLeastOneFieldPipe` demands at least one non-null field.

```ts
class UpdateNvrRequestDto {
  name?: string; // @Length(1,60) + no special chars
  password?: string; // @IsStrongPassword()
  lang?: LanguageCode; // 'en' | 'fa' | 'ar' | 'ku'
}
```

`src/modules/videoDevices/contracts/nvr/http/request/updateNvr.request.dto.ts`

Preconditions (else `400` with a translated message): the NVR must be active **and** its
`liveSignalStatus` must be `CONNECTED`; the new name must be unique inside the tenant.

#### `AutoRegisterRequestDto` (POST `/auto-register` body)

```ts
class AutoRegisterRequestDto {
  nvrId: string; // @IsUUID
  addedCameras: string[]; // serial numbers; max 100, unique, /^[A-Z0-9]{8}$/
  deletedCameras: string[]; // serial numbers; max 100, unique, /^[A-Z0-9]{8}$/
}
```

`src/modules/videoDevices/contracts/nvr/http/request/autoRegister.request.dto.ts`

The serial numbers must be a subset of what the preceding `auto-search` discovered (the cloud keeps
that candidate set in a private cache).

#### `GetNvrDependenciesResposeDto` (GET `/:id/dependencies`)

```ts
interface GetNvrDependenciesResposeDto {
  cameras: CameraResponseDto[];
  pages: DashboardPageProjection[];
}

interface DashboardPageProjection {
  id: string;
  type: string; // 'widget'
}
```

`.../response/getNvrDependencies.response.dto.ts`, `src/dddLib/contracts/dashboardPage.projection.ts`

---

### 6.2 Cameras — `/video-devices/cameras`

`src/modules/videoDevices/controllers/camera.http.controller.ts`
Guards: `ActiveTenantGuard` + `EmployeeRolesGuard`, role `Device_Dashboard`.

| Method | Path                                                   | Success | Response                                                   |
| ------ | ------------------------------------------------------ | ------- | ---------------------------------------------------------- |
| GET    | `/video-devices/cameras`                               | 200     | `CameraResponseDto[]` (excludes soft-deleted)              |
| GET    | `/video-devices/cameras/:id`                           | 200     | `CameraResponseDto`                                        |
| PUT    | `/video-devices/cameras/:id`                           | 202     | `string` (msgId)                                           |
| DELETE | `/video-devices/cameras/multi-hard-delete?cameraIds=…` | 200     | `{ data: { ids: string[] }, message: { msgKey: string } }` |

#### `CameraResponseDto` (response)

```ts
class CameraResponseDto extends ResponseBase {
  id: string;
  tenantId: string;
  name: string;
  productModel: string;
  hasPtz: boolean;
  hasAudio: boolean;
  nvrId: string;
  isActive: boolean;
  isDeleted: boolean; // true = in trash
  createdAt: string;
  updatedAt: string;
}
```

`src/modules/videoDevices/contracts/camera/http/camera.response.dto.ts`

> **`liveSignalStatus` is not on `CameraResponseDto`.** A camera's connection state only ever reaches
> the frontend through the `liveSignal` WS data messages (§7.3). Track it client-side.

#### `UpdateCameraRequestDto` (PUT body)

```ts
class UpdateCameraRequestDto {
  name: string; // @IsString + no special chars (required, despite the pipe)
}
```

`src/modules/videoDevices/contracts/camera/http/updateCamera.request.dto.ts`

Preconditions: the camera must not be soft-deleted, its name must be unique in the tenant, and its
parent NVR must be active + connected.

#### `CameraIdsRequestDto` (DELETE query)

```ts
class CameraIdsRequestDto {
  // Sent as a repeated or comma-separated query param; a plain string is split on ','.
  cameraIds: string[]; // @IsArray @ArrayNotEmpty @ArrayMaxSize(100) @ArrayUnique @IsUUID('4', {each:true})
}
```

`src/modules/videoDevices/contracts/camera/http/cameras.request.dto.ts`

`?cameraIds=uuid1,uuid2` and `?cameraIds=uuid1&cameraIds=uuid2` both work.
Every id must already be **soft-deleted** (in trash) — otherwise `400`.

Response body (`camera.http.service.ts:93`) — note `message` here is an untranslated key object:

```jsonc
{
  "data": { "ids": ["uuid1", "uuid2"] },
  "message": { "msgKey": "camera.response.socket.multiHardDeleted" },
}
```

---

### 6.3 Dashboard pages — `/dashboard/pages`

`src/modules/dashboard/controllers/page.http.controller.ts`
Guards: `ActiveTenantGuard` + `EmployeeRolesGuard`, role `Device_Dashboard`.

| Method | Path                   | Success | Response                 |
| ------ | ---------------------- | ------- | ------------------------ |
| GET    | `/dashboard/pages`     | 200     | `GetAllPagesResponseDto` |
| GET    | `/dashboard/pages/:id` | 200     | `PageResponseDto`        |
| POST   | `/dashboard/pages`     | 202     | `string` (msgId)         |
| PUT    | `/dashboard/pages/:id` | 202     | `string` (msgId)         |
| DELETE | `/dashboard/pages/:id` | 202     | `string` (msgId)         |

> `GET /dashboard/pages` documents `page` and `limit` query params in Swagger but **ignores them** —
> the service returns every widget page of the tenant, ordered by `pageIndex` ascending. See §10.

#### Responses

```ts
class GetAllPagesResponseDto {
  widgetPages: PageResponseDto[];
}

class PageResponseDto extends ResponseBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  type: PageTypes; // 'widget'
  pageIndex: number;
  nvrId: string;
  content: Widget[];
}

class Widget {
  id: string;
} // uuid v4 of the camera rendered in that slot
```

`src/modules/dashboard/contracts/page.response.dto.ts`, `.../domain/valueObjects/pageContent.vo.ts`

#### `CreatePageRequestDto`

```ts
class CreatePageRequestDto {
  name: string; // @Length(1,60) + no special chars
  nvrId: string; // @IsUUID
  type: PageTypes; // 'widget'
}
```

`src/modules/dashboard/contracts/createPage.request.dto.ts`

#### `UpdatePageRequestDto`

```ts
class WidgetDto {
  id: string;
} // @IsUUID

class UpdatePageRequestDto {
  name?: string; // @Length(1,60) + no special chars
  destIndex?: number; // @IsInt @Min(0) — the new pageIndex (renamed on the wire!)
  content?: WidgetDto[]; // @ArrayMinSize(0) @ArrayMaxSize(300), nested-validated
}
```

`src/modules/dashboard/contracts/updatePage.request.dto.ts`

> The reorder field is **`destIndex`** on the request but comes back as **`pageIndex`** on
> `PageResponseDto`. The service maps `destIndex -> pageIndex` (`page.http.service.ts:93`).

The parent NVR must exist, be active and connected for create/update/delete.

---

### 6.4 Dashboard PTZ data — `/dashboard/data`

`src/modules/dashboard/controllers/dashboardData.controller.ts`
Guards: `ActiveTenantGuard` + `EmployeeRolesGuard`, role `Device_Dashboard`.

| Method | Path                             | Success | Response         |
| ------ | -------------------------------- | ------- | ---------------- |
| POST   | `/dashboard/data/send-move-data` | 202     | `string` (msgId) |
| POST   | `/dashboard/data/send-zoom-data` | 202     | `string` (msgId) |

```ts
class SendDataRequestDto {
  cameraId: string; // @IsUUID
  data: number[]; // @ArrayMinSize(1) @ArrayMaxSize(50), each @IsNumber, -2147483647 … 2147483647
}
```

`src/modules/dashboard/contracts/sendData.request.dto.ts`

These are **fire-and-forget hardware commands** (`MOVE` / `ZOOM`) — published once to the fog with no
retry. The camera must be active and connected.

---

### 6.5 Employees / tenant access — `/employees`

`src/modules/tenantAccess/controllers/employee.controller.ts`
Guards: `ActiveTenantGuard` + `EmployeeRolesGuard`, role `Employee`.
`POST /` and `PUT /:id` additionally require **tenant owner**.

| Method | Path                           | Success | Response                                                           |
| ------ | ------------------------------ | ------- | ------------------------------------------------------------------ |
| GET    | `/employees`                   | 200     | `EmployeeResponseDto[]`                                            |
| GET    | `/employees/find/:phoneNumber` | 200     | `SanawApiEmployeeDto`                                              |
| POST   | `/employees` _(owner)_         | 200     | `{ data: EmployeeResponseDto, message: 'employee added' }`         |
| PUT    | `/employees/:id` _(owner)_     | 200     | `{ data: EmployeeResponseDto, message: 'employee roles updated' }` |
| DELETE | `/employees/:id/soft-delete`   | 200     | `{ data: { id }, message: 'employee removed' }`                    |
| DELETE | `/employees/:id/hard-delete`   | 200     | `{ data: { id }, message: 'employee permanently removed' }`        |
| PUT    | `/employees/:id/recovery`      | 200     | `{ data: EmployeeResponseDto, message: 'employee recovered' }`     |

> These `message` strings are **hard-coded English**, not translated.

#### `EmployeeResponseDto`

```ts
class EmployeeResponseDto extends ResponseBase {
  id: string; // employee record id (NOT the keycloak user id)
  tenantId: string;
  userId: string; // keycloak sub
  roles: EmployeeRoles[]; // ['DD','E',…]
  firstName: string; // from the Sanaw identity service
  lastName: string;
  phoneNumber: string;
  isDeleted: boolean;
  isOwner: boolean;
  lang: LanguageCode;
  createdAt: string;
  updatedAt: string;
}
```

`src/modules/tenantAccess/contracts/employee/employee.response.dto.ts`

#### `FindEmployeeRequestDto` (path param on `/find/:phoneNumber`)

```ts
class FindEmployeeRequestDto {
  phoneNumber: string; // @IsPhoneNumber('IR')
}
```

Returns the upstream identity, **not** a local employee row:

```ts
interface SanawApiEmployeeDto {
  userId: string;
  roles: EmployeeRoles[];
  firstName: string;
  lastName: string;
  phoneNumber: string;
  lang: LanguageCode;
  isOwner?: boolean;
}
```

`src/extensions/sanawApi/dtos/employees/sanawApiEmployee.response.ts`

`400 "user is already an employee"` / `400 "removed employee must be recovered"` if the person is
already attached to this tenant.

#### `AddEmployeeRequestDto` / `UpdateEmployeeRolesRequestDto`

```ts
class AddEmployeeRequestDto {
  phoneNumber: string; // @IsPhoneNumber('IR')
  roles: EmployeeRoles[]; // @ArrayMinSize(0) @ArrayMaxSize(5), each @IsEnum(EmployeeRoles)
}

class UpdateEmployeeRolesRequestDto {
  roles: EmployeeRoles[]; // same constraints
}
```

`.../contracts/employee/addEmployee.request.dto.ts`, `.../updateEmployeeRoles.request.dto.ts`

`POST /employees` creates the upstream identity if the phone number is unknown.

---

### 6.6 Tenants — `/tenants`

`src/modules/tenants/tenants.controller.ts`
Auth only — **no** `X-Tenant-Id`, no role check on either route (there is no employee record for
the caller until `POST /` succeeds — this is the self-service "create my workspace" entry point).
Call `GET /` first to learn which tenant ids the user may send as `X-Tenant-Id` elsewhere.

| Method | Path | Success | Response                |
| ------ | ---- | ------- | ----------------------- |
| POST   | `/`  | 201     | `TenantResponseDto`     |
| GET    | `/`  | 200     | `MyTenantResponseDto[]` |

#### `CreateTenantRequestDto` (POST body)

```ts
class CreateTenantRequestDto {
  name: string; // @Length(1,60)
  defaultTimezone: string; // @IsTimeZone() — a real IANA zone, e.g. "Asia/Tehran"
}
```

`src/modules/tenants/contracts/createTenant.request.dto.ts`

The caller becomes the tenant's **owner** and its `status` always starts `'active'` — there is no
provisioning workflow that would ever transition it out of `'provisioning'`, and `ActiveTenantGuard`
requires `'active'` to grant any access at all, so a self-service tenant must start active or it
would be permanently unusable. Neither `ownerId` nor `status` can be set by the client. A tenant
has no `slug`; it is addressed only by `id`. `409` if this owner already has a tenant with the same
`name` (exact match).

```ts
class TenantResponseDto extends ResponseBase {
  ownerId: string;
  name: string;
  status: TenantStatuses; // 'provisioning' | 'active' | 'suspended' | …
  defaultTimezone: string;
}
```

`src/modules/tenants/contracts/tenant.response.dto.ts`

```ts
class MyTenantResponseDto {
  tenantId: string;
  name: string;
  status: TenantStatuses; // 'provisioning' | 'active' | 'suspended' | …
  employeeId: string;
  roles: EmployeeRoles[];
  isOwner: boolean;
}
```

`src/modules/tenantAccess/contracts/myTenant.response.dto.ts`

`401` if there is no user in the request context.

---

### 6.7 SMS notifiers — `/employees/sms-notifiers`

`src/modules/smsNotifier/controllers/smsNotifier.controller.ts`
Guards: `ActiveTenantGuard` + `EmployeeRolesGuard`, role `Employee`.

| Method | Path                           | Success | Response                                            |
| ------ | ------------------------------ | ------- | --------------------------------------------------- |
| GET    | `/employees/sms-notifiers`     | 200     | `SmsNotifierResponseDto[]`                          |
| POST   | `/employees/sms-notifiers`     | 200     | `{ data: SmsNotifierResponseDto, message: string }` |
| PUT    | `/employees/sms-notifiers/:id` | 200     | `{ data: SmsNotifierResponseDto, message: string }` |
| DELETE | `/employees/sms-notifiers/:id` | 200     | `{ data: { id }, message: string }`                 |

`message` here **is** translated to the caller's `lang`.

```ts
class SmsNotifierResponseDto extends ResponseBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  phoneNumber: string;
  systemLogTypes: SystemLogTypes[];
  userId: string;
}
```

`src/modules/smsNotifier/contracts/smsNotifier/smsNotifier.response.dto.ts`

```ts
class CreateSmsNotifierRequestDto {
  phoneNumber: string; // @IsPhoneNumber('IR') — must belong to a tenant employee
  systemLogTypes: SystemLogTypes[]; // 1..3 entries, @IsEnum each, plus CheckSystemLogTypes
}

class UpdateSmsNotifierRequestDto {
  systemLogTypes: SystemLogTypes[]; // same constraints
}
```

`.../createSmsNotifier.request.dto.ts`, `.../updateSmsNotifier.request.dto.ts`

**`CheckSystemLogTypes` enforces a severity ladder**, not a free set:

| Length | Only valid combination                          |
| ------ | ----------------------------------------------- |
| 1      | `['error']`                                     |
| 2      | `['error','warning']` (any order)               |
| 3      | `['error','warning','information']` (any order) |

Anything else → `400 "systemLogTyes is not valid"` _(sic — the message has that typo)_.
Duplicates are de-duplicated server-side before persisting.

Other `400`s (translated): phone number does not belong to a tenant employee; a notifier already
exists for that user; the notifier does not exist.

---

### 6.8 System logs — `/system-logs`

`src/modules/systemLogs/controllers/systemLog.controller.ts`

| Method | Path                      | Guards              | Response                                  |
| ------ | ------------------------- | ------------------- | ----------------------------------------- |
| GET    | `/system-logs`            | `ActiveTenantGuard` | `{ systemLogs: Paginated<SystemLogRow> }` |
| GET    | `/system-logs/dictionary` | auth only           | `{ dictionary: Record<string, string> }`  |

#### `GetAllSystemLogsRequestDto` (query)

```ts
class GetAllSystemLogsRequestDto {
  page?: number; // @IsInt @Min(1)
  limit?: number; // @IsInt @Min(10) @Max(30)
  types?: string; // JSON-encoded array, @Length(0,100), validated by CheckTypesIsValid
}
```

`src/modules/systemLogs/contracts/systemLog/getAllSystemLogs.request.dto.ts`

`types` is a **string containing JSON**, not a repeated query param:

```
GET /system-logs?page=1&limit=10&types=["error","warning"]
```

Single quotes are accepted by the validator (`'` is replaced with `"` before parsing), but the
service's own `JSON.parse` runs on the raw value — **send double quotes**. Every entry must be a
`SystemLogTypes` value and the array must have no duplicates. Omitted/empty ⇒ all three severities.
Defaults: `page = 1`, `limit = 10`.

#### Response — rows are **positional arrays**, not objects

The logs come from TDengine and are returned raw:

```jsonc
{
  "systemLogs": {
    "totalDocs": 128,
    "page": 1,
    "limit": 10,
    "docs": [
      [
        "2026-09-05T09:12:44.001Z",
        "nvr.systemLog.updateFailed",
        "NVR-Lobby",
        "SYSTEM_LOG_SECTION_VIDEO_DEVICES_CONFIG",
        "6f2c1b9e-....",
        "error",
      ],
    ],
  },
}
```

Column order is fixed (`systemLogSelectedColumns`, `src/modules/systemLogs/domain/systemLog.type.ts`):

| #   | Column          | Type      | Note                                                    |
| --- | --------------- | --------- | ------------------------------------------------------- |
| 0   | `createdAt`     | timestamp | TDengine timestamp                                      |
| 1   | `messageKey`    | string    | translation key — resolve via `/system-logs/dictionary` |
| 2   | `messageParams` | string    | comma-joined params, `""` when none                     |
| 3   | `section`       | string    | a `SystemLogSections` value                             |
| 4   | `entityId`      | string    | NVR / camera / page id                                  |
| 5   | `groupId`       | string    | the severity — a `SystemLogTypes` value                 |

Suggested client mapping:

```ts
const [createdAt, messageKey, messageParams, section, entityId, type] = row;
const params = messageParams ? messageParams.split(',') : [];
```

#### `/system-logs/dictionary`

```jsonc
{
  "dictionary": {
    "nvr.systemLog.updateFailed": "به‌روزرسانی … {0}",
    "SYSTEM_LOG_SECTION_PAGE": "…",
  },
}
```

Keys are the `messageKey` and `section` values above; the language comes from the JWT `lang` claim.
`400 "unSupported Language"` if `lang` is not one of `fa|en|ar|ku`.

Fetch this once per session and cache it.

---

### 6.9 Actor logs — `/actor-logs`

`src/modules/actorLogs/actorLog.controller.ts` — auth only, no tenant guard.

| Method | Path                     | Response                                 |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/actor-logs/dictionary` | `{ dictionary: Record<string, string> }` |

Same shape and language rules as `/system-logs/dictionary`, for the audit-trail section.
There is **no** endpoint to read actor-log rows themselves today.

---

### 6.10 Trash — `/trash`

`src/modules/trash/controllers/trash.controller.ts`
Guards: `ActiveTenantGuard` + `EmployeeRolesGuard` (no role required).

| Method | Path     | Response                                                             |
| ------ | -------- | -------------------------------------------------------------------- |
| GET    | `/trash` | `{ cameras: CameraResponseDto[], employees: EmployeeResponseDto[] }` |

Soft-deleted rows only. Recovery paths: `PUT /employees/:id/recovery` for employees; cameras are
purged with `DELETE /video-devices/cameras/multi-hard-delete` (no camera recovery endpoint exists).

---

### 6.11 System monitor — `/system-monitor`

`src/modules/systemMonitor/systemMonitor.controller.ts` — **no auth** (excluded from the middleware).

| Method | Path                     | Response                    |
| ------ | ------------------------ | --------------------------- |
| GET    | `/system-monitor/health` | 200 healthy / 503 unhealthy |

```ts
// 200
interface HealthResponseDto { status: 'healthy'; timestamp: string; }   // toLocaleString(), not ISO

// 503
{ status: 'unhealthy', timestamp: string, failedCheck: 'emqx' | 'mongo' | 'cache' | 'tdengine' }
```

`src/modules/systemMonitor/dtos/health.response.dto.ts`, `systemMonitor.service.ts:41`

Checks run sequentially and short-circuit on the first failure.

---

## 6. WebSocket API

`src/extensions/websocket/websocket.service.ts`

The gateway is Socket.IO, attached to the same HTTP server: default path `/socket.io`, default
namespace `/`. There are **no client→server events** — the socket is send-only from the server.

### 6.1 Connecting

Two things are read during the handshake (`wsAuth.service.ts`):

- `handshake.headers.authorization` — the same `Bearer <token>` used for HTTP
- `handshake.auth.tenantId` — a UUID v4

```ts
import { io } from 'socket.io-client';

const socket = io(BASE_URL, {
  transports: ['websocket'],
  extraHeaders: { Authorization: `Bearer ${accessToken}` },
  auth: { tenantId: activeTenantId },
});
```

> **Browser caveat.** `extraHeaders` only reaches the server on the HTTP polling transport; a pure
> `transports: ['websocket']` connection from a browser cannot set headers. Either allow the default
> `['polling','websocket']` upgrade path, or terminate the header at your proxy. `authorization` is
> mandatory — a socket without it is disconnected immediately.

The server, in order:

1. verifies the token against Keycloak `/userinfo`,
2. decodes it and requires `sub` + `resource_access[clientId]`,
3. resolves active tenant access for `(tenantId, sub)`,
4. joins the socket to its own id room **and** to `tenant:{tenantId}`,
5. caches `{ id, tenantId, phoneNumber, name, roles, lang }` in Redis under the socket id.

Any failure ⇒ **silent `disconnect()`**, no error event. Reconnect with a fresh token.

One socket = one tenant. To switch tenants, disconnect and reconnect with the new `tenantId`.

#### Localisation happens server-side

Before each emit the server replaces `message` (and `data.message`) — declared in the DTOs as
`string | { msgKey: string; msgParams?: string[] }` — with a plain **translated string** in that
socket's own `lang` (`websocket.service.ts:190-206`).

**On the wire, `message` is always a `string`.** Two viewers of the same tenant receive the same
event in their own language.

#### Extra guard on system logs

Every send on `SystemLogsSocket` re-resolves tenant access for the recipient. If membership was
revoked or the tenant suspended since connect, that socket is **force-disconnected** mid-stream
(`websocket.service.ts:177-188`).

### 7.2 Envelope

Every message on every channel:

```ts
interface WebsocketMsgBaseDto {
  type: 'config' | 'data';
  data: object;
  message?: string; // translated; present on 'config' messages, absent on most 'data' ones
  metadata?: object; // the discriminator
}
```

Discriminate on `metadata`:

| `type`     | Discriminator                            | Meaning                                             |
| ---------- | ---------------------------------------- | --------------------------------------------------- |
| `'config'` | `metadata.configType` + `metadata.msgId` | the completion of a command you issued (§4)         |
| `'data'`   | `metadata.dataType` (**no `msgId`**)     | unsolicited state push — live signal, recovery flag |

```ts
socket.on('VIDEO_DevicesSocket', (msg) => {
  if (msg.type === 'config') resolvePending(msg.metadata.msgId, msg);
  else applyLiveState(msg);
});
```

Channel names (`WsChannels`, `websocket.service.ts:23`):

```ts
'VIDEO_DevicesSocket' | 'SystemLogsSocket' | 'PagesSocket' | 'ErrorsSocket';
```

`ErrorsSocket` is declared but **never emitted to** — nothing in the codebase sends on it.

> In `development` every send is delayed **500 ms** on purpose (`websocket.service.ts:217`).

---

### 7.3 Channel `VIDEO_DevicesSocket`

#### `config` messages — NVR

##### `create`

```ts
{
  type: 'config',
  data: NvrResponseDto,
  message: string,
  metadata: { configType: 'create', msgId: string }
}
```

`createNvr.wsResponse.dto.ts` · sent ~1 s after `POST /video-devices/nvrs` returns.

##### `update`

```ts
{ type: 'config', data: NvrResponseDto, message: string,
  metadata: { configType: 'update', msgId: string } }
```

`updateNvr.wsResponse.dto.ts` · sent after the fog confirms the change over MQTT.

##### `active`

```ts
{ type: 'config', data: NvrResponseDto, message: string,
  metadata: { configType: 'active', msgId: string } }
```

`activeNvr.wsResponse.dto.ts`

##### `inactive` — carries the cascaded cameras

```ts
{
  type: 'config',
  data: { nvr: NvrResponseDto, cameras: CameraResponseDto[] },
  message: string,
  metadata: { configType: 'inactive', msgId: string }
}
```

`inactiveNvr.wsResponse.dto.ts`

##### `delete` — carries every dependency that went with it

```ts
{
  type: 'config',
  data: {
    id: string,
    softDeletedCameraIds: string[],
    pageIds: { widgets: string[]; liveDiagrams: string[] }
  },
  message: string,
  metadata: { configType: 'delete', msgId: string }
}
```

`deleteNvr.wsResponse.dto.ts` · `liveDiagrams` is always `[]` today (only `widget` pages exist).

##### `search` — result of `GET /:id/auto-search`

Two variants. **Nothing found** (`message` present, no `videoDevices`):

```ts
{
  type: 'config',
  data: { nvrId: string },
  message: string,                                   // "all connected cameras are up to date"
  metadata: { configType: 'search', msgId: string }
}
```

**Changes found** (no `message`):

```ts
{
  type: 'config',
  data: {
    nvrId: string,
    videoDevices: [{
      addedCameras: {              // candidates, NOT yet registered
        productModel: string;
        serialNumber: string;
        name: string;              // server-generated: `Camera ${serialNumber}`
        hasPtz: boolean;
        hasAudio: boolean;
      }[],
      deletedCameras: {            // registered cameras no longer seen by the NVR
        id: string;
        serialNumber: string;
        productModel: string;
        name: string;
      }[]
    }]
  },
  metadata: { configType: 'search', msgId: string }
}
```

`searchNvr.wsResponse.dto.ts` + `dtos/autoSearchDevices.dto.ts` · `videoDevices` is an array with
exactly one element. Feed the chosen `serialNumber`s straight into `POST /auto-register`.

##### `register` — result of `POST /auto-register`

```ts
{
  type: 'config',
  data: {
    nvrId: string,
    addedCameras: SanitizedNvrCameraDto[],      // { id, serialNumber, productModel, name }
    deletedCameras: SanitizedNvrCameraDto[],
    unRegisteredCameraSerialNumbers: string[]   // the fog refused these
  },
  metadata: { configType: 'register', msgId: string }
}
```

`registerNvr.wsResponse.dto.ts` · `message` is optional and not sent on this path.
(The DTO's `data` is a union that also allows `{ id }`; only the object above is emitted.)

#### `config` messages — cameras

##### `update` (camera)

```ts
{
  type: 'config',
  data: CameraResponseDto & { cmdKey?: string },
  message: string,
  metadata: { configType: 'update', msgId: string }
}
```

`updateCamera.wsResponse.dto.ts` · **same `configType: 'update'` string as the NVR event** — tell
them apart by the shape of `data` (`nvrId` present ⇒ camera) or by your pending-`msgId` map.

##### `activeMultiCameras` — note the bare array

```ts
{ type: 'config', data: CameraResponseDto[], message: string,
  metadata: { configType: 'activeMultiCameras', msgId: string } }
```

`activeMultiCameras.wsResponse.dto.ts`

##### `inActiveMultiCameras` — note the wrapper object

```ts
{ type: 'config', data: { cameras: CameraResponseDto[] }, message: string,
  metadata: { configType: 'inActiveMultiCameras', msgId: string } }
```

`inactiveMultiCameras.wsResponse.dto.ts`

> The active/inactive pair is **asymmetric**: `data` is an array on activate and `{ cameras: [...] }`
> on deactivate. Not a typo in this doc — see §10.

##### `softDeleteMultiCameras`

```ts
{ type: 'config', data: { cameraIds: string[] }, message: string,
  metadata: { configType: 'softDeleteMultiCameras', msgId: string } }
```

`softDeleteMultiCameras.wsResponse.dto.ts` · these ids move to `/trash`.

#### `data` messages — no `msgId`, no `message`

##### NVR live signal

```ts
{ type: 'data',
  data: { id: string; liveSignalStatus: 1 | 2 },
  metadata: { dataType: 'liveSignal' } }
```

`toConnectedNvrLiveSignal.wsResponse.dto.ts` / `toDisconnectedNvrLiveSignal.wsResponse.dto.ts`

##### Camera live signal

```ts
{ type: 'data',
  data: { id: string; liveSignalStatus: 0 | 1 | 2 },
  metadata: { dataType: 'liveSignal' } }
```

`toConnectedCameraLiveSignal…` / `toConnectingCameraLiveSignal…` / `toDisconnectedCameraLiveSignal…`

> **`dataType` is `'liveSignal'` for both NVRs and cameras.** Resolve `data.id` against your NVR list
> first, then your camera list. Cameras additionally emit `CONNECTING (0)`; NVRs never do.
> When an NVR goes down, the cloud cascades: it emits the NVR `DIS_CONNECTED` **and** one
> `DIS_CONNECTED` per active camera on it.

##### Cloud recovery flag

```ts
{ type: 'data',
  data: { id: string; cloudIsRecovering: boolean },
  metadata: { dataType: 'cloudIsRecovering' } }
```

`cloudIsRecovering.wsResponse.dto.ts` · `true` when the NVR starts uploading its backup to the cloud,
`false` when the restore finishes. While `true`, `PATCH /:id/inactive` is rejected. Use it to show a
"syncing" state and to disable mutating controls for that NVR.

---

### 7.4 Channel `PagesSocket`

`src/modules/dashboard/applicationService/services/page.mqtt.service.ts` · all `type: 'config'`.

```ts
// CREATE_PAGE
{ type: 'config', data: PageResponseDto, message: string,
  metadata: { configType: 'CREATE_PAGE', msgId: string } }

// UPDATE_PAGE
{ type: 'config', data: PageResponseDto, message: string,
  metadata: { configType: 'UPDATE_PAGE', msgId: string } }

// DELETE_PAGE
{ type: 'config', data: { id: string }, message: string,
  metadata: { configType: 'DELETE_PAGE', msgId: string } }
```

`createPage.wsResponse.dto.ts`, `updatePage.wsResponse.dto.ts`, `deletePage.wsResponse.dto.ts`

> Page `configType`s are `SCREAMING_SNAKE_CASE`; video-device ones are `camelCase`. Different enums
> (`PageConfigs` vs `NvrWebSocketConfigTypes`).

---

### 7.5 Channel `SystemLogsSocket`

`src/modules/systemLogs/applicationService/services/systemLog.service.ts:118`

One event type, emitted whenever a system log is written. `type` is `'config'` or `'data'` depending
on what produced the log.

**Actual wire shape** — the service spreads the full log props into `data`, so `messageProps` is
present alongside the translated `message`:

```ts
{
  type: 'config' | 'data',
  data: {
    tenantId: string,
    type: 'error' | 'warning' | 'information',
    section: SystemLogSections,
    entityId: string,                                   // NVR / camera / page id
    messageProps: { key: string; params?: (string|number)[] },
    message: string                                     // translated for this recipient
  },
  metadata: {
    msgId: string,
    configType?: string,      // e.g. 'update' | 'active' | 'inactive' | 'register' | 'updateHardwareConfig'
    dataType?: string,        // e.g. 'liveSignal' | 'cloudRecovery'
    widget?: { id: string },
    cmdKey?: string
  }
}
```

`createAndSendSystemLog.wsResponse.dto.ts` + `systemLog.service.ts:105-124`

> The declared DTO types `data` as `SendSystemLogOnWebSocketProps` (no `messageProps`), but the
> spread at `systemLog.service.ts:110` puts `messageProps` on the wire. Both are there — prefer
> `message` for display and `messageProps.key` for programmatic matching.

This is the channel that reports **failures** of the async commands in §4 (e.g.
`nvr.systemLog.updateFailed`, `camera.systemLog.creationFailed`). A command that never produces a
`config` event on its own channel will usually produce an error entry here with a matching
`metadata.msgId`.

Note there is **no** WS event for a newly seen/unseen count, and no "mark as seen" endpoint (§9).

---

### 7.6 Lifecycle events

| Event                 | Payload                                                              | When                                                                           |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `server:shutdown`     | `{ message: 'Server is restarting. Please reconnect in a moment.' }` | graceful shutdown; every socket is disconnected right after                    |
| `error`               | `{ message: string, timestamp: string, data: unknown }`              | an exception in a WS context, via `GlobalExceptionFilter.handleWsException`    |
| _(silent disconnect)_ | —                                                                    | failed handshake auth, or revoked access detected on a `SystemLogsSocket` send |

Reconnect on `server:shutdown` with backoff; on a silent disconnect, refresh the token first.

---

## 8. Device-facing endpoints (not for the browser)

Documented so nobody wires the frontend to them by accident. These authenticate with the **NVR's**
serial number + 32-char access token, not with a user JWT.

### `POST /fog-communication-manager/configs`

`src/modules/videoDevices/controllers/fogCommunication.http.controller.ts` — excluded from auth.

```ts
class FogVideoDeviceConfigRequestDto {
  serialNumber: string; // @Length(8,8)
  accessToken: string; // @Length(32,32)
  msgId: string; // @IsDeviceMsgId
  configType: 'videoDevice' | 'page';
}
```

Response `{ configType: string, data: object }`, or **`404 "configuration is unavailable"`** for every
failure mode (bad token, wrong owner, expired, not found) — deliberately indistinguishable.

### `POST /fog-communication-manager/restore-fog-backup-to-cloud`

`src/modules/fogCommunicationManager/fogCommunicationManager.controller.ts` — excluded from auth.

`multipart/form-data`, field `file`, max 1 GiB. Headers `X-Tenant-Id`, `X-Nvr-Serial-Number`,
`X-Nvr-Access-Token` (`FogBackupAuthGuard`). Returns `201` with an empty body.

### `POST /system-logs/fog-notifications/{sms,voice-call,email,telegram}`

`src/modules/systemLogs/controllers/fogNotification.controller.ts` — **still behind
`ProtectionMiddleware`** (not in the exclusion list), and additionally validates the NVR token.

All four share one body:

```ts
class FogSmsRequestDto /* = FogVoiceCallRequestDto = FogEmailRequestDto = FogTelegramRequestDto */ {
  serialNumber: string; // @Length(8,8), no special/whitespace chars
  accessToken: string; // @Length(32,32), no special/whitespace chars
  userId: string; // @IsUUID
  message: string; // @Length(1,200)
  level: NotificationLevel; // 'error' | 'warning' | 'information'
}
```

`src/modules/systemLogs/contracts/fogNotification/*.request.dto.ts`

Rejections are opaque numeric strings: `400 "1"` (unknown serial), `"2"` (token mismatch),
`"3"` (userId is not an employee of that NVR's tenant).

---

## 9. Defined but not exposed

Contracts that exist in `src/**/contracts` but are unreachable from any HTTP route or WS emit — do
not build UI against them:

| DTO                                                                                                                                           | File                                                                          | Status                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `SeenMultipleSystemLogsRequestDto`                                                                                                            | `systemLogs/contracts/systemLog/seenMultipleSystemLogs.dto.ts`                | no route — there is no "mark logs seen" endpoint                      |
| `SystemLogResponseDto`                                                                                                                        | `systemLogs/contracts/systemLog/systemLog.response.dto.ts`                    | never constructed; `/system-logs` returns raw TDengine arrays instead |
| `GetAllVideoDevicesResposeDto`                                                                                                                | `videoDevices/contracts/nvr/http/response/getAllVideoDevices.response.dto.ts` | unused; NVRs and cameras are two separate GETs                        |
| `PaginatedQueryRequestDto`, `PaginatedResponseDto`                                                                                            | `dddLib/contracts/`                                                           | no paginated HTTP endpoint uses them (`/system-logs` builds its own)  |
| `NvrSearchMqttResponseDto`, `NvrLiveSignalMqttResponseDto`, `NvrRegisterMqttResponseDto`, `NvrLifecycleMqttResponseDto`, `PageMqttRequestDto` | `.../mqtt/`, `dashboard/contracts/page.mqttRequest.dto.ts`                    | fog→cloud MQTT payloads, never HTTP or WS                             |
| `ErrorsSocket` channel                                                                                                                        | `extensions/websocket/websocket.service.ts:27`                                | declared, never emitted to                                            |

---

## 10. Behavioural notes & known quirks

Things that will cost you a debugging session if you don't know them.

1. **`202` means "queued", not "done".** Re-fetch or wait for the WS event; do not optimistically
   apply an NVR/camera/page write. The only exception is NVR **create**, which persists synchronously
   and merely announces itself on the socket a second later.

2. **`liveSignalStatus` is numeric** (`0|1|2`), not a string. `0` (`CONNECTING`) is camera-only.

3. **A camera's live status never appears in an HTTP response.** Seed your UI from
   `GET /video-devices/cameras` and keep the status purely from WS `liveSignal` events. A page reload
   loses it until the next event.

4. **`X-Tenant-Id` on HTTP, `auth.tenantId` on the socket** — two different mechanisms for the same
   thing. Switching the active tenant means both changing the header and reconnecting the socket.

5. **`206 Partial Content` is a success-shaped auth response.** Your HTTP interceptor must handle it
   or every request after a token expiry will look like it returned garbage.

6. **`GET /dashboard/pages` ignores `page` and `limit`.** They are declared in `@ApiQuery` and parsed,
   then discarded — the handler returns every widget page (`page.http.controller.ts:42-48`, with an
   unreachable `console.log` after the `return`). Paginate client-side.

7. **`destIndex` in, `pageIndex` out.** The page reorder field is renamed across the boundary.

8. **Asymmetric multi-camera WS payloads.** `activeMultiCameras` sends `data: CameraResponseDto[]`;
   `inActiveMultiCameras` sends `data: { cameras: CameraResponseDto[] }`. Handle both.

9. **`configType: 'update'` is ambiguous** on `VIDEO_DevicesSocket` — NVR and camera updates share the
   string. Disambiguate by `msgId` or by whether `data.nvrId` exists.

10. **`GET /video-devices/nvrs/:id/auto-search` does not validate its param.** It binds
    `@Param('id')` as a raw string with no `OnlyIdParamRequestDto`, so a malformed id reaches the
    service and fails as a business error rather than a clean `400`.

11. **`sms-notifiers` severity ladder.** You cannot subscribe to warnings without errors — see §6.7.

12. **`types` on `/system-logs` is JSON-in-a-query-string**, and the service parses the raw value with
    `JSON.parse`, so single quotes fail even though the validator tolerates them.

13. **WS `message` is a translated string, not the `{msgKey}` object** in the DTO source. The HTTP
    multi-hard-delete response is the opposite: it returns a raw `{ msgKey }` object you must
    translate yourself.

14. **`src/extensions/messanger` is a stub.** SMS/voice/email/Telegram methods `console.log` only.
    A successful `2xx` from a notification path does **not** mean anything was delivered.

15. **Dev-mode WS delay.** Every WebSocket send is delayed 500 ms when `NODE_ENV=development`. Don't
    tune UI timeouts against dev timings.

16. **All timestamps are ISO 8601 strings** on entity DTOs — except `/system-monitor/health`, which
    uses `toLocaleString()`, and system-log rows, which carry a TDengine timestamp in column 0.
