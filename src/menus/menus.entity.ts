import { CaslResource } from '../common/decorators/casl-resource.decorator.ts'
// menus.entity.ts

import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm'
import type { Relation } from 'typeorm'

import Roles from '../roles/roles.entity.ts'
import { CaslAction } from '../common/constants/casl.ts'

export enum MenuType {
	Directory = 'directory', // 可包含子项的目录
	Group = 'group', // 仅用于分组展示
	Page = 'page', // 可访问的页面
}

@CaslResource({
	name: 'menus',
	actions: [CaslAction.Read, CaslAction.Create, CaslAction.Update, CaslAction.Delete],
	fields: ['name', 'path', 'icon', 'order', 'visible', 'enabled'],
})
@Entity('menus')
export class Menus {
	/**
	 * 菜单 ID：
	 * MySQL 中通常对应自增主键。
	 */
	@PrimaryGeneratedColumn()
	id: number

	/**
	 * 父菜单 ID：
	 * null 表示顶级菜单。
	 */
	@Column({ type: 'int', nullable: true })
	parentId: number | null

	/**
	 * 多个子菜单可以属于同一个父菜单。
	 *
	 * JoinColumn 指定使用已有的 parentId 列，
	 * 避免另外创建一个命名不同的关联列。
	 */
	@ManyToOne(() => Menus, menu => menu.children, {
		nullable: true,
		onDelete: 'RESTRICT',
	})
	@JoinColumn({ name: 'parentId', referencedColumnName: 'id' })
	parent: Relation<Menus> | null

	/**
	 * 当前菜单的直接子菜单。
	 */
	@OneToMany(() => Menus, menu => menu.parent)
	children: Relation<Menus[]>

	/**
	 * 菜单展示名称。
	 */
	@Column({ type: 'varchar', length: 20, unique: true })
	name: string

	/**
	 * directory：目录
	 * page：页面
	 */
	@Column({
		type: 'enum',
		enum: MenuType,
	})
	type: MenuType

	/**
	 * 目录可以不设置路由；页面是否必须有 path，
	 * 建议在 Zod / Service 中按业务规则校验。
	 */
	@Column({ type: 'varchar', length: 100, nullable: true })
	path: string | null

	/**
	 * 图标标识，例如 "Users"、"Settings"。
	 */
	@Column({ type: 'varchar', length: 50, nullable: true })
	icon: string | null

	@Column({ type: 'varchar', length: 50 })
	acl: string

	/**
	 * 同级菜单排序，数字越小越靠前。
	 *
	 * 数据库列仍叫 order，与当前实体保持一致；
	 * 写原生 SQL 时需要用反引号包裹。
	 */
	@Column({ type: 'int', default: 0 })
	order: number

	/**
	 * 是否显示在菜单栏。
	 */
	@Column({ type: 'boolean', default: true })
	visible: boolean

	/**
	 * 是否启用。
	 * 是否同时影响接口访问，需要另行制定授权规则。
	 */
	@Column({ type: 'boolean', default: true })
	enabled: boolean

	@CreateDateColumn({
		type: 'datetime',
		precision: 3,
		default: () => 'CURRENT_TIMESTAMP(3)',
	})
	createdAt: Date

	@UpdateDateColumn({
		type: 'datetime',
		precision: 3,
		default: () => 'CURRENT_TIMESTAMP(3)',
		onUpdate: 'CURRENT_TIMESTAMP(3)',
	})
	updatedAt: Date

	/**
	 * 菜单关联的角色。
	 *
	 * 保留目前的 role 属性名，避免直接影响Roles 实体中已经存在的反向关联。
	 */
	@ManyToMany(() => Roles, roles => roles.menus)
	@JoinTable({ name: 'roles_menus' })
	role: Relation<Roles[]>
}
