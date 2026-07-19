import { IsString } from 'class-validator';

/** DTO para refresh de token de usuário. */
export class UserRefreshDto {
  @IsString()
  refreshToken!: string;
}
