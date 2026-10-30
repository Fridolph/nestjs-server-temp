import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import Profile from './profile.entity.ts'

@Injectable()
export class ProfileService {
	constructor(@InjectRepository(Profile) private readonly profileRepository: Repository<Profile>) {}

	async getProfile(id: number) {
		console.log('🚀 ~ :6 ~ ProfileService ~ getProfile ~ id:', id)
		const dataSql = `
SELECT u.username, p.gender, p.photo, p.address, p.userId
FROM profile AS p
  INNER JOIN \`user\` AS u ON p.userId = u.id
WHERE u.id = ${id}
	AND u.isActive = 1;
`
		const data = await this.profileRepository.query(dataSql)

		return {
			code: 200,
			data,
		}
	}
}
