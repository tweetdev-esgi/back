import { Document, Types } from "mongoose"
import { PostModel, Role, RoleModel, UserModel } from "../models"
import { SecurityUtils } from "../utils"
import axios from "axios"


const markdownContent = "**Markdown content example**\n\nThis is a Markdown content example with an image!\n\n![Example Image](https://picsum.photos/200/300)";

export class StartService {
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

    static createUsers = async (): Promise<void> => {
        const countUsers = await UserModel.count().exec()
        if(countUsers !== 0 ){
            return 
        }
    
        const roles = await RoleModel.find().exec()
        
        const usersLoginsAndUsernames: any[] = 
        [{login:"admin@gmail.com",username:"Respons11"},{login:"guest@gmail.com",
        username:"Respons11"
        }
         ]
        
        const usersRequest = usersLoginsAndUsernames.map(async (usersLoginsAndUsernames) => {
            
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
            await UserModel.create({
                login: usersLoginsAndUsernames.login,
                password: SecurityUtils.toSHA512("password"),
                username: usersLoginsAndUsernames.username,
                roles: userRoles,
                posts: [],
                profileImageUrl: "https://cdn.hero.page/0afb509c-1859-4ed9-a529-6c8ea2711b51-aesthetic-anime-and-manga-pfp-from-jujutsu-kaisen-chapter-233-page-3-pfp-3",
                backgroundImageUrl: "https://preview.redd.it/why-did-gojo-fire-his-hollow-purple-the-wrong-way-and-curve-v0-7lff23n81lhb1.png?auto=webp&s=304248697abd05b315bcbaa187ca4d8aa009b49a",
                description: "c'est moi (test)",
                joinDate: new Date(),
                follow: []
            })
        })
        await Promise.all(usersRequest)
    } 

    static createUser = async (): Promise<void> => {

        const roles = await RoleModel.find().exec();
        
        // Assuming this fetches 10 random users from RandomUser API
        const { data } = await axios.get('https://randomuser.me/api');
        const usersData = data.results;

        const usersRequest = usersData.map(async (userData: any) => {
            const first = userData.name.first;
            const last = userData.name.last;
            const login = `${first}.${last}`.toLowerCase() + "@gmail.com"
            const username = `${first}-${last}`.toLowerCase();  
            const profileImageUrl = userData.picture.thumbnail;
            const backgroundImageUrl = userData.picture.large;
            const description = `Hello! My name is ${first} ${last}`;

            // Determine roles for the user
            let userRoles: (Document<unknown, {}, Role> & Omit<Role & { _id: string; }, never>)[] = [];
            const adminRole = roles.find((role) => role.name === "admin");
            const guestRole = roles.find((role) => role.name === "guest");

            if (username === "admin") {
                if (adminRole && guestRole) {
                    userRoles = [adminRole, guestRole];
                }
            } else {
                if (guestRole) {
                    userRoles = [guestRole];
                }
            }
            // Create the user
            await UserModel.create({
                login,
                password: SecurityUtils.toSHA512("Respons11"),
                username,
                roles: userRoles,
                posts: [],
                profileImageUrl,
                backgroundImageUrl,
                description,
                joinDate: new Date(),
                follow: []
            });

            await PostModel.create({
                content: markdownContent,
                like: [],
                comments: [],
                creationDate: new Date(),
                username,
                hubname: null,
                program: null
            })
        });

        await Promise.all(usersRequest);
    }
}
