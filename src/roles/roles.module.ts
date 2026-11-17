import { Module } from '@nestjs/common'
import { RolesService } from './roles.service.ts'
import { RolesController } from './roles.controller.ts'
import { TypeOrmModule } from '@nestjs/typeorm'
import Roles from './roles.entity.ts'
import { RolesRpst } from './roles.repository.ts'
import User from '../user/user.entity.ts'
import { AdminGuard } from '../common/guard/admin.guard.ts'

@Module({
	imports: [TypeOrmModule.forFeature([Roles, User])],
	controllers: [RolesController],
	providers: [RolesService, RolesRpst, AdminGuard],
	exports: [RolesService],
})
export class RolesModule {}
