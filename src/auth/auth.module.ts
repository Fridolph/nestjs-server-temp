import { Module } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { AuthController } from './auth.controller.js'
import { UserModule } from '../user/user.module.ts'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ConfigEnum } from '../common/config/config.enum.ts'
import { JwtStrategy } from './auth.strategy.ts'

@Module({
	imports: [
		UserModule,
		PassportModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				// 签发和验签读取同一配置，缺少密钥时立即报错。
				secret: configService.getOrThrow<string>(ConfigEnum.SECRET),
				signOptions: {
					expiresIn: '2h',
				},
			}),
			inject: [ConfigService],
		}),
	],
	providers: [AuthService, JwtStrategy],
	controllers: [AuthController],
})
export class AuthModule {}
