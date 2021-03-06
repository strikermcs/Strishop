const {User} = require('../models/models')
const bcrypt = require('bcrypt')
const uuid = require('uuid')
const tokenService = require('./token-service')
const mailService = require('./mail-service')
const UserDto = require('../dtos/user-dto')
const ApiError = require('../error/ApiError')

class UserService{

    async registration(email, password){
        const candidate = await User.findOne({where:{email}})
        if (candidate){
            throw ApiError.conflict(`Пользователь с таким email: ${email} уже существует`)
        }
        const hashPassword = await bcrypt.hash(password, 3)
        const activationLink = uuid.v4()
        const user = await User.create({email, password: hashPassword, activationLink})
        await mailService.sendActivationMail(email, 
            `${process.env.API_URL}/api/user/activate/${activationLink}`)

        const userDto = new UserDto(user)
        const tokens = tokenService.generateTokens({...userDto})
        await tokenService.saveToken(userDto.id, tokens.refreshToken)

        return {...tokens, user: userDto}


    }



    async activate(activationLink){
        const user = await User.findOne({where:{activationLink}})
        if(!user){
            throw ApiError.badRequest('Неккоректная ссылка активации')
        }
        user.isActivated = true;
        await user.save();
    }

    async login(email, password){
        const user = await User.findOne({where: {email}})
        if(!user){
            throw ApiError.badUser('Пользователь с таким email не найден')
        }
        const isPassEquals = await bcrypt.compare(password, user.password)
        if(!isPassEquals){
            throw ApiError.badPassword('Неверный пароль')
        }
        const userDto = new UserDto(user)
        const tokens = tokenService.generateTokens({...userDto})
        await tokenService.saveToken(userDto.id, tokens.refreshToken)

        return {...tokens, user: userDto}
    }


    async logout(refreshToken) {
        const token = await tokenService.removeToken(refreshToken)
        return token
    }    
    
    async refresh(refreshToken) {
      
        if(!refreshToken){
            throw ApiError.UnauthorizedError()
        }
        
        const userData = tokenService.validateRefreshToken(refreshToken)
        
        const tokenFromDb = await tokenService.findToken(refreshToken)
       
        if(!userData || !tokenFromDb){
            throw ApiError.UnauthorizedError()
        }
         
        const user = await User.findOne({ where: {id: userData.id}})
       
        const userDto = new UserDto(user)
        const tokens = tokenService.generateTokens({...userDto})
        await tokenService.saveToken(userDto.id, tokens.refreshToken)

        return {...tokens, user: userDto}

    }


    async getAllUsers(){
        const users = await User.findAll()
        return users
    }
}


module.exports = new UserService();