export interface HealthResponseDto {
  readonly status: 'healthy' | 'unhealthy';
  readonly timestamp: string;
}
