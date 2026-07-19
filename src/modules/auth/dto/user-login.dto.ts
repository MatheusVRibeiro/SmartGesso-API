import { IsEmail, IsString, MinLength } from 'class-validator';

/** DTO para login de usuário. */
export class UserLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
