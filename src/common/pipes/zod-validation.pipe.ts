import { BadRequestException, Injectable } from '@nestjs/common'
import type { PipeTransform } from '@nestjs/common'
import type { ZodType, output } from 'zod'

/** 使用指定 Zod Schema 校验请求，并返回转换后的数据。 */
@Injectable()
export class ZodValidationPipe<Schema extends ZodType> implements PipeTransform<
	unknown,
	output<Schema>
> {
	/**
	 * 创建绑定特定请求 Schema 的校验管道。
	 *
	 * @param schema - 对应接口的校验规则，由调用方显式传入。
	 */
	constructor(private readonly schema: Schema) {}

	/**
	 * 校验输入并将字段级错误转换为 HTTP 400。
	 *
	 * @param value - 尚未经过校验的请求数据。
	 * @returns Schema 解析后的数据，包含 trim 等转换结果。
	 * @throws BadRequestException - 请求数据不满足 Schema 规则。
	 */
	transform(value: unknown): output<Schema> {
		const result = this.schema.safeParse(value)

		if (!result.success) {
			throw new BadRequestException({
				statusCode: 400,
				message: '请求参数校验失败',
				errors: result.error.issues.map(issue => ({
					path: issue.path.map(String).join('.') || '$',
					code: issue.code,
					message: issue.message,
				})),
			})
		}

		return result.data
	}
}
