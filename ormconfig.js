import Logs from "./src/common/logs/logs.entity.js";
import Roles from "./src/roles/roles.entity.js";
import UserProfile from "./src/user/profile/profile.entity.js";
import User from "./src/user/user.entity.js";
import { DataSource } from 'typeorm';
export const connectionParams = {
    type: process.env.DB_TYPE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User, UserProfile, Logs, Roles],
    synchoronize: true,
    logging: false,
};
export default new DataSource({
    ...connectionParams,
    migrations: ['src/migrations/**'],
    subscribers: [],
});
//# sourceMappingURL=ormconfig.js.map