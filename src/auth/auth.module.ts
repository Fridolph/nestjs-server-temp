import { Global, Module } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { AuthController } from './auth.controller.js'
import { UserModule } from '../user/user.module.ts'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ConfigEnum } from '../common/config/config.enum.ts'
import { JwtStrategy } from './auth.strategy.ts'
import { CaslAbilityService } from './casl.alibity.service.ts'
import { PermissionsModule } from '../permissions/permissions.module.ts'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthSession } from './auth-session.entity.ts'
import { AuthSessionRepository } from './auth-session.repository.ts'
import { AuthSessionService } from './auth-session.service.ts'
import { AuthHttp, AuthRequestGuard } from './auth-http.ts'

@Global()
@Module({
	imports: [
		UserModule,
		TypeOrmModule.forFeature([AuthSession]),
		PassportModule,
		PermissionsModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				// 签发和验签读取同一配置，缺少密钥时立即报错。
				secret: configService.getOrThrow<string>(ConfigEnum.SECRET),
				signOptions: {
					expiresIn: '15m',
				},
			}),
			inject: [ConfigService],
		}),
	],
	providers: [AuthService, JwtStrategy, CaslAbilityService, AuthSessionRepository, AuthSessionService, AuthHttp, AuthRequestGuard],
	controllers: [AuthController],
	exports: [AuthService, CaslAbilityService, AuthHttp],
})
export class AuthModule {}
