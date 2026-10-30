import type { Repository } from 'typeorm'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import User from './user.entity.ts'
import Logs from '../common/logs/logs.entity.ts'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Logs) private readonly logsRepository: Repository<Logs>
  ) {}

  findAll() {
    return this.userRepository.find()
  }

  findOne(id: number) {
    return this.userRepository.findOne({
      where: { id },
    })
  }

  findByUsername(username: string) {
    return this.userRepository.findOne({
      where: {
        username,
      },
    })
  }

  findProfile(id: number) {
    return this.userRepository.findOne({
      where: { id },
      relations: {
        profile: true,
      },
    })
  }

  findLogs(id: number) {
    return this.logsRepository.find({
      where: { user: { id } },
    })
  }

  async create(createUserDto: any) {
    const dto = {
      username: createUserDto.username,
      password: createUserDto.password,
      isActive: createUserDto.isActive ?? true,
    }
    const newUser = await this.userRepository.create(dto)
    return this.userRepository.save(newUser)
  }

  async update(id: number, user: Partial<Pick<User, 'username'>>) {
    const { username } = user

    if (username === undefined) {
      throw new BadRequestException('没有提供可更新的字段')
    }

    return this.userRepository.update(id, { username })
  }

  remove(id: number) {
    return this.userRepository.delete(id)
  }

  // findLogsByGroup(id: number) {
  //   return this.logsRepository
  //     .createQueryBuilder('logs')
  //     .leftJoin('logs.user', 'user')
  //     .select('logs.result', 'result')
  //     .addSelect('user.id', 'userId')
  //     .addSelect('user.username', 'username')
  //     .addSelect('user.isActive', 'isActive')
  //     .addSelect('COUNT(*)', 'count')
  //     .where('user.id = :id', { id })
  //     .andWhere('result <> 200')
  //     .groupBy('logs.result')
  //     .addGroupBy('user.id')
  //     .addGroupBy('user.username')
  //     .addGroupBy('user.isActive')
  //     .getRawMany()
  // }

  findLogsByGroup(id: number) {
    const sql = `
    SELECT
      logs.result AS result,
      user.id AS userId,
      user.username AS username,
      user.isActive AS isActive,
      COUNT(*) AS count
    FROM logs AS logs
    INNER JOIN \`user\`
      ON user.id = logs.userId
    WHERE user.id = ?
      AND logs.result <> ?
    GROUP BY
      logs.result,
      user.id,
      user.username,
      user.isActive
  `

    return this.logsRepository.query(sql, [id, '200'])
  }
}
