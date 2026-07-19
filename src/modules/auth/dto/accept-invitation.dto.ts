import { IsString, MinLength } from 'class-validator';

/** DTO para aceite de convite de proprietário. */
export class AcceptInvitationDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
