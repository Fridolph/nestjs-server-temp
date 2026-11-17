import { Module } from '@nestjs/common'
import { UserController } from './user.controller.ts'
import { UserService } from './user.service.ts'
import { TypeOrmModule } from '@nestjs/typeorm'
import User from './user.entity.ts'
import Logs from '../common/logs/logs.entity.ts'
import { ProfileModule } from './profile/profile.module.ts'
import Roles from '../roles/roles.entity.ts'
import UserDeleteRpst from './repository/user-delete.repository.ts'
import UserQueryRpst from './repository/user-query.repository.ts'
import UserCreateRpst from './repository/user-create.repository.ts'
import UserUpdateRpst from './repository/user-update.repository.ts'
import { AdminGuard } from '../common/guard/admin.guard.ts'

@Module({
	imports: [TypeOrmModule.forFeature([User, Logs, Roles]), ProfileModule],
	controllers: [UserController],
	providers: [
		UserService,
		UserCreateRpst,
		UserQueryRpst,
		UserDeleteRpst,
		UserUpdateRpst,
		AdminGuard,
	],
	exports: [UserService],
})
export class UserModule {}
