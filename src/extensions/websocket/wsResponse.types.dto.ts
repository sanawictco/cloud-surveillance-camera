import { ToConnectedCameraLiveSignalWsResponseDto } from 'src/modules/videoDevices/contracts/camera/websocket/toConnectedCameraLiveSignal.wsResponse.dto';
import { ToDisconnectedCameraLiveSignalWsResponseDto } from 'src/modules/videoDevices/contracts/camera/websocket/toDisconnectedCameraLiveSignal.wsResponse.dto';
import { ToConnectedNvrLiveSignalWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/toConnectedNvrLiveSignal.wsResponse.dto';
import { ToDisconnectedNvrLiveSignalWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/toDisconnectedNvrLiveSignal.wsResponse.dto';
import { CreateAndSendSystemLogWsResponseDto } from 'src/modules/systemLogs/contracts/systemLog/createAndSendSystemLog.wsResponse.dto';
import { CreatePageWsResponseDto } from 'src/modules/dashboard/contracts/createPage.wsResponse.dto';
import { DeletePageWsResponseDto } from 'src/modules/dashboard/contracts/deletePage.wsResponse.dto';
import { UpdatePageWsResponseDto } from 'src/modules/dashboard/contracts/updatePage.wsResponse.dto';
import { CloudIsRecoveringWsResponseDto } from 'src/modules/videoDevices/contracts/nvr/websocket/cloudIsRecovering.wsResponse.dto';

export type Exact<MAIN_TYPE, GENERIC_TYPE> = MAIN_TYPE extends GENERIC_TYPE
  ? GENERIC_TYPE extends MAIN_TYPE
    ? MAIN_TYPE
    : never
  : never;

export type WsRespnoseTypes =
  | CreateAndSendSystemLogWsResponseDto
  | ToConnectedCameraLiveSignalWsResponseDto
  | ToDisconnectedCameraLiveSignalWsResponseDto
  | ToConnectedNvrLiveSignalWsResponseDto
  | ToDisconnectedNvrLiveSignalWsResponseDto
  | CreatePageWsResponseDto
  | DeletePageWsResponseDto
  | UpdatePageWsResponseDto
  | CloudIsRecoveringWsResponseDto;
