import { BadRequestException } from '@nestjs/common'

/**
 * 解析查询参数中的整数，并校验范围。
 *
 * @param value - 待解析的数字或十进制整数字符串。
 * @param field - 参数名，用于生成错误信息。
 * @param min - 允许的最小值，包含边界。
 * @param max - 允许的最大值，包含边界。
 * @returns 范围内的安全整数；十进制字符串会转换为 number。
 * @throws BadRequestException - 输入类型、十进制格式、整数安全性或范围不符合要求。
 */
export function parseIntegerQuery(
	value: unknown,
	field: string,
	min: number = 0,
	max = Number.MAX_SAFE_INTEGER
): number {
	const errorMessage = `${field} 必须是 ${min} 到 ${max} 之间的整数`

	// 只接收 number 或十进制整数字符串
	if (typeof value !== 'number' && typeof value !== 'string') {
		throw new BadRequestException(errorMessage)
	}

	// 字符串只允许数字，可以允许前后的空白
	if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
		throw new BadRequestException(errorMessage)
	}

	const result = Number(value)

	// 同时排除 NaN、Infinity、非整数和不安全整数
	if (!Number.isSafeInteger(result) || result < min || result > max) {
		throw new BadRequestException(errorMessage)
	}

	return result
}
