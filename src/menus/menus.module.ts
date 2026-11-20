import { Global, Module } from '@nestjs/common'
import { MenusService } from './menus.service.js'
import { MenusController } from './menus.controller.js'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Menus } from './menus.entity.ts'
import { MenusRpst } from './menus.repository.ts'
import { UserModule } from '../user/user.module.ts'
import { AdminGuard } from '../common/guards/admin.guard.ts'

@Global()
@Module({
	// 复用 UserModule 导出的 UserService，供 AdminGuard 查询当前用户权限。
	imports: [TypeOrmModule.forFeature([Menus]), UserModule],
	controllers: [MenusController],
	providers: [MenusService, MenusRpst, AdminGuard],
	exports: [MenusService],
})
export class MenusModule {}
