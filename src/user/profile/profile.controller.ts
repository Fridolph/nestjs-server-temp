import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { ProfileService } from './profile.service.ts'

@Controller()
export class ProfileController {
	constructor(private readonly profileService: ProfileService) {}

	@Get('users/:id/profile')
	getUserProfile(@Param('id', ParseIntPipe) id: number) {
		return this.profileService.getProfile(id)
	}
}
