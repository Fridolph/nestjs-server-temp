import { Module } from '@nestjs/common'
import { PermissionsService } from './permissions.service.js'
import { PermissionsController } from './permissions.controller.js'
import { PermissionsRepository } from './permissions.repository.ts'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Permissions } from './permission.entity.ts'

@Module({
	imports: [TypeOrmModule.forFeature([Permissions])],
	controllers: [PermissionsController],
	providers: [PermissionsService, PermissionsRepository],
	exports: [PermissionsService],
})
export class PermissionsModule {}
