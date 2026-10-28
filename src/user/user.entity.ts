import type { Relation } from 'typeorm'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  JoinTable,
  OneToOne,
} from 'typeorm'
import Logs from '../logs/logs.entity.ts'
import Roles from '../roles/roles.entity.ts'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import Profile from './profile/profile.entity.ts'

@Entity()
export default class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  @IsString()
  @IsNotEmpty()
  username: string

  @Column()
  @IsString()
  @IsNotEmpty()
  password: string

  @Column({ type: 'boolean', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  // typescript -> 数据库 关联关系 Mapping
  @OneToOne(() => Profile, (profile) => profile.user)
  profile: Relation<Profile>

  @OneToMany(() => Logs, (logs) => logs.user)
  logs: Relation<Logs[]>

  @ManyToMany(() => Roles, (roles) => roles.users)
  @JoinTable({ name: 'users_roles' })
  roles: Relation<Roles[]>
}
