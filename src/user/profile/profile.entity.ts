import type { Relation } from 'typeorm'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm'
import User from '../user.entity.ts'

@Entity('profile')
export default class UserProfile {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  gender: number

  @Column()
  photo: string

  @Column()
  address: string

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn()
  user: Relation<User>
}
