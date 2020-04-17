import * as bcrypt from 'bcrypt';
import { USER_ROLE, USER_STATUS } from '../../constants';
import { IUser } from '../../interfaces';
import { HttpError } from '../../utils/httpError';
import { BaseModelService } from '../baseModel';
import { MailService } from '../mail/mail';
import { TokenService } from '../token/token';
import { UserService } from '../user/user';
import { UsersKeysService } from '../usersKeys/usersKeys';


export class AuthService extends BaseModelService {

    async login(user: any): Promise<any> {
        const userService = new UserService();
        const tokenService = new TokenService();

        const dbUser: any = await userService.getUserByEmail(user.email);
        if (!dbUser) {
            throw new HttpError(401, 'User is unregistered', 'Access denied');
        }

        const compared = await bcrypt.compare(user.password, dbUser.password);

        if (compared) {
            delete dbUser.dataValues.password;
            const token = await tokenService.generateToken({user: dbUser.dataValues}, +process.env.TOKEN_TIME);

            return {
                user: dbUser,
                token
            };
        }

        throw new HttpError(401, 'Bad password', 'Access denied');
    }
    async register(user: Exclude<IUser, 'status' | 'role' | 'disabled'>): Promise<{status: number}> {
        try {
            const userService = new UserService();
            const mailService = new MailService();
            const dbUser = await userService.getUserByEmail(user.email);

            UserService.checkExistUser(!!dbUser);

            user.password = await bcrypt.hash(user.password, +process.env.saltRounds);
            const createdUser: IUser = (await userService.createUser(user)).dataValues;
            const dataSendMail = await mailService.generateDataMail(createdUser.id, createdUser.firstName, createdUser.email);

            mailService.sendMail(dataSendMail);

            return {
                status: 200
            };
        } catch (e) {
            console.log('register', e);
        }
    }

    async confirmRegistration(key: string): Promise<boolean> {
        const userKeysService = new UsersKeysService();
        const userService = new UserService();

        const userKey = await userKeysService.getUserKey(key);

        if (userKey) {
            await userService.updateUser(userKey.userId, {status: USER_STATUS.confirmed});
            userKeysService.deleteUserKey(userKey.id);

            return true;
        }

        return false;
    }

}
