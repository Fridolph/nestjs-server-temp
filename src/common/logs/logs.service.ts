import { Injectable } from '@nestjs/common'

@Injectable()
export class LogsService {
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

		// return this.logsRepository.query(sql, [id, '200'])
	}
}
