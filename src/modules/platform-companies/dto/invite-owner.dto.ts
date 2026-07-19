import { IsEmail, IsString } from 'class-validator';

/** DTO para envio de convite de proprietário. */
export class InviteOwnerDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;
}
