import { IsEmail, IsString, MinLength } from 'class-validator';

/** DTO para login de administrador da plataforma. */
export class PlatformLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
