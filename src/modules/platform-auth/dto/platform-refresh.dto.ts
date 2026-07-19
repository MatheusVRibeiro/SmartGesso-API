import { IsString } from 'class-validator';

/** DTO para refresh de token da plataforma. */
export class PlatformRefreshDto {
  @IsString()
  refreshToken!: string;
}
