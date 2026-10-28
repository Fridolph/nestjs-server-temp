import type { Relation } from 'typeorm'
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm'
import User from '../user/user.entity.ts'

@Entity()
export default class Roles {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  description: string

  @ManyToMany(() => User, (user) => user.roles)
  users: Relation<User[]>
}
