import { ProfileController } from './profile.controller.ts'
import { ProfileService } from './profile.service.ts'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import Profile from './profile.entity.ts'
import ProfileRpst from './profile.repository.ts'
import User from '../user.entity.ts'
import { AdminGuard } from '../../common/guard/admin.guard.ts'

@Module({
	imports: [TypeOrmModule.forFeature([Profile, User])],
	controllers: [ProfileController],
	providers: [ProfileService, ProfileRpst, AdminGuard],
	exports: [ProfileService],
})
export class ProfileModule {}
