import mongoose, { Model } from "mongoose"
import { Program, ProgramModel } from "../models"

import * as express from "express"
import { Router, Response, Request } from "express"
import { checkBody, checkUserRole, checkUserToken } from "../middleware"
import { checkQuery } from "../middleware/query.middleware"
import { RolesEnums } from "../enums"

const path = require('path');
const fs = require('fs')
const Docker = require('dockerode')
const multer = require('multer')


const docker = new Docker();
const upload = multer({ dest: path.join(__dirname, 'uploads') });
interface LanguageConfig {
    extension: string;
    image: string;
    cmd: (filePath: string) => string[];
}

const LANGUAGES: { [key: string]: LanguageConfig } = {
    python: {
        extension: 'py',
        image: 'my-python-image',
        cmd: (filePath: string) => ['python3', filePath]
    },
    javascript: {
        extension: 'js',
        image: 'my-node-image',
        cmd: (filePath: string) => ['node', filePath]
    }
};

function writeCodeToFile(code: string, filePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        // Ensure the directory exists
        const dir = path.dirname(filePath);

            // Write the file
            fs.writeFile(filePath, code, (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
    });
}
function deleteFile(filePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.unlink(filePath, (err: any) => {
            if (err) {
                console.error(`Error deleting file ${filePath}:`, err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
export class ProgramController {

    readonly path: string
    readonly model: Model<Program>

    constructor(){
        this.path = "/program"
        this.model = ProgramModel
    }

    getAllPrograms = async (req:Request, res:Response): Promise<void> => {
        const programs = await ProgramModel.find()
        res.status(200).json(programs)
        return 
    }
    readonly paramsNewProgram = {
        "name":"string",
        "content" : "string",
        "inputFileType": "string",
        "outputFileType": "string",
        "language": "string"
    }

    newProgram = async (req: Request, res: Response): Promise<void> => {
        const newPost = await ProgramModel.create({
            name: req.body.name,
            content:  req.body.content ,
            like: [],
            comments: [],
            inputFileType:req.body.inputFileType,
            outputFileType:req.body.outputFileType,
            username : req.user?.username,
            creationDate: new Date(),
            language: req.body.language,
        })
        
        res.status(201).json(newPost)
        return 
    }

    readonly paramsUpdateProgram = {
        "name": "string",
        "content": "string",
        "inputFileType": "string",
        "outputFileType": "string",
        "language": "string"
    }

    updateProgram = async (req: Request, res: Response): Promise<void> => {
        const id = req.query.id as string;
        const username = req.user?.username;
    
        if (!username) {
            res.status(401).json({ message: 'You are not logged in' });
            return;
        }
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid program ID format' });
            return;
        }
    
        try {
            const program = await ProgramModel.findById(id);
    
            if (!program) {
                res.status(404).json({ message: 'Program not found' });
                return;
            }
    
            if (program.username !== username) {
                res.status(403).json({ message: 'You do not have permission to update this program' });
                return;
            }
    
            const updateData = {
                name: req.body.name,
                content: req.body.content,
                inputFileType: req.body.inputFileType,
                outputFileType: req.body.outputFileType,
                language: req.body.language,
            };
    
            const updatedProgram = await ProgramModel.findByIdAndUpdate(id, updateData, { new: true });
    
            if (updatedProgram) {
                res.status(200).json(updatedProgram);
            } else {
                res.status(404).json({ message: "Program not found" });
            }
        } catch (error) {
            console.error('Error updating program:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    deleteProgram = async (req: Request, res: Response): Promise<void> => {
        const id = req.query.id as string;
        const program = await ProgramModel.findById(id)

        if (program) {
            if (program.username === req.user?.username) {
                await ProgramModel.findByIdAndDelete(id)
                res.status(200).json({ message: "Program deleted successfully" })
            } else {
                res.status(403).json({ message: "You are not authorized to delete this program" })
            }
        } else {
            res.status(404).json({ message: "Program not found" })
        }
    }
    isProgramDeletable = async (req: Request, res: Response): Promise<void> => {
        const id = req.query.id as string;
        const username = req.user?.username;
    
        if (!username) {
            res.status(401).json({ message: 'You are not logged in' });
            return;
        }
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid program ID format' });
            return;
        }
    
        try {
            const program = await ProgramModel.findById(id);
    
            if (!program) {
                res.status(404).json({ message: 'program not found' });
                return;
            }
    
            if (program.username === username) {
                res.status(200).json(true);
                return;
            }
    
            res.status(200).json(false);
        } catch (error) {
            console.error('Error retrieving program:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };

    getOneProgram = async (req: Request, res: Response): Promise<void> => {
        const id = req.query.id as string;
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid program ID format' })
            return
        }
    
        try {
            const program = await ProgramModel.findById(id)
    
            if (program) {
                res.status(200).json(program)
            } else {
                res.status(404).json({ message: 'Program not found' })
            }
        } catch (error) {
            console.error('Error retrieving program:', error)
            res.status(500).json({ message: 'Internal server error' })
        }
    }

    sanitizeOutput = (output: string): string => {
        // Remove control characters (non-printable characters)
        return output.replace(/[\x00-\x1F\x7F]/g, '').trim();
    };
// Fonction pour nettoyer les fichiers
cleanupFiles = async (hostCodeFilePath: string, hostFilePath?: string): Promise<void> => {
    const cleanupPromises = [deleteFile(hostCodeFilePath)];
    if (hostFilePath) {
        cleanupPromises.push(deleteFile(hostFilePath));
    }
    try {
        await Promise.all(cleanupPromises);
    } catch (cleanupError) {
        console.error('Erreur lors du nettoyage:', cleanupError);
    }
};
executeProgram = async (req: Request, res: Response): Promise<void> => {
    const { language, code, outputFileType } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    // Vérifiez que le langage est pris en charge
    const langConfig = LANGUAGES[language as string];
    if (!langConfig) {
        res.status(400).send('Unsupported language');
        return;
    }

    const containerName = `code-exec-container-${language}`;
    const codeFileName = `script.${langConfig.extension}`;
    const hostCodeFilePath = path.join(__dirname, codeFileName);
    const containerCodeFilePath = `/app/${codeFileName}`;
    const hostFilePath = file ? path.join(__dirname, 'uploads', file.filename) : undefined;
    const containerFilePath = file ? `/app/${file.originalname}` : undefined;

    try {
        // Écrire le code dans un fichier sur l'hôte
        await writeCodeToFile(code as string, hostCodeFilePath);

        // Vérifiez si le conteneur est déjà en cours d'exécution
        let container = docker.getContainer(containerName);
        const containerInfo = await container.inspect().catch(() => null);

        if (containerInfo) {
            // Arrêter et supprimer le conteneur s'il existe
            await container.stop().catch(() => null);
            await container.remove();
        }

        // Créez et démarrez le conteneur avec les fichiers montés
        const binds = [`${hostCodeFilePath}:${containerCodeFilePath}`];
        if (file) {
            binds.push(`${hostFilePath}:${containerFilePath}`);
        }

        container = await docker.createContainer({
            Image: langConfig.image,
            Cmd: langConfig.cmd(containerCodeFilePath),
            name: containerName,
            Tty: true,
            HostConfig: {
                Binds: binds
            }
        });
        await container.start();

        // Obtenez les logs du conteneur
        const logs = await container.logs({
            stdout: true,
            stderr: true,
            follow: true
        });

        // Vérifiez si outputFileType est spécifié
        if (outputFileType !== "void") {
            try {
                const fileName = "output." + outputFileType;
                const containerPath = `/app/${fileName}`; // Chemin du fichier dans le conteneur

                // Obtenir le fichier depuis le conteneur
                const stream = await container.getArchive({ path: containerPath });

                // Envoyer le fichier en streaming à l'utilisateur
                res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
                res.setHeader('Content-Type', 'application/octet-stream');

                // Pipe le flux de données vers la réponse HTTP
                stream.pipe(res);


                stream.on('error', async (err: any) => {
                    console.error('Erreur lors de l\'envoi du fichier:', err);
                    res.status(500).send('Erreur lors de l\'envoi du fichier.');
                    // Nettoyage des fichiers en cas d'erreur
                });
            } catch (error) {
                console.error('Erreur lors de la récupération du fichier depuis le conteneur:', error);
                res.status(500).send('Erreur lors de la récupération du fichier.');
                // Nettoyage des fichiers en cas d'erreur
            }
        } else {
            // Si outputFileType n'est pas spécifié, envoyez les logs en réponse
            res.set('Content-Type', 'text/plain');
            logs.on('data', (chunk: Buffer) => {
                res.write(chunk.toString());
            });
            logs.on('end', async () => {
                res.end();
                // Nettoyage des fichiers après l'envoi de la réponse
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('An error occurred while fetching the logs.');
        // Nettoyage des fichiers en cas d'erreur
        await this.cleanupFiles(hostCodeFilePath, hostFilePath);
    }
};

    download = async (req: Request, res: Response): Promise<void> => {
        const filePath = path.join(__dirname, 'file.txt'); // chemin vers votre fichier
        res.download(filePath);
    }

    buildRouter = (): Router => {
        const router = express.Router()
        router.get('/', checkUserToken(), this.getAllPrograms.bind(this))
        router.get('/one', checkUserToken(), this.getOneProgram.bind(this))

        router.get('/download',  this.download.bind(this))
        router.get('/is-deletable', checkUserToken(), this.isProgramDeletable.bind(this))
        router.post('/', express.json(), checkUserToken(), checkUserRole(RolesEnums.guest), checkBody(this.paramsNewProgram), this.newProgram.bind(this))
        router.put('/', express.json(), checkUserToken(), checkUserRole(RolesEnums.guest), checkBody(this.paramsUpdateProgram), this.updateProgram.bind(this))
        router.delete('/', checkUserToken(), checkUserRole(RolesEnums.guest), this.deleteProgram.bind(this))
        router.post('/execute', express.json(), checkUserToken(), checkUserRole(RolesEnums.guest), upload.single('file'), this.executeProgram.bind(this))
        return router
    }
}