import { Module } from '@nestjs/common'
import { UserController } from './user.controller.ts'
import { UserService } from './user.service.ts'
import { TypeOrmModule } from '@nestjs/typeorm'
import User from './user.entity.ts'
import Logs from '../common/logs/logs.entity.ts'
import { ProfileModule } from './profile/profile.module.ts'

@Module({
	imports: [TypeOrmModule.forFeature([User, Logs]), ProfileModule],
	controllers: [UserController],
	providers: [UserService],
	exports: [UserService],
})
export class UserModule {}
