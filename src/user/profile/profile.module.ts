import { ProfileController } from './profile.controller.ts'
import { ProfileService } from './profile.service.ts'
import { forwardRef, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import ProfileRpst from './profile.repository.ts'
import UserProfile from './profile.entity.ts'
import { UserModule } from '../user.module.ts'
import { AdminGuard } from '../../common/guards/admin.guard.ts'

@Module({
	imports: [
		TypeOrmModule.forFeature([UserProfile]),
		// AdminGuard 使用 UserService；与 UserModule 的双向导入需要延迟解析。
		forwardRef(() => UserModule),
	],
	controllers: [ProfileController],
	providers: [ProfileService, ProfileRpst, AdminGuard],
	exports: [ProfileService],
})
export class ProfileModule {}
