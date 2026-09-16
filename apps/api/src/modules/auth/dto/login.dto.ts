import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
