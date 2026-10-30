import AppDataSource from '../ormconfig.ts'
import User from './user/user.entity.ts'

AppDataSource.initialize()
  .then(async () => {
    const res = await AppDataSource.manager.find(User)
    console.log('AppDataSource.initialize', res)
  })
  .catch(err => console.log(err))
