import { Document, Types } from "mongoose"
import { Role, RoleModel, UserModel } from "../models"
import { SecurityUtils } from "../utils"

export class StartService{
    static userRoles = async () => {
        const countRoles = await RoleModel.count().exec()
        if(countRoles !== 0 ){
            return 
        }
    
        const rolesNames: string[] = ["admin", "guest"]
        const rolesRequest = rolesNames.map((name) => {
            RoleModel.create({
                name
            })
        })
        await Promise.all(rolesRequest)
    }

    static createUsers = async ():Promise<void> => {
        const countUsers = await UserModel.count().exec()
        if(countUsers !== 0 ){
            return 
        }
    
        const roles = await RoleModel.find().exec()
        
        const usersLogins: string[] = ["admin@mail.com", "guest@mail.com"]
        const usersLoginsAndUsernames: any[] = 
        [{login:"admin@gmail.com",username:"admin"},{login:"guest@gmail.com",
        username:"guest"
        }
         ]
        const usersNames: string[] = ["admin@mail.com", "guest@mail.com"]
        
        const usersRequest = usersLoginsAndUsernames.map(async (usersLoginsAndUsernames,key) => {
            
            let userRoles: (Document<unknown, {}, Role> & Omit<Role & {_id: string;}, never>)[] = [];
            const adminRole = roles.find((role) => role.name === "admin");
            const guestRole = roles.find((role) => role.name === "guest");

            if (usersLoginsAndUsernames.username == "admin") {
                if (adminRole && guestRole) {
                    userRoles = [adminRole, guestRole];
                }
            } else {
                if (guestRole) {
                    userRoles = [guestRole];
                }
            }
            UserModel.create({
                login:usersLoginsAndUsernames.login,
                password: SecurityUtils.toSHA512("password"),
                username : usersLoginsAndUsernames.username,
                roles: userRoles,
                posts: [],
                profileImageUrl: "https://cdn.hero.page/0afb509c-1859-4ed9-a529-6c8ea2711b51-aesthetic-anime-and-manga-pfp-from-jujutsu-kaisen-chapter-233-page-3-pfp-3",
                backgroundImageUrl:"https://preview.redd.it/why-did-gojo-fire-his-hollow-purple-the-wrong-way-and-curve-v0-7lff23n81lhb1.png?auto=webp&s=304248697abd05b315bcbaa187ca4d8aa009b49a",
                description : "c'est moi (test)",
                joinDate : new Date(),
                follow: []
            })
        })
        await Promise.all(usersRequest)
    } 
}