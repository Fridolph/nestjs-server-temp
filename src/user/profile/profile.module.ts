import { ProfileController } from './profile.controller.ts'
import { ProfileService } from './profile.service.ts'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import Profile from './profile.entity.ts'

@Module({
	imports: [TypeOrmModule.forFeature([Profile])],
	controllers: [ProfileController],
	providers: [ProfileService],
	exports: [ProfileService],
})
export class ProfileModule {}
