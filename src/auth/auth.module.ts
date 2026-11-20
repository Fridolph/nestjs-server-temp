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
import { CaslResourceRegistry } from '../common/casl/casl-resource.registry.ts'

@Global()
@Module({
	imports: [
		UserModule,
		PassportModule,
		PermissionsModule,
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
	providers: [AuthService, JwtStrategy, CaslAbilityService, CaslResourceRegistry],
	controllers: [AuthController],
	exports: [AuthService, CaslAbilityService],
})
export class AuthModule {}
