import { z } from 'zod'

import { MenuType } from './menus.entity.ts'

/**
 * 主键与父级 ID。
 * 当前实体使用 MySQL int，最大值按有符号 INT 限制。
 */
const menuId = z
	.number({ error: '菜单 ID 必须是数字' })
	.int('菜单 ID 必须是整数')
	.positive('菜单 ID 必须大于 0')
	.max(2147483647, '菜单 ID 超出范围')

const parentId = z
	.number({ error: '父菜单 ID 必须是数字' })
	.int('父菜单 ID 必须是整数')
	.positive('父菜单 ID 必须大于 0')
	.max(2147483647, '父菜单 ID 超出范围')
	.nullable()

const menuName = z
	.string({ error: '菜单名称必须是字符串' })
	.trim()
	.min(1, '菜单名称不能为空')
	.max(20, '菜单名称最多 20 个字符')

/**
 * 复用实体中的枚举，避免 DTO 和实体的菜单类型定义不一致。
 */
const menuType = z.enum(MenuType, {
	error: '菜单类型必须是 directory 或 page',
})

const path = z
	.string({ error: '菜单路径必须是字符串' })
	.trim()
	.min(1, '菜单路径不能为空字符串')
	.max(100, '菜单路径最多 100 个字符')
	.nullable()

const icon = z
	.string({ error: '菜单图标必须是字符串' })
	.trim()
	.min(1, '菜单图标不能为空字符串')
	.max(50, '菜单图标最多 50 个字符')
	.nullable()

const order = z
	.number({ error: '菜单排序必须是数字' })
	.int('菜单排序必须是整数')
	.min(0, '菜单排序不能小于 0')
	.max(99999999, '菜单排序不能大于 99999999')

const visible = z.boolean({
	error: 'visible 必须是布尔值',
})

const enabled = z.boolean({
	error: 'enabled 必须是布尔值',
})

/**
 * 菜单查询结果。
 *
 * 此处是服务端使用的扁平结构：
 * - 不包含 parent、children、role 等关联对象；
 * - createdAt / updatedAt 为 Date，而不是 JSON 字符串。
 */
export const menuSchema = z.strictObject({
	menuId,
	parentId,
	menuName,
	type: menuType,
	path,
	icon,
	order,
	visible,
	enabled,
	createdAt: z.date(),
	updatedAt: z.date(),
})

export type MenuDto = z.output<typeof menuSchema>
export type QueryMenuDto = z.output<typeof menuSchema>

/**
 * 新增菜单：
 * - menuId、创建时间、更新时间由服务端或数据库生成；
 * - 未传父级时，默认为顶级菜单；
 * - page 类型必须提供 path；
 * - 不在此接口中直接修改角色关联。
 */
export const createMenuSchema = z
	.strictObject({
		parentId: parentId.default(null),
		menuName,
		type: menuType,
		path: path.default(null),
		icon: icon.default(null),
		order: order.default(0),
		visible: visible.default(true),
		enabled: enabled.default(true),
	})
	.refine(data => data.type !== MenuType.PAGE || data.path !== null, {
		path: ['path'],
		message: '页面菜单必须提供 path',
	})

export type CreateMenuInput = z.input<typeof createMenuSchema>
export type CreateMenuDto = z.output<typeof createMenuSchema>

/**
 * 更新菜单基础 Schema。
 *
 * 这里只定义字段，不添加对象级 refine，
 * 方便后续使用 omit / pick 等方法派生其他 Schema。
 *
 * 注意：这个基础 Schema 不检查是否提供了更新字段，
 * 不建议直接用于 PATCH 请求的完整校验。
 */
export const updateMenuBaseSchema = z.strictObject({
	menuId,
	parentId: parentId.optional(),
	menuName: menuName.optional(),
	type: menuType.optional(),
	path: path.optional(),
	icon: icon.optional(),
	order: order.optional(),
	visible: visible.optional(),
	enabled: enabled.optional(),
})

export type UpdateMenuBaseInput = z.input<typeof updateMenuBaseSchema>
export type UpdateMenuBaseDto = z.output<typeof updateMenuBaseSchema>

/**
 * PATCH 请求体的基础 Schema：不包含 menuId。
 *
 * 从未添加 refine 的基础对象派生，因此可以使用 omit。
 */
export const updateMenuBodyBaseSchema = updateMenuBaseSchema.omit({
	menuId: true,
})

export type UpdateMenuBodyBaseInput = z.input<typeof updateMenuBodyBaseSchema>
export type UpdateMenuBodyBaseDto = z.output<typeof updateMenuBodyBaseSchema>

/**
 * 完整更新数据：
 * - menuId 必传；
 * - 其他字段至少提供一个；
 * - parentId / path / icon 传 null 表示清空；
 * - 字段不传表示不修改。
 *
 * type 和 path 的完整组合规则，需要 Service 合并原数据后校验。
 */
export const updateMenuSchema = updateMenuBaseSchema.refine(
	({ menuId: _menuId, ...fields }) => Object.values(fields).some(value => value !== undefined),
	{
		message: '至少提供一个可更新字段',
	}
)

export type UpdateMenuInput = z.input<typeof updateMenuSchema>
export type UpdateMenuDto = z.output<typeof updateMenuSchema>

/**
 * PATCH 请求体校验：
 * - 不接收 menuId，ID 从路径参数等位置获取；
 * - 至少提供一个可更新字段；
 * - 严格对象会拒绝未声明的字段。
 *
 * 保留原来的 updateMenuBody 名称，方便 Controller 使用。
 */
export const updateMenuBody = updateMenuBodyBaseSchema.refine(
	fields => Object.values(fields).some(value => value !== undefined),
	{
		message: '至少提供一个可更新字段',
	}
)

export type UpdateMenuBodyInput = z.input<typeof updateMenuBody>
export type UpdateMenuBodyDto = z.output<typeof updateMenuBody>

/**
 * 删除菜单：只接收菜单 ID。
 * 如果使用 URL 路径参数，需先将字符串转换为数字。
 */
export const deleteMenuSchema = z.strictObject({
	menuId,
})

export type DeleteMenuInput = z.input<typeof deleteMenuSchema>
export type DeleteMenuDto = z.output<typeof deleteMenuSchema>
