import { Module } from '@nestjs/common'
import { RolesController } from './roles.controller.js'
import { RolesService } from './roles.service.js'
import { TypeOrmModule } from '@nestjs/typeorm'
import Roles from './roles.entity.ts'
import User from '../user.entity.ts'
import { RoleRpst } from './roles.repository.ts'
import { SuperAdminGuard } from '../../guard/super-admin.guard.ts'

@Module({
	imports: [TypeOrmModule.forFeature([Roles, User])],
	controllers: [RolesController],
	providers: [RolesService, RoleRpst, SuperAdminGuard],
	exports: [RolesService],
})
export class RolesModule {}
