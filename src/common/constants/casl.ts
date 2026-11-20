export enum CaslAction {
	// 所有管理权限
	Manage = 'manage',

	// 基础管理权限
	Create = 'create',
	Read = 'read',
	Update = 'update',
	Delete = 'delete',

	// 额外权限动作
	Export = 'export',
}
